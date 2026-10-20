/**
 * @fileoverview Tensión de la pregunta, en funciones puras:
 *  - progreso 0..1 a partir del reloj del SERVIDOR (todos los clientes a la vez),
 *    con las pausas del temporizador;
 *  - curva de tensión (casi plana al principio, se dispara en el último 30 %);
 *  - mapa tensión → parámetros musicales (capas, charles, filtro, tempo, armonía)
 *    y avisos de tiempo (subida de ruido en los 5 s finales, tic-tac en los 3).
 *
 * Estado de una pregunta (ms en reloj del servidor):
 *   { startedAt, durationMs, pausedAt: number|null }
 *
 * Export dual (Jest con require; navegador en self.XiroMusic.tension).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.tension = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const clamp01 = v => Math.max(0, Math.min(1, v));

    // Punto de inflexión: hasta el 70 % del tiempo la tensión solo llega a 0,35
    const KNEE_PROGRESS = 0.7;
    const KNEE_TENSION = 0.35;

    const RISER_SECONDS = 5;
    const TICK_SECONDS = 3;
    const MAX_TEMPO_BOOST = 0.12; // +12 % de tempo con la tensión al máximo

    /** Desfase reloj servidor − reloj local (ms), medido al recibir un mensaje con serverNow. */
    function clockOffset(serverNow, clientNow) {
        return Number(serverNow) - Number(clientNow);
    }

    /** Progreso 0..1 de la pregunta; durante una pausa el tiempo se congela. */
    function questionProgress(state, serverNow) {
        if (!state || !(state.durationMs > 0)) return 0;
        const now = state.pausedAt != null ? state.pausedAt : serverNow;
        return clamp01((now - state.startedAt) / state.durationMs);
    }

    function remainingMs(state, serverNow) {
        if (!state || !(state.durationMs > 0)) return 0;
        return Math.max(0, state.durationMs * (1 - questionProgress(state, serverNow)));
    }

    function pauseQuestion(state, serverNow) {
        return Object.assign({}, state, { pausedAt: serverNow });
    }

    /**
     * Reanudar: recoloca el inicio para que quede `serverRemainingMs` (lo que manda el
     * servidor en timer-resumed) o, si no llega, lo que quedaba al pausar.
     */
    function resumeQuestion(state, serverNow, serverRemainingMs) {
        const remaining = serverRemainingMs != null ? serverRemainingMs : remainingMs(state, serverNow);
        return { startedAt: serverNow - (state.durationMs - remaining), durationMs: state.durationMs, pausedAt: null };
    }

    /** Curva de tensión continua y creciente: suave hasta el 70 % y acelerada después. */
    function tensionCurve(progress) {
        const p = clamp01(progress);
        if (p <= KNEE_PROGRESS) return KNEE_TENSION * Math.pow(p / KNEE_PROGRESS, 1.6);
        return KNEE_TENSION + (1 - KNEE_TENSION) * Math.pow((p - KNEE_PROGRESS) / (1 - KNEE_PROGRESS), 1.3);
    }

    /** Rampa 0..1 entre dos umbrales de tensión (para que las capas entren suaves). */
    function ramp(t, from, to) {
        return clamp01((t - from) / (to - from));
    }

    /**
     * Parámetros musicales para una tensión t (0..1).
     * Capas: pad y piano siempre → bajo → charles en corcheas → en semicorcheas → campanas
     * → metales. El piano pasa de acorde partido (calma) a acordes a corcheas (empuje).
     */
    function tensionParams(t) {
        const x = clamp01(t);
        return {
            layers: {
                pad: 1,
                piano: 0.45 + 0.35 * ramp(x, 0.3, 0.7),
                bass: ramp(x, 0.1, 0.3),
                drums: 0.55 + 0.45 * ramp(x, 0.3, 0.6),
                arp: ramp(x, 0.6, 0.75),
                brass: 0.8 * ramp(x, 0.8, 0.95),
                melody: 0
            },
            drums: x < 0.3 ? 'qPulse' : x < 0.55 ? 'q8' : 'q16',
            bass: x < 0.45 ? 'pedal' : x < 0.7 ? 'pop' : 'octave',
            arp: x < 0.6 ? 'none' : 'sparkle',
            brass: x < 0.8 ? 'none' : 'stabs',
            piano: x < 0.45 ? 'arp' : 'pulse',
            // Paso bajo del pad y las campanas: de 500 Hz a 5 kHz (exponencial, como el oído)
            filterHz: Math.round(500 * Math.pow(10, x)),
            tempoFactor: 1 + MAX_TEMPO_BOOST * x * x,
            harmony: x > 0.7 ? 'tense' : 'calm'
        };
    }

    /** Avisos por tiempo restante: subida de ruido (≤ 5 s) y tic-tac (≤ 3 s). */
    function timeCues(remainingSeconds) {
        return {
            riser: remainingSeconds > 0 && remainingSeconds <= RISER_SECONDS,
            tick: remainingSeconds > 0 && remainingSeconds <= TICK_SECONDS
        };
    }

    return {
        RISER_SECONDS,
        TICK_SECONDS,
        MAX_TEMPO_BOOST,
        KNEE_PROGRESS,
        KNEE_TENSION,
        clockOffset,
        questionProgress,
        remainingMs,
        pauseQuestion,
        resumeQuestion,
        tensionCurve,
        tensionParams,
        timeCues
    };
});
