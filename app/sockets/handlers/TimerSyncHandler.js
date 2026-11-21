/**
 * @fileoverview Temporizador informativo del móvil, sincronizado con el del presentador (la fuente
 * de verdad). Dos eventos:
 *
 * - 'clock-sync' (cualquier socket, con ack): responde { serverTime }. Presentador y móvil miden con
 *   él su desfase con el reloj del servidor, así una hora «del servidor» significa lo mismo en los dos.
 * - 'presenter-timer-sync' (solo el presentador): su marca «muestro `value` desde el instante `at`»
 *   (hora del servidor), al empezar, pausar, reanudar y cada pocos segundos. Se reenvía como
 *   'timer-sync' a la sala de jugadores; el móvil cuenta solo a partir de ella.
 *
 * Nada de esto decide cuándo se cierra la pregunta: eso sigue en TimerManager.
 */

'use strict';

const { validateSocket, schemas } = require('../../validation');
const logger = require('../../config/logger');

const THROTTLE_WINDOW_MS = 10000;
const THROTTLE_MAX_EVENTS = 20;
// Una marca más lejos que esto de la hora del servidor es un reloj sin sincronizar: no se reenvía
const MAX_ANCHOR_SKEW_MS = 60000;

/**
 * Cuenta los eventos de un tipo por socket y ventana de tiempo. El socket vive en un solo worker,
 * así que basta con guardarlo en socket.data.
 * @returns {boolean} true si el evento entra en el límite
 */
function withinLimit(socket, key, nowMs) {
    socket.data.timerSyncLimits = socket.data.timerSyncLimits || {};
    const limits = socket.data.timerSyncLimits;
    const entry = limits[key];
    if (!entry || nowMs - entry.start > THROTTLE_WINDOW_MS) {
        limits[key] = { start: nowMs, count: 1 };
        return true;
    }
    entry.count += 1;
    return entry.count <= THROTTLE_MAX_EVENTS;
}

/**
 * Marca validada y lista para los jugadores, o null si hay que descartarla.
 * @param {Object} data - Payload del presentador
 * @param {Map} activeGames
 * @param {number} nowMs - Hora del servidor
 * @returns {{roomId: string, anchor: Object}|null}
 */
function acceptAnchor(data, activeGames, nowMs) {
    const { valid, value } = validateSocket(schemas.presenterTimerSync, data);
    if (!valid) return null;
    if (Math.abs(value.at - nowMs) > MAX_ANCHOR_SKEW_MS) return null;

    const roomId = String(value.roomIdOrPin);
    const game = activeGames.get(roomId);
    // La marca de una pregunta anterior (llega tarde) no debe pintar la nueva
    if (game && game.currentIndex !== value.questionIndex) return null;

    const { questionIndex, value: seconds, total, at, paused } = value;
    return { roomId, anchor: { questionIndex, value: seconds, total, at, paused } };
}

/**
 * Registra 'clock-sync' y 'presenter-timer-sync' en un socket.
 * @param {Object} socket - Socket.IO
 * @param {Object} deps
 * @param {Object} deps.io - Servidor Socket.IO (adaptador Redis: llega a todos los workers)
 * @param {Map} deps.activeGames - Partidas en curso (globalState)
 * @param {function(Object, string, string): boolean} deps.assertIsPresenter - Comprueba el rol
 * @param {function(): number} [deps.now=Date.now] - Reloj (inyectable en tests)
 */
function registerTimerSyncEvents(socket, { io, activeGames, assertIsPresenter, now = Date.now }) {
    socket.on('clock-sync', (_data, ack) => {
        if (typeof ack !== 'function' || !withinLimit(socket, 'clock', now())) return;
        ack({ serverTime: now() });
    });

    socket.on('presenter-timer-sync', data => {
        if (!data || typeof data !== 'object') return;
        if (!assertIsPresenter(socket, data.roomIdOrPin, 'presenter-timer-sync-error')) return;
        const nowMs = now();
        if (!withinLimit(socket, 'anchor', nowMs)) return;

        const accepted = acceptAnchor(data, activeGames, nowMs);
        if (!accepted) {
            logger.debug('presenter-timer-sync descartado', { socketId: socket.id });
            return;
        }
        io.to(`${accepted.roomId}:players`).emit('timer-sync', accepted.anchor);
    });
}

module.exports = { registerTimerSyncEvents };
