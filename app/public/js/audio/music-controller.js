/**
 * @fileoverview Controlador de la música de una partida: recibe sucesos del juego
 * (lobby, pregunta, respuestas, revelación, podio…), los pasa a la máquina de estados
 * musical (XState) y esta mueve MusicEngine. El reloj de la pregunta (hora del servidor,
 * respuestas y arco de la partida → tensión) vive en music-question-clock.js.
 *
 * No sabe nada de sockets ni del DOM (eso es el puente del presentador). El motor, la
 * máquina y XState se cargan bajo demanda en el primer gesto del usuario; los sucesos
 * de antes se guardan y se aplican al arrancar.
 */

import { unlockAudio, loadMusicEngine, preloadMusicEngine } from './music-loader.js?v=20260922172926';
import { trace } from './music-trace.js?v=20260922172926';
import { normalizeMusicSettings, engineOptions, applyMix } from './music-apply-settings.js?v=20260922172926';
import { createQuestionClock } from './music-question-clock.js?v=20260922172926';

// Sucesos que fijan la escena (el último se aplica al arrancar el motor)
const SCENE_EVENTS = new Set(['LOBBY', 'BOARD', 'PRE_QUESTION', 'QUESTION', 'SLIDE', 'PODIUM', 'STOP']);

/** Motor (Tone y muestras), XState y la máquina musical, bajo demanda. */
function loadDependencies(engineOpts) {
    return Promise.all([
        loadMusicEngine(engineOpts),
        import('../../vendor/xstate/xstate-5.26.0.umd.min.js?v=20260922172926'),
        import('./music-machine.js?v=20260922172926')
    ]);
}

/**
 * Motor listo para la partida con los ajustes del admin (sonidos, tempo, semilla, mezcla,
 * tic-tac y volumen; opts.volume, si no es null, es el que el presentador movió después).
 */
async function createConfiguredEngine(opts, state) {
    const settings = normalizeMusicSettings(await opts.settings());
    // Misma partida, misma música (salvo semilla fija del admin: siempre la misma)
    const [engine] = await loadDependencies(engineOptions(settings, opts.seed()));
    trace('motor listo' + (engine.bank ? ' (con muestras)' : ' (sin muestras)'));
    applyMix(engine, settings);
    engine.setVolume(opts.volume === null ? settings.volume : opts.volume);
    engine.setPaused(state.paused);
    engine.setSilenced(state.silenced);
    return engine;
}

function preloadDependencies() {
    void preloadMusicEngine();
    void import('../../vendor/xstate/xstate-5.26.0.umd.min.js?v=20260922172926').catch(() => null);
}

/**
 * Los ajustes del admin (opts.settings) mandan: sonidos, tempo, semilla, mezcla, tic-tac
 * y volumen inicial (opts.volume, si no es null, es el que el presentador movió después).
 * @param {{ seed: () => string, settings: () => Promise<object|null>, volume: number|null,
 *           paused: boolean, onEngineEvent?: (type: string, detail: any) => void }} opts
 */
