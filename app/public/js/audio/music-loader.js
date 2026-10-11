/**
 * @fileoverview Punto de entrada ligero de la música: desbloquea el audio en el
 * gesto del usuario y carga el motor (Tone.js incluido) bajo demanda, para no
 * engordar la carga inicial de la página.
 *
 * unlockAudio() debe llamarse DENTRO del manejador del gesto (click/tecla): crea
 * y reanuda el AudioContext al momento, sin esperar a que llegue Tone.js. Safari
 * (también iOS) solo deja sonar un contexto activado así.
 */

let audioContext = null;
let enginePromise = null;
let lifecycleBound = false;

function playSilentBuffer(ctx) {
    // iOS: un buffer mudo reproducido en el gesto deja el contexto realmente activo
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050);
    source.connect(ctx.destination);
    source.start(0);
}

// iPhone/iPad (también iPadOS, que se presenta como Mac con pantalla táctil)
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function resumeIfNeeded() {
    // Safari puede dejarlo 'suspended' o 'interrupted' (otra app de audio, llamada…)
    if (audioContext && audioContext.state !== 'running' && !document.hidden) audioContext.resume().catch(() => { });
}

function bindLifecycle() {
    if (lifecycleBound) return;
    lifecycleBound = true;
    // La música solo suena en el presentador: NO se suspende al perder el foco u ocultarse
    // la pestaña (el proyector sigue mostrando el juego). Al volver, por si Safari la paró:
    document.addEventListener('visibilitychange', resumeIfNeeded);
    // Cualquier gesto posterior reanuda un contexto que Safari haya parado
    document.addEventListener('pointerdown', resumeIfNeeded, { capture: true });
    document.addEventListener('keydown', resumeIfNeeded, { capture: true });
}

/**
 * Crea/reanuda el AudioContext. Llamar en el gesto del usuario; devuelve el contexto o null.
 * Igual que la intro (game-intro-fx.js), que ya suena en Safari: contexto sin
 * opciones (latencyHint o audioSession pueden dejarlo mudo en Safari de escritorio).
 */
export function unlockAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext) {
        // iOS: antes de crear el contexto, que el interruptor de silencio no mate la música
        try {
            if (IS_IOS && navigator.audioSession) navigator.audioSession.type = 'playback';
        } catch { }
        // Un solo AudioContext en la página: el de la intro (game-intro-fx.js) si existe.
        // Safari en macOS se cuelga con dos contextos sonando a la vez.
        const shared = window.XiroGameIntroFx && window.XiroGameIntroFx.ensureAudio ? window.XiroGameIntroFx.ensureAudio() : null;
        audioContext = shared || new AudioContextClass();
    }
    resumeIfNeeded();
    playSilentBuffer(audioContext);
    bindLifecycle();
    return audioContext;
}

export function isAudioUnlocked() {
    return Boolean(audioContext) && audioContext.state === 'running';
}

/** Descarga el motor sin crearlo (p. ej. en tiempo ocioso), para que el gesto no espere. */
export function preloadMusicEngine() {
    return import('./music-engine.js?v=20260922172926').catch(() => null);
}

/**
 * Carga el motor y lo crea sobre el contexto desbloqueado (una sola instancia).
 * @returns {Promise<import('./music-engine.js').MusicEngine>}
 */
export function loadMusicEngine(options) {
    if (!enginePromise) {
        enginePromise = import('./music-engine.js?v=20260922172926')
            .then((mod) => mod.createMusicEngine(audioContext, options).ready)
            .catch((err) => {
                enginePromise = null;
                throw err;
            });
    }
    return enginePromise;
}

/** Libera el motor (fin de partida); el siguiente loadMusicEngine crea uno nuevo. */
export async function disposeMusicEngine() {
    if (!enginePromise) return;
    const pending = enginePromise;
    enginePromise = null;
    try {
        (await pending).dispose();
    } catch { }
}
