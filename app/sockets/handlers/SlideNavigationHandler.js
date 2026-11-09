/**
 * @fileoverview Navegación adelante/atrás de los juegos personalizados.
 *
 * - 'previous-slide' (presentador): vuelve a la diapositiva anterior en revisión.
 *   Avanzar en revisión usa el 'next-question' de siempre (AdvanceQuestionUseCase).
 * - 'get-review-state' (jugador, con ack): la diapositiva revisada y, si es una
 *   pregunta, la solución y su propio resultado. Lo pide al recibir
 *   'question-review' y al reconectar en revisión.
 *   Respuesta: { ok: true, question, currentIndex, totalQuestions, reveal, result } | { ok: false, reason }.
 */

'use strict';

const NavigateSlideUseCase = require('../../application/use-cases/NavigateSlideUseCase');
const { buildPlayerReviewState } = require('../utils/ReviewPlayerState');
const { pushSessionLog } = require('../../services/game-logs.service');
const logger = require('../../config/logger');

/**
 * Crea el handler del evento 'previous-slide'. Vuelve a la diapositiva anterior en modo revisión (juegos
 * personalizados).
 * @param {Object} dependencies - Maps de globalState, io y servicios (ver socket.handlers.js)
 * @returns {function(socket, roomIdOrPin): Promise<void>} Handler
 */
function createPreviousSlideHandler(dependencies) {
    return async function handlePreviousSlide(socket, roomIdOrPin) {
        const result = await new NavigateSlideUseCase().execute({
            socket,
            data: { roomIdOrPin, direction: 'back' },
            dependencies
        });

        if (!result.success) {
            socket.emit('previous-slide-error', {
                message: result.reason || 'Error al volver a la diapositiva anterior',
                ...(result.code && { code: result.code })
            });
            return;
        }

        pushSessionLog(String(roomIdOrPin), {
            level: 'info',
            event: 'slide-reviewed',
            actor: 'presenter',
            message: 'Presenter went back to a previous slide',
            data: { questionIndex: result.questionIndex }
        });
    };
}

/**
 * Crea el handler del evento 'get-review-state'. Devuelve por el ACK el estado de revisión de la sala del socket.
 * @param {Object} dependencies - Maps de globalState, io y servicios (ver socket.handlers.js)
 * @returns {function(socket, _data, callback): Promise<void>} Handler
 */
function createReviewStateHandler(dependencies) {
    const { activeGames, teamConfigs } = dependencies;

    return async function handleGetReviewState(socket, _data, callback) {
        const reply = typeof callback === 'function' ? callback : () => {};
        // JoinGameCommand guarda roomId; ReconnectionService, pin (mismo sessionId)
        const room = socket?.data?.roomId || socket?.data?.pin;
        const nickname = socket?.data?.nickname;
        if (!room || !nickname) return reply({ ok: false, reason: 'invalid-payload' });

        const roomId = String(room);
        const game = activeGames.get(roomId);
        if (!game) return reply({ ok: false, reason: 'game-not-found' });
        if (!game.reviewMode) return reply({ ok: false, reason: 'not-in-review' });

        try {
            const state = await buildPlayerReviewState({
                roomId,
                game,
                nickname,
                teamConfig: teamConfigs?.get(roomId)
            });
            return reply({ ok: true, ...state });
        } catch (error) {
            logger.error('Error al preparar la revisión del jugador', { socketId: socket?.id, error: error.message });
            return reply({ ok: false, reason: 'error' });
        }
    };
}

/**
 * Registra los eventos de navegación en el socket.
 *
 * @param {Object} socket
 * @param {Object} ctx
 * @param {Object} ctx.handlers - handlePreviousSlide y handleGetReviewState
 * @param {Function} ctx.assertIsPresenter - Guarda de rol de socket.handlers.js
 */
function registerSlideNavigationEvents(socket, { handlers, assertIsPresenter }) {
    socket.on('previous-slide', roomIdOrPin => {
        if (assertIsPresenter(socket, roomIdOrPin, 'previous-slide-error')) {
            handlers.handlePreviousSlide(socket, roomIdOrPin);
        }
    });
    socket.on('get-review-state', (data, callback) => handlers.handleGetReviewState(socket, data, callback));
}

module.exports = {
    createPreviousSlideHandler,
    createReviewStateHandler,
    registerSlideNavigationEvents
};