export function createMusicController(opts) {
    let engine = null;
    let actor = null;
    let starting = null;
    let pending = null;          // último suceso de escena antes de arrancar
    let trivial = false;
    let paused = Boolean(opts.paused);
    let introPlaying = false;    // durante la intro, la música calla (suena la de la intro)
    const clock = createQuestionClock(() => engine);

    function actions() {
        const calm = (name) => () => {
            clock.stop();
            engine.setSilenced(introPlaying);
            engine.setScene(name);
        };
        // Sin reloj de pregunta y con la salida abierta (aunque sonara la intro)
        const loud = (play) => () => {
            clock.stop();
            engine.setSilenced(false);
            play();
        };
        return {
            stopMusic: calm('idle'),
            playLobby: calm('lobby'),
            playBoard: calm('board'),
            playLeaderboard: calm('leaderboard'),
            // Pantalla de puntuación aleatoria: la pregunta entra ya (tensión 0, sin reloj)
            playPreQuestion: loud(() => {
                engine.setQuestionContext(null);
                engine.setTension(0);
                engine.setScene('question');
            }),
            playQuestion: ({ event }) => {
                engine.setSilenced(Boolean(event.hasAudio));
                engine.setQuestionContext({ final: clock.arc.final });
                engine.setTension(clock.tension());
                engine.setScene('question');
                clock.start();
            },
            // La escena que sigue entra en el golpe: la música no se corta
            playReveal: loud(() => engine.triggerReveal(trivial ? 'board' : 'leaderboard')),
            playPodium: loud(() => engine.triggerPodium()),
            pauseTension: () => clock.stop(),
            resumeTension: () => clock.start()
        };
    }

    function onEngineEvent(type, detail) {
        // Tras el stinger: al marcador (o al tablero en el Trivial)
        if (type === 'revealDone' && actor) actor.send({ type: trivial ? 'BOARD' : 'REVEAL_DONE' });
        if (opts.onEngineEvent) opts.onEngineEvent(type, detail);
    }

    async function start() {
        engine = await createConfiguredEngine(opts, { paused, silenced: introPlaying });
        engine.on(onEngineEvent);
        actor = self.XState.createActor(self.XiroMusic.machine.createMusicMachine(self.XState, actions())).start();
        if (pending) actor.send(pending);
        pending = null;
    }

    function send(event) {
        trace(`suceso ${event.type}${actor ? '' : ' (pendiente)'}`);
        if (event.type !== 'TIMER_PAUSE' && event.type !== 'TIMER_RESUME') introPlaying = false;
        if (actor) actor.send(event);
        else if (SCENE_EVENTS.has(event.type)) pending = event;
    }

    return {
        /** Llamar DENTRO de un gesto del usuario: desbloquea el audio y arranca (una vez). */
        unlock() {
            unlockAudio();
            if (!starting) {
                starting = start().catch((err) => {
                    starting = null;
                    console.warn('Música no disponible:', err);
                });
            }
            return starting;
        },
        /** Descarga el código del motor en segundo plano (las muestras van con el gesto). */
        preload: preloadDependencies,
        lobby: () => send({ type: 'LOBBY' }),
        /**
         * Intro de la partida (logo y 3-2-1): la música calla, que suena la intro. Solo se
         * cierra la salida: la escena y el reloj siguen y la pregunta entra con crossfade.
         */
        intro() {
            trace('intro: silencio');
            introPlaying = true;
            if (engine) engine.setSilenced(true);
        },
        board() {
            trivial = true;
            send({ type: 'BOARD' });
        },
        /**
         * Pantalla de puntuación aleatoria antes de la pregunta: se aprovecha para la
         * transición; al llegar la pregunta solo arranca su reloj.
         */
        preQuestion() {
            clock.clear();
            send({ type: 'PRE_QUESTION' });
        },
        slide() {
            clock.clear();
            send({ type: 'SLIDE' });
        },
        /**
         * q: { durationMs, startedAt?, serverNow?, hasAudio, index?, total? } (horas del
         * servidor en ms; index 0-based y total de preguntas, para el arco de la partida)
         */
        question(q) {
            clock.sync(q.serverNow);
            clock.begin(q);
            send({ type: 'QUESTION', hasAudio: Boolean(q.hasAudio), durationMs: q.durationMs });
        },
        /** Han respondido `count` de `total` jugadores: sube la tensión y suena una campana. */
        answered(count, total) {
            const ratio = clock.answered(count, total);
            if (ratio !== null && engine) engine.react('answer', ratio);
        },
        /** Ha entrado un jugador al lobby (`count`: los que hay ya). */
        playerJoined(count) {
            if (engine) engine.react('join', count);
        },
        /** Dados del Trivial. */
        dice() {
            if (engine) engine.react('dice');
        },
        timerPaused(data) {
            clock.sync(data.serverNow);
            clock.pause();
            send({ type: 'TIMER_PAUSE' });
        },
        timerResumed(data) {
            clock.sync(data.serverNow);
            clock.resume(typeof data.remainingTime === 'number' ? data.remainingTime * 1000 : null);
            send({ type: 'TIMER_RESUME' });
        },
        reveal: () => send({ type: 'REVEAL' }),
        podium: () => send({ type: 'PODIUM' }),
        stop: () => send({ type: 'STOP' }),
        setPaused(on) {
            paused = Boolean(on);
            if (engine) engine.setPaused(paused);
        },
        setVolume(v) {
            opts.volume = v;
            if (engine) engine.setVolume(v);
        },
        /** ¿Suena la música? (entonces el tic-tac final lo pone ella y no bip.wav) */
        isPlaying() {
            return Boolean(engine) && !paused && engine.sceneName !== 'idle';
        },
        /** ¿La música marcará la salida del 3º, 2º y 1º en el podio? */
        drivesPodium() {
            return Boolean(engine) && !paused;
        }
    };
}
