/**
 * @fileoverview Advance Question Use Case - Flujo completo para avanzar pregunta
 * @module application/use-cases/AdvanceQuestionUseCase
 * 
 * Encapsula todo el flujo de negocio para avanzar a la siguiente pregunta:
 * 1. Validación
 * 2. Preparación de siguiente pregunta
 * 3. Emisión de evento de dominio (QuestionRevealedEvent)
 * 4. Respuesta al cliente
 * 
 * MIGRADO: Ya no usa NextQuestionCommand (eliminado)
 * Ahora usa prepareNextQuestion + EventBus directamente
 */

const EventBus = require('../../domain/events/EventBus');
const { QuestionRevealedEvent } = require('../../domain/events/GameEvents');
const { prepareNextQuestion } = require('../../sockets/utils/QuestionTransitionManager');
const { endGameAutomatically } = require('../../sockets/utils/GameEndManager');
const { validateSocket, schemas } = require('../../validation');
const { startTimer } = require('../../sockets/utils/TimerManager');
const logger = require('../../config/logger');

const NO_TIMER_SLIDE_TYPES = new Set(['comment', 'info', 'text', 'image']);

class AdvanceQuestionUseCase {
    /**
     * Ejecutar: avanzar a la siguiente pregunta
     * @param {Object} context
     * @param {Object} context.socket - Socket del presentador
     * @param {Object} context.data - { roomIdOrPin }
     * @param {Object} context.dependencies - { activeGames, io, ... }
     * @returns {Promise<Object>} { success, reason?, message? }
     */
    async execute(context) {
        try {
            const { data, dependencies } = context;
            const { roomIdOrPin } = data;
            const { activeGames, io } = dependencies;

            // 1. Validar datos
            const validation = validateSocket(schemas.nextQuestion, { roomIdOrPin });
            if (!validation.valid) {
                return {
                    success: false,
                    reason: 'validation-error',
                    errors: validation.errors
                };
            }

            // 2. Buscar juego
            const roomId = roomIdOrPin;
            const game = activeGames.get(roomId);

            if (!game) {
                return {
                    success: false,
                    reason: 'game-not-found'
                };
            }

            // 3. Preparar siguiente pregunta
            // NOTE: prepareNextQuestion sets game.questionStartTime = Date.now() internally and
            // broadcasts it as the canonical epoch to all workers. We align questionStartTime
            // here immediately before that call so both fields share the same instant.
            game.questionStartTime = Date.now();
            const result = await prepareNextQuestion({
                game,
                players: dependencies.players,
                syncBus: dependencies.syncBus,
                clearGameTimer: dependencies.clearGameTimer,
                io
            });

            if (!result.success) {
                // Si el juego terminó, llamar a endGameAutomatically
                if (result.isGameEnd) {
                    logger.info('Game end detected - calling endGameAutomatically', { roomId });

                    await endGameAutomatically({
                        game,
                        roomId,
                        io,
                        activeGames: dependencies.activeGames,
                        teamConfigs: dependencies.teamConfigs,
                        players: dependencies.players,
                        socketToPlayer: dependencies.socketToPlayer,
                        lobbyPlayers: dependencies.lobbyPlayers,
                        clearGameTimer: dependencies.clearGameTimer
                    });

                    return {
                        success: false,
                        reason: 'game-ended'
                    };
                }

                return {
                    success: false,
                    reason: result.error || result.reason || 'prepare-failed'
                };
            }

            const currentQuestion = result.currentQuestion;

            // 4. Emitir evento de dominio (QuestionRevealedHandler lo procesará)
            EventBus.emit('question.revealed', new QuestionRevealedEvent({
                roomId,
                question: currentQuestion,
                questionIndex: game.currentIndex,
                totalQuestions: game.questions.length,
                timestamp: Date.now()
            }));

            // 5. Iniciar timer solo en slides con respuesta
            // - comment/info/text: slides especiales sin respuestas ni cuenta atrás
            if (!NO_TIMER_SLIDE_TYPES.has(currentQuestion.slide_type) && typeof currentQuestion.time_limit === 'number') {
                startTimer(roomId, currentQuestion.time_limit, io);
            }

            return { success: true };

        } catch (error) {
            logger.error('Error in AdvanceQuestionUseCase', {
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                reason: 'server-error',
                message: 'Error al avanzar pregunta',
                code: 'ADVANCE_QUESTION_FAILED'
            };
        }
    }
}

module.exports = AdvanceQuestionUseCase;
