/**
 * @fileoverview Next Question and Manual Points Handlers (REFACTORED with Use Cases)
 */

const AdvanceQuestionUseCase = require('../../application/use-cases/AdvanceQuestionUseCase');
const { validateSocket, schemas } = require('../../validation');
const { roundScore } = require('../../domain/services/ScoringService');
const { revealAnswer } = require('../utils/GameEndManager');
const GameStateUpdateService = require('../../domain/services/GameStateUpdateService');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');
const { pushSessionLog } = require('../../services/game-logs.service');

/**
 * Next Question Handler (Use Case Pattern)
 * Delega toda la lógica de negocio a AdvanceQuestionUseCase
 */
function createNextQuestionHandler(dependencies) {
    return async function handleNextQuestion(socket, roomIdOrPin) {
        logger.info('📥 next-question event received', {
            roomIdOrPin,
            socketId: socket.id
        });

        // Crear instancia del Use Case
        const useCase = new AdvanceQuestionUseCase();

        // Ejecutar con contexto completo
        const result = await useCase.execute({
            socket,
            data: { roomIdOrPin },
            dependencies
        });

        logger.info('📤 next-question result', {
            success: result.success,
            reason: result.reason
        });

        if (result.success) {
            const roomId = String(roomIdOrPin);
            const game = dependencies.activeGames.get(roomId);
            const currentQuestion = game?.questions?.[game?.currentIndex] || {};
            pushSessionLog(roomId, {
                level: 'info',
                event: 'question-started',
                actor: 'presenter',
                message: 'Presenter advanced to next question',
                data: {
                    questionIndex: game?.currentIndex,
                    questionType: currentQuestion.question_type || currentQuestion.type || null
                }
            });
        }

        // Enviar respuesta al presentador
        if (!result.success) {
            socket.emit('next-question-error', {
                message: result.reason || 'Error al avanzar pregunta',
                ...(result.code && { code: result.code })
            });
        }
    };
}

/**
 * Reveal Answer Handler (manual desde presentador)
 */
function createRevealAnswerHandler(dependencies) {
    const { activeGames, io, clearGameTimer } = dependencies;

    return async function handleRevealAnswer(socket, roomIdOrPin) {
        const validation = validateSocket(schemas.nextQuestion, { roomIdOrPin });
        if (!validation.valid) {
            socket.emit('reveal-answer-error', { message: validation.error });
            return;
        }

        const roomId = String(roomIdOrPin);
        const game = activeGames.get(roomId);
        if (!game) {
            socket.emit('reveal-answer-error', { message: 'Partida no encontrada', code: 'GAME_NOT_FOUND' });
            return;
        }

        logger.info('📥 reveal-answer event received', {
            roomId,
            socketId: socket.id,
            currentIndex: game.currentIndex
        });

        pushSessionLog(roomId, {
            level: 'info',
            event: 'answer-revealed',
            actor: 'presenter',
            message: 'Presenter revealed answer',
            data: {
                questionIndex: game.currentIndex
            }
        });

        if (typeof clearGameTimer === 'function') {
            clearGameTimer(roomId);
        }

        await revealAnswer({
            roomId,
            game,
            io,
            timeExpired: false
        });
    };
}

/**
 * Manual Points Handler
 */
function createManualPointsHandler(dependencies) {
    const { activeGames, io, syncBus } = dependencies;

    return async function handleManualPoints(socket, data) {
        const validation = validateSocket(schemas.manualPoints, data);
        if (!validation.valid) {
            return;
        }

        const { pin, sessionId, nickname, nicknames, points } = validation.value;
        const roomId = sessionId || pin;
        const sPin = String(roomId);

        const game = activeGames.get(sPin);
        if (!game) return;

        // Soportar tanto nickname único como array de nicknames (para equipos)
        const playersToUpdate = (nicknames || [nickname]).filter(Boolean);

        // Actualizar puntos para cada jugador
        for (const nick of playersToUpdate) {
            game.scores[nick] = roundScore((game.scores[nick] || 0) + points);

            // El hash game:scores en Redis es la fuente canónica: submit-answer
            // sobrescribe el score local con su total, así que los puntos
            // manuales deben incrementarse también ahí o se pierden.
            try {
                const redisClient = await getRedisClient();
                const scoreKey = `game:scores:${sPin}`;
                const redisTotal = await redisClient.hIncrByFloat(scoreKey, nick, points);
                redisClient.expire(scoreKey, 7200).catch(() => { });

                if (redisTotal !== null && !isNaN(Number(redisTotal))) {
                    game.scores[nick] = roundScore(Number(redisTotal));
                }
            } catch (err) {
                logger.warn('Manual points Redis increment failed, using local score', {
                    roomId: sPin,
                    nickname: nick,
                    error: err.message
                });
            }
        }

        // Sincronizar scores cross-worker
        if (syncBus) {
            playersToUpdate.forEach(nick => {
                if (!nick) return;
                GameStateUpdateService.publishScoreUpdate({
                    roomId: sPin,
                    nickname: nick,
                    score: game.scores[nick],
                    currentIndex: game.currentIndex,
                    allScores: game.scores,
                    syncBus,
                    logger
                }).catch(err => {
                    logger.warn('Manual points sync failed', { roomId: sPin, nickname: nick, error: err.message });
                });
            });
        }

        const ranking = Object.entries(game.scores)
            .map(([nickname, score]) => ({ nickname, score: roundScore(score) }))
            .sort((a, b) => b.score - a.score);

        // Solo enviar ranking al presentador
        io.to(sPin + ':presenter').emit('ranking-update', { ranking });
    };
}

module.exports = {
    createNextQuestionHandler,
    createRevealAnswerHandler,
    createManualPointsHandler
};
