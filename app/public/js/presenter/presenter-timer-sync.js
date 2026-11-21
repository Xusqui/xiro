/**
 * @fileoverview El presentador publica su cuenta atrás para el temporizador informativo del móvil:
 * «muestro `value` desde el instante `at`» en hora del servidor (core/server-clock.js). Lo manda
 * al empezar, cada pocos segundos (corrige la deriva de setInterval y llega a quien se reconecte),
 * al pausar y al reanudar. El servidor lo reenvía a los jugadores (sockets/handlers/TimerSyncHandler.js).
 */

import { getSocket } from './presenter-socket-config.js?v=20260922172926';
import { getSessionId, getCurrentQuestionIndex } from './presenter-state.js?v=20260922172926';
import { createServerClock } from '../core/server-clock.js?v=20261121180000';

// Cada cuántos segundos se repite la marca mientras cuenta
export const RESYNC_EVERY_TICKS = 5;

let serverClock = null;

function clock() {
    if (!serverClock) {
        serverClock = createServerClock(getSocket());
        serverClock.sync();
    }
    return serverClock;
}

/**
 * Empieza a medir el reloj del servidor al cargar la página: si esperara a la primera cuenta atrás,
 * la marca de la primera pregunta saldría sin desfase medido.
 */
export function startPresenterClock() {
    clock();
}

function emitAnchor({ roomIdOrPin, questionIndex, value, total, shownSince, paused }) {
    const safeTotal = Math.max(1, Math.round(total));
    const at = Math.round(shownSince + (clock().now() - Date.now()));
    getSocket().emit('presenter-timer-sync', {
        roomIdOrPin,
        questionIndex,
        value: Math.min(safeTotal, Math.max(0, Math.round(value))),
        total: safeTotal,
        at,
        paused: Boolean(paused)
    });
}

/**
 * Publica la marca de la cuenta atrás.
 * @param {Object} countdown
 * @param {number} countdown.value - Segundos que enseña ahora el presentador
 * @param {number} countdown.total - Tiempo de la pregunta (s)
 * @param {number} countdown.shownSince - Instante local (Date.now) desde el que enseña `value`
 * @param {boolean} countdown.paused
 */
export function publishTimerAnchor(countdown) {
    // Sala y pregunta de ahora: si la marca espera a la medición, no se empareja con otra pregunta
    const roomIdOrPin = getSessionId();
    const questionIndex = getCurrentQuestionIndex();
    if (!roomIdOrPin || !Number.isInteger(questionIndex)) return;
    const anchor = { ...countdown, roomIdOrPin, questionIndex };
    const serverClockNow = clock();
    // Aún midiendo: la marca espera a la medición (shownSince no cambia, así que sigue siendo exacta)
    if (serverClockNow.isSynced()) emitAnchor(anchor);
    else serverClockNow.ready.then(() => emitAnchor(anchor));
}
