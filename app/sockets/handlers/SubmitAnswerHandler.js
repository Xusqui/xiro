/**
 * @fileoverview Submit Answer Handler - Refactorizado con Use Case pattern
 * Simplificado de 95 líneas a ~25 líneas usando SubmitAnswerUseCase
 */

const SubmitAnswerUseCase = require('../../application/use-cases/SubmitAnswerUseCase');
const { pushSessionLog } = require('../../services/game-logs.service');

module.exports = function createSubmitAnswerHandler(dependencies) {
    const {
        players,
        socketToPlayer,
        activeGames,
        teamConfigs,
        io,
        syncBus,
        clearGameTimer,
        ackManager,
        presenterNotification
    } = dependencies;

    // Instanciar Use Case una sola vez
    const submitAnswerUseCase = new SubmitAnswerUseCase();

    return async function handleSubmitAnswer(socket, data, callback) {
        const logger = require('../../config/logger');
        const ack = typeof callback === 'function' ? callback : null;
        const playerId = socketToPlayer.get(socket.id);

        logger.debug('Submit answer handler called', {
            socketId: socket.id,
            playerId,
            answerType: data?.answerType,
            hasSelectedIndices: Array.isArray(data?.selectedIndices),
            selectedIndicesLength: data?.selectedIndices?.length,
            nickname: data?.nickname,
            pin: data?.pin,
            sessionId: data?.sessionId
        });

        try {
            const sessionId = data?.sessionId || data?.pin;
            if (sessionId) {
                pushSessionLog(sessionId, {
                    level: 'info',
                    event: 'answer-submitted',
                    actor: data?.nickname || playerId || null,
                    message: 'Answer payload received',
                    data: {
                        answerType: data?.answerType || null,
                        hasMultiSelection: Array.isArray(data?.selectedIndices),
                        selectedCount: Array.isArray(data?.selectedIndices) ? data.selectedIndices.length : 0
                    }
                });
            }

            // Ejecutar Use Case (incluye validación, rate limiting, comando, respuesta)
            const result = await submitAnswerUseCase.execute({
                socket,
                data,
                callback: ack,
                dependencies: {
                    activeGames,
                    players,
                    teamConfigs,
                    io,
                    syncBus,
                    clearGameTimer,
                    ackManager,
                    presenterNotification
                },
                playerId
            });

            logger.debug('Submit answer result', {
                socketId: socket.id,
                success: result?.success,
                reason: result?.reason
            });

            // El Use Case ya maneja el callback y las emisiones de eventos
            // No hay nada más que hacer aquí

        } catch (error) {
            logger.error('Error in submit-answer handler', {
                error: error.message,
                stack: error.stack
            });
            socket.emit('answer-error', { message: 'Error al procesar respuesta', code: 'SUBMIT_ANSWER_FAILED' });
            if (ack) ack({ ok: false, reason: 'server-error' });
        }
    };
};
