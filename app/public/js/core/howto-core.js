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
    const AUDIO_VERSION = '20261102175909';
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
    function createBuilder(texts, playClip) {
        const events = [];
        const builder = {
            events: events,
            dur: function (n) { return texts.dur[n]; },
            at: function (t, fn) { events.push({ t: t, fn: fn }); },
            say: function (t, n) { events.push({ t: t, fn: function () { playClip(n); } }); },
            /** Escena: pone el paso y el pie de texto y arranca su locución. */
            scene: function (t, ui, step, clip) {
                builder.at(t, function () { if (step !== null) ui.step(step); ui.caption(texts.caps[clip]); });
                builder.say(t, clip);
            }
        };
        return builder;
    }

    function fitStage(host, stage) {
        const k = Math.min(host.clientWidth / DESIGN_W, host.clientHeight / DESIGN_H) || 1;
        stage.style.transform = 'translate(-50%, -50%) scale(' + k + ')';
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
        const clips = [];
        const playing = [];
        if (options && options.audio) {
            for (let i = 0; i < texts.dur.length; i++) {
                const clip = new Audio(AUDIO_BASE + topic + '/' + language + '/c' + i + '.mp3?v=' + AUDIO_VERSION);
                clip.preload = 'auto';
                clips.push(clip);
            }
        }
        const ui = topics[topic].createStage(host, texts);
        const builder = createBuilder(texts, function (n) {
            if (!clips[n]) return;
            const played = clips[n].play();
            if (played && played.catch) played.catch(function () {});
            playing.push(clips[n]);
        });
        const end = topics[topic].timeline(ui, texts, builder);
        const queue = builder.events.slice().sort(function (a, b) { return a.t - b.t; });
        const start = Date.now();
        let next = 0;
        const timer = setInterval(function () {
            const elapsed = Date.now() - start;
            while (next < queue.length && queue[next].t <= elapsed) queue[next++].fn();
            if (elapsed >= end) clearInterval(timer);
        }, 50);
        const onResize = function () { fitStage(host, ui.stage); };
        fitStage(host, ui.stage);
        root.addEventListener('resize', onResize);

        const handle = {
            language: language,
            destroy: function () {
                clearInterval(timer);
                root.removeEventListener('resize', onResize);
                playing.forEach(function (a) { a.pause(); });
                clips.forEach(function (a) { a.removeAttribute('src'); a.load(); });
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
        hasTopic: function (topic) { return Object.prototype.hasOwnProperty.call(topics, topic); },
        topics: function () { return Object.keys(topics); }
    };
})(typeof window !== 'undefined' ? window : this);
