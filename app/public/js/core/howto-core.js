/**
 * @fileoverview Núcleo de las diapositivas de instrucciones (slide_type 'howto'). Cada tema se
 * registra con `XiroHowTo.register(tema, { createStage, timeline })` y sus textos en
 * `XiroHowToTexts[tema][idioma]`. `slide_howto` solo elige un tema registrado: el contenido
 * (escenario, textos, locución) es siempre código del cliente. ES5: también lo carga tv.html.
 * El idioma es el de la interfaz del presentador (XiroI18n); sin i18n (TV) o sin textos en ese
 * idioma se usa español. Locución: /audio/howto/<tema>/<idioma>/c<N>.mp3 (solo el presentador).
 */
(function (root) {
    'use strict';

    const DESIGN_W = 1280;
    const DESIGN_H = 720;
    const AUDIO_BASE = '/audio/howto/';
    // Sube al regenerar clips: los mp3 mantienen su URL y el navegador los guardaría con la voz anterior
    const AUDIO_VERSION = '20261118100000';
    // Efectos compartidos por todos los temas (generados con earshot, voz siempre por encima)
    const SFX_BASE = '/audio/howto/sfx/';
    const SFX_NAMES = ['tap', 'on', 'off', 'pop', 'send', 'ding', 'flourish', 'fall', 'fanfare'];
    const SFX_VOLUME = 0.55;
    // La animación no arranca hasta que la voz y los efectos están cargados (NAS o red lenta desincronizaban todo)
    const READY_TIMEOUT_MS = 6000;
    // Un clip o efecto que llega más tarde que esto (hilo bloqueado, pestaña en segundo plano) se omite
    // en vez de sonar de golpe junto con los siguientes
    const LATE_AUDIO_MS = 1500;
    const MAX_LIVE_SFX = 4;
    // Máximo que se espera a que el audio del navegador pase de «suspendido» a «en marcha»
    const WAKE_TIMEOUT_MS = 1500;
    const FALLBACK_LANGUAGE = 'es';
    const topics = {};
    let active = null;

    function register(topic, definition) {
        topics[topic] = definition;
    }

    /** Idioma de la interfaz si hay textos para él; si no, español. */
    function resolveLanguage(topic, requested) {
        const texts = (root.XiroHowToTexts || {})[topic] || {};
        const i18n = root.XiroI18n;
        const wanted = requested || (i18n && i18n.getLanguage ? i18n.getLanguage() : FALLBACK_LANGUAGE);
        return Object.prototype.hasOwnProperty.call(texts, wanted) ? wanted : FALLBACK_LANGUAGE;
    }

    /** Constructor de la línea de tiempo: eventos a un instante (ms) y locución. */
    function createBuilder(texts, playClip, playSfx) {
        const events = [];
        const builder = {
            events: events,
            dur: function (n) {
                return texts.dur[n];
            },
            at: function (t, fn) {
                events.push({ t: t, fn: fn });
            },
            say: function (t, n) {
                events.push({
                    t: t,
                    audio: true,
                    fn: function () {
                        playClip(n);
                    }
                });
            },
            /** Efecto de sonido corto (tap, marca, envío...) de /audio/howto/sfx/<nombre>.mp3; solo el presentador. */
            sfx: function (t, name) {
                events.push({
                    t: t,
                    audio: true,
                    fn: function () {
                        playSfx(name);
                    }
                });
            },
            /** Escena: pone el paso y el pie de texto y arranca su locución. */
            scene: function (t, ui, step, clip) {
                builder.at(t, function () {
                    if (step !== null) ui.step(step);
                    ui.caption(texts.caps[clip]);
                });
                builder.say(t, clip);
            }
        };
        return builder;
    }

    function fitStage(host, stage) {
        const k = Math.min(host.clientWidth / DESIGN_W, host.clientHeight / DESIGN_H) || 1;
        stage.style.transform = 'translate(-50%, -50%) scale(' + k + ')';
    }

    /** Decodifica un mp3 con Web Audio (promesa en navegadores nuevos, callbacks en Safari antiguo). */
    function decode(ctx, data) {
        return new Promise(function (resolve, reject) {
            const maybe = ctx.decodeAudioData(data, resolve, reject);
            if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
        });
    }

    let sharedContext = null;
    /** Un único AudioContext para toda la página (los navegadores limitan cuántos se pueden abrir). */
    function audioContext() {
        if (sharedContext) return sharedContext;
        const Ctor = root.AudioContext || root.webkitAudioContext;
        if (!Ctor || typeof root.fetch !== 'function') return null;
        try {
            sharedContext = new Ctor();
        } catch (e) {
            return null;
        }
        return sharedContext;
    }

    /**
     * Audio con Web Audio: cada clip se descarga una vez (fetch, sin conexiones de streaming abiertas), se
     * decodifica y suena desde memoria; al terminar se suelta todo. La voz nunca se solapa y los efectos
     * acotados. Los clips suenan enteros: no hay elementos <audio> que recorten la cola ni acumulen decodificadores.
     */
    function createWebAudio(ctx, voiceUrls) {
        const buffers = {};
        const live = [];
        let voiceNode = null;
        let destroyed = false;

        function load(key, url) {
            return root
                .fetch(url)
                .then(function (response) {
                    if (!response.ok) throw new Error(String(response.status));
                    return response.arrayBuffer();
                })
                .then(function (data) {
                    return decode(ctx, data);
                })
                .then(function (buffer) {
                    buffers[key] = buffer;
                })
                .catch(function () {});
        }

        /**
         * El navegador crea el audio suspendido y la salida (HDMI, Bluetooth) tarda en despertar: si el primer sonido
         * (la fanfarria) esperara a eso con la animación ya en marcha, saldría tarde y pisaría la primera locución.
         * Por eso la animación no arranca hasta que el audio corre (con tope, por si el navegador lo bloquea).
         */
        function wake() {
            if (!ctx.resume || ctx.state === 'running') return Promise.resolve();
            return new Promise(function (resolve) {
                setTimeout(resolve, WAKE_TIMEOUT_MS);
                try {
                    Promise.resolve(ctx.resume()).then(resolve, resolve);
                } catch (e) {
                    resolve();
                }
            });
        }

        function start(key, volume, isVoice) {
            if (destroyed || !buffers[key]) return;
            if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () {});
            const source = ctx.createBufferSource();
            const gain = ctx.createGain();
            gain.gain.value = volume;
            source.buffer = buffers[key];
            source.connect(gain);
            gain.connect(ctx.destination);
            const node = { source: source, gain: gain, voice: isVoice, done: false };
            source.onended = function () {
                node.done = true;
                try {
                    source.disconnect();
                    gain.disconnect();
                } catch (e) {
                    // ya desconectado
                }
            };
            live.push(node);
            source.start(0);
        }

        function stopNode(node) {
            if (node.done) return;
            node.done = true;
            try {
                node.source.stop(0);
                node.source.disconnect();
                node.gain.disconnect();
            } catch (e) {
                // aún no había empezado o ya terminó
            }
        }

        return {
            load: function () {
                const jobs = voiceUrls.map(function (url, i) {
                    return load('v' + i, url);
                });
                SFX_NAMES.forEach(function (name) {
                    jobs.push(load('s_' + name, SFX_BASE + name + '.mp3?v=' + AUDIO_VERSION));
                });
                jobs.push(wake());
                return Promise.all(jobs);
            },
            voice: function (n) {
                if (voiceNode) stopNode(voiceNode); // nunca dos locuciones a la vez
                start('v' + n, 1, true);
                voiceNode = live[live.length - 1];
            },
            sfx: function (name) {
                const sounding = live.filter(function (node) {
                    return !node.voice && !node.done;
                });
                if (sounding.length >= MAX_LIVE_SFX) return;
                start('s_' + name, SFX_VOLUME, false);
            },
            destroy: function () {
                destroyed = true;
                live.forEach(stopNode);
                live.length = 0;
                Object.keys(buffers).forEach(function (key) {
                    delete buffers[key];
                });
            }
        };
    }

    /** Respaldo sin Web Audio (navegadores antiguos): elementos <audio> precargados. */
    function createElementAudio(voiceUrls) {
        const clips = voiceUrls.map(function (url) {
            const clip = new Audio(url);
            clip.preload = 'auto';
            return clip;
        });
        const playing = [];
        let voice = null;
        return {
            load: function () {
                const pending = clips.filter(function (a) {
                    return (
                        typeof a.addEventListener === 'function' && typeof a.readyState === 'number' && a.readyState < 3
                    );
                });
                if (pending.length === 0) return null; // todo listo: arranca sin esperar
                return Promise.all(
                    pending.map(function (a) {
                        return new Promise(function (resolve) {
                            a.addEventListener('canplaythrough', resolve);
                            a.addEventListener('error', resolve);
                        });
                    })
                );
            },
            voice: function (n) {
                if (!clips[n]) return;
                if (voice && voice !== clips[n]) voice.pause();
                voice = clips[n];
                const played = clips[n].play();
                if (played && played.catch) played.catch(function () {});
                playing.push(clips[n]);
            },
            sfx: function (name) {
                const sounding = playing.filter(function (a) {
                    return a.isSfx && a.paused === false && a.ended === false;
                });
                if (sounding.length >= MAX_LIVE_SFX) return;
                const effect = new Audio(SFX_BASE + name + '.mp3?v=' + AUDIO_VERSION);
                effect.isSfx = true;
                effect.volume = SFX_VOLUME;
                const played = effect.play();
                if (played && played.catch) played.catch(function () {});
                playing.push(effect);
                if (playing.length > 40) playing.splice(0, playing.length - 40);
            },
            destroy: function () {
                playing.forEach(function (a) {
                    a.pause();
                });
                clips.concat(playing).forEach(function (a) {
                    if (typeof a.removeAttribute === 'function') a.removeAttribute('src');
                    if (typeof a.load === 'function') a.load();
                });
                playing.length = 0;
            }
        };
    }

    /**
     * Monta la animación de un tema y la reproduce una vez.
     * @param {Element} host - Contenedor con tamaño (se vacía)
     * @param {string} topic - Tema registrado
     * @param {{audio: boolean, language: string}} [options] - audio: solo el presentador reproduce la locución
     * @returns {{destroy: function(), language: string}|null} null si el tema no existe
     */
    function mount(host, topic, options) {
        if (!Object.prototype.hasOwnProperty.call(topics, topic)) return null;
        stop();
        const language = resolveLanguage(topic, options && options.language);
        const texts = root.XiroHowToTexts[topic][language];
        let destroyed = false;
        let audio = null;
        if (options && options.audio) {
            const urls = texts.dur.map(function (d, i) {
                return AUDIO_BASE + topic + '/' + language + '/c' + i + '.mp3?v=' + AUDIO_VERSION;
            });
            const ctx = audioContext();
            audio = ctx ? createWebAudio(ctx, urls) : createElementAudio(urls);
        }
        const ui = topics[topic].createStage(host, texts);
        const builder = createBuilder(
            texts,
            function (n) {
                if (!destroyed && audio) audio.voice(n);
            },
            function (name) {
                if (!destroyed && audio && SFX_NAMES.indexOf(name) >= 0) audio.sfx(name);
            }
        );
        const end = topics[topic].timeline(ui, texts, builder);
        // Fanfarria (2,9 s) sobre el rótulo «<tipo> · Instrucciones», en todos los temas: acaba antes de la voz
        builder.sfx(0, 'fanfare');
        const queue = builder.events.slice().sort(function (a, b) {
            return a.t - b.t;
        });
        let timer = null;
        let readyTimer = null;
        const begin = function () {
            if (destroyed || timer !== null) return;
            clearTimeout(readyTimer);
            const start = Date.now();
            let next = 0;
            timer = setInterval(function () {
                const elapsed = Date.now() - start;
                while (next < queue.length && queue[next].t <= elapsed) {
                    const event = queue[next++];
                    // El estado visual se pone al día siempre; la voz y los efectos tardíos se descartan
                    if (event.audio && elapsed - event.t > LATE_AUDIO_MS) continue;
                    event.fn();
                }
                if (elapsed >= end) clearInterval(timer);
            }, 50);
        };
        // La animación arranca cuando la voz y los efectos están en memoria (con un tope por si alguno no llega)
        if (audio) {
            const loading = audio.load();
            if (loading === null) {
                begin();
            } else {
                readyTimer = setTimeout(begin, READY_TIMEOUT_MS);
                loading.then(begin, begin);
            }
        } else {
            begin();
        }
        const onResize = function () {
            fitStage(host, ui.stage);
        };
        fitStage(host, ui.stage);
        root.addEventListener('resize', onResize);

        const handle = {
            language: language,
            destroy: function () {
                destroyed = true;
                clearInterval(timer);
                clearTimeout(readyTimer);
                root.removeEventListener('resize', onResize);
                if (audio) audio.destroy();
                host.innerHTML = '';
                if (active === handle) active = null;
            }
        };
        active = handle;
        return handle;
    }

    /** Detiene la animación en curso (y su voz); se llama al cambiar de diapositiva. */
    function stop() {
        if (active) active.destroy();
    }

    // Al salir de la página (volver al inicio, cerrar la pestaña) la voz no debe seguir sonando
    root.addEventListener('pagehide', stop);

    root.XiroHowToTexts = root.XiroHowToTexts || {};
    root.XiroHowTo = {
        register: register,
        mount: mount,
        stop: stop,
        hasTopic: function (topic) {
            return Object.prototype.hasOwnProperty.call(topics, topic);
        },
        topics: function () {
            return Object.keys(topics);
        }
    };
})(typeof window !== 'undefined' ? window : this);
