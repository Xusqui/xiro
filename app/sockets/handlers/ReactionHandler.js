/**
 * @fileoverview Reacciones con emoji en directo.
 *
 * - 'send-reaction' { r } (jugador, sin ack): la identidad sale de socket.data. Pasa por
 *   el límite por socket, el estado de la sala y ReactionPolicy; lo que se acepta va al
 *   buffer, que emite 'reactions' { c: { <id>: n } } agrupado a `<room>:presenter`
 *   (presentador, TV y mando). Lo rechazado se descarta en silencio.
 * - 'get-reactions' (ack): { ok, enabled, set } de la sala del socket.
 * - 'set-reactions' { enabled } (ack, solo sala del presentador): silencia o reactiva y
 *   avisa a toda la sala con 'reactions-state' { enabled, set }.
 * Anónimas y efímeras: no se guardan ni puntúan.
 */

'use strict';

const { evaluateReaction } = require('../../domain/services/ReactionPolicy');
const { resolveTeamDone } = require('../utils/ReactionTeamGate');
const logger = require('../../config/logger');

const PRESENTER_NICKNAME = 'HOST';

function isPresenterSocket(socket, roomId) {
    return socket.rooms?.has(`${roomId}:presenter`) === true;
}

function isPlayerSocket(socket) {
    const { roomId, playerId, nickname, isRemote } = socket.data || {};
    if (!roomId || !playerId || isRemote || nickname === PRESENTER_NICKNAME) return false;
    return !isPresenterSocket(socket, roomId);
}

/**
 * @param {Object} deps
 * @param {Object} deps.io
 * @param {import('../utils/ReactionsState').ReactionsState} deps.state
 * @param {import('../utils/ReactionThrottle').ReactionThrottle} deps.throttle
 * @param {{ add: Function }} deps.buffer
 * @param {Map} deps.activeGames
 * @param {Map} deps.players
 */
function createReactionHandlers({ io, state, throttle, buffer, activeGames, players }) {
    async function handleSendReaction(socket, data) {
        if (!isPlayerSocket(socket) || typeof data?.r !== 'string') return;
        if (!throttle.take(socket.id)) return;
        const { roomId, playerId } = socket.data;
        try {
            const game = activeGames.get(roomId) || null;
            const player = players.get(playerId) || null;
            const verdict = evaluateReaction({
                state: await state.get(roomId),
                reaction: data.r,
                game,
                player,
                teamDone: await resolveTeamDone({ game, player, roomId })
            });
            if (verdict.ok) buffer.add(roomId, data.r);
        } catch (error) {
            logger.warn('Reacción descartada por error', { socketId: socket.id, error: error.message });
        }
    }

    async function handleGetReactions(socket, _data, callback) {
        const reply = typeof callback === 'function' ? callback : () => {};
        const roomId = socket.data?.roomId;
        if (!roomId) return reply({ ok: false, reason: 'no-room' });
        try {
            return reply({ ok: true, ...(await state.get(roomId)) });
        } catch (error) {
            logger.warn('No se pudo leer el estado de las reacciones', { roomId, error: error.message });
            return reply({ ok: false, reason: 'error' });
        }
    }

    async function handleSetReactions(socket, data, callback) {
        const reply = typeof callback === 'function' ? callback : () => {};
        const roomId = socket.data?.roomId;
        if (typeof data?.enabled !== 'boolean') return reply({ ok: false, reason: 'invalid-payload' });
        if (!roomId || !isPresenterSocket(socket, roomId)) return reply({ ok: false, reason: 'not-presenter' });
        try {
            const next = await state.setEnabled(roomId, data.enabled);
            io.to(roomId).emit('reactions-state', next);
            logger.info('Reacciones con emoji cambiadas por el presentador', { roomId, enabled: next.enabled });
            return reply({ ok: true, ...next });
        } catch (error) {
            logger.warn('No se pudo cambiar el estado de las reacciones', { roomId, error: error.message });
            return reply({ ok: false, reason: 'error' });
        }
    }

    function handleDisconnect(socket) {
        throttle.forget(socket.id);
    }

    return { handleSendReaction, handleGetReactions, handleSetReactions, handleDisconnect };
}

/** Registra los eventos de reacciones en un socket recién conectado. */
function registerReactionEvents(socket, handlers) {
    socket.on('send-reaction', data => handlers.handleSendReaction(socket, data));
    socket.on('get-reactions', (data, callback) => handlers.handleGetReactions(socket, data, callback));
    socket.on('set-reactions', (data, callback) => handlers.handleSetReactions(socket, data, callback));
    socket.on('disconnect', () => handlers.handleDisconnect(socket));
}

module.exports = { createReactionHandlers, registerReactionEvents };
