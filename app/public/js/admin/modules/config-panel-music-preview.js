/**
 * @fileoverview Pestaña «Música»: escucha previa. Arranca el mismo motor que el
 * presentador (js/audio, bajo demanda) con los valores del formulario, guardados o
 * no, y los aplica en directo al cambiarlos. Escenas: sala de espera, pregunta de
 * 20 s (tensión creciente, tic-tac y revelación hacia el marcador) y marcador.
 * Se apaga sola cuando la pestaña deja de estar en pantalla.
 * Depende de: config-panel-music-controls.js (_musicT, _musicOptionLabel).
 */

const musicPreview = (() => {
    const QUESTION_MS = 20000;
    const TENSION_SAMPLE_MS = 250;
    const UPDATE_DELAY_MS = 200;
    let loading = null; // promesa de los módulos
    let mods = null; // módulos ya cargados (para desbloquear el audio dentro del gesto)
    let engine = null;
    let state = 'idle';
    let scene = 'lobby';
    let settings = null;
    let seed = null;
    let frame = 0;
    let questionTimer = null;
    let updateTimer = null;

    const byId = id => document.getElementById(id);

    /** Descarga el código del motor (sin muestras ni audio) para que el clic no espere. */
    function warm() {
        if (!loading) {
            // Rutas literales: middlewares/assetVersioning.js les pone ?v=<hash> al servir
            loading = Promise.all([import('/js/audio/music-loader.js'), import('/js/audio/music-apply-settings.js')])
                .then(([loader, apply]) => {
                    mods = { loader, apply };
                    return mods;
                })
                .catch(err => {
                    loading = null;
                    throw err;
                });
        }
        return loading;
    }

    function setState(next, text) {
        state = next;
        const player = byId('xm-player');
        if (!player) return;
        player.dataset.state = next;
        const busy = next === 'playing' || next === 'loading';
        const button = player.querySelector('[data-music-action="toggle-preview"]');
        button.innerHTML = `<i class="fas ${busy ? 'fa-stop' : 'fa-play'}" aria-hidden="true"></i> <span>${_musicT(busy ? 'player.stop' : 'player.play')}</span>`;
        const status = byId('xm-player-status');
        if (status.textContent !== text) status.textContent = text;
    }

    function describe(s) {
        const sounds = self.XiroMusic.settings.SOUND_GROUPS.map(g => _musicOptionLabel(g, s.sounds[g])).join(' · ');
        return _musicT('player.playing', { sounds, bpm: s.tempo });
    }

    const seedFor = s =>
        s.seedMode === 'fixed' ? s.seed : seed || 'preview-' + Math.floor(Math.random() * 0xffffff).toString(36);

    function clearQuestion() {
        clearInterval(questionTimer);
        questionTimer = null;
    }

    function selectScene(name) {
        scene = name;
        const radio = document.querySelector(`input[name="xm-scene"][value="${name}"]`);
        if (radio) radio.checked = true;
    }

    /** Pregunta simulada: tensión con el reloj real, tic-tac final y revelación al marcador. */
    function playQuestion() {
        const T = self.XiroMusic.tension;
        const question = { startedAt: Date.now(), durationMs: QUESTION_MS, pausedAt: null };
        engine.setTension(0);
        engine.setScene('question');
        engine.startQuestionClock(QUESTION_MS);
        questionTimer = setInterval(() => {
            const progress = T.questionProgress(question, Date.now());
            engine.setTension(T.tensionCurve(progress));
            if (progress < 1) return;
            clearQuestion();
            engine.triggerReveal('leaderboard');
            selectScene('leaderboard');
        }, TENSION_SAMPLE_MS);
    }

    function playScene() {
        clearQuestion();
        engine.stopQuestionClock();
        if (scene === 'question') playQuestion();
        else engine.setScene(scene);
    }

    function drawWave() {
        const canvas = byId('xm-wave');
        if (!canvas || !engine) return;
        const ctx = canvas.getContext('2d');
        const samples = engine.debug.mixer.waveform.getValue();
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = getComputedStyle(canvas).color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        samples.forEach((v, i) => {
            const x = (i / (samples.length - 1)) * width;
            const y = (1 - (v + 1) / 2) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    /** Mientras suena: onda en la barra; si la pestaña ya no está, se apaga del todo. */
    function loop() {
        cancelAnimationFrame(frame);
        if (!byId('xm-player')) {
            teardown();
            return;
        }
        drawWave();
        if (state === 'playing') frame = requestAnimationFrame(loop);
    }

    async function start(raw) {
        setState('loading', _musicT('player.loading'));
        try {
            const m = await warm();
            m.loader.unlockAudio();
            settings = self.XiroMusic.settings.normalize(raw);
            seed = seedFor(settings);
            engine = await m.loader.loadMusicEngine(m.apply.engineOptions(settings, seed));
            if (state !== 'loading') return; // se paró mientras cargaba
            await m.apply.applyMusicSettings(engine, settings, seed);
            engine.setVolume(settings.volume);
            engine.setPaused(false);
            playScene();
            setState('playing', describe(settings));
            loop();
        } catch (err) {
            console.warn('Escucha previa no disponible:', err);
            setState('error', _musicT('player.error'));
        }
    }

    function stop() {
        clearQuestion();
        clearTimeout(updateTimer);
        cancelAnimationFrame(frame);
        if (engine) {
            engine.stopQuestionClock();
            engine.setScene('idle');
        }
        seed = null;
        setState('idle', _musicT('player.idle'));
    }

    function teardown() {
        stop();
        engine = null;
        if (mods) void mods.loader.disposeMusicEngine();
    }

    return {
        warm: () => warm().catch(() => null),
        /** Escuchar / parar. Llamar DENTRO del clic: Safari solo deja sonar tras un gesto. */
        toggle(raw) {
            if (state === 'playing' || state === 'loading') return stop();
            if (mods) mods.loader.unlockAudio();
            return start(raw);
        },
        setScene(name) {
            scene = name;
            if (engine && state === 'playing') playScene();
        },
        /** Cambios del formulario, en directo (con un pequeño margen al arrastrar). */
        update(raw) {
            if (!engine || state !== 'playing') return;
            clearTimeout(updateTimer);
            updateTimer = setTimeout(() => {
                settings = self.XiroMusic.settings.normalize(raw);
                if (settings.seedMode === 'fixed') seed = settings.seed;
                engine.setVolume(settings.volume);
                void mods.apply.applyMusicSettings(engine, settings, seed).then(() => {
                    if (state === 'playing') setState('playing', describe(settings));
                });
            }, UPDATE_DELAY_MS);
        },
        stop,
        teardown
    };
})();
