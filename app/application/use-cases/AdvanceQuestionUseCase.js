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
const { hasTimer } = require('../../domain/services/QuestionScoringPolicy');
const { runRandomPointsReveal } = require('../../sockets/utils/RandomPointsRevealManager');
const { forwardMode } = require('../../domain/services/SlideNavigationPolicy');
const NavigateSlideUseCase = require('./NavigateSlideUseCase');
const logger = require('../../config/logger');

/**
 * Caso de uso: pasa a la siguiente pregunta (o cierra la partida si era la última) y arranca su temporizador.
 */
class AdvanceQuestionUseCase {
    /**
     * Resuelve un fallo de prepareNextQuestion: si es fin de partida la cierra; si no, devuelve el motivo.
     * @param {Object} result - Resultado de prepareNextQuestion
     * @param {Object} game - Partida activa
     * @param {string} roomId - ID de la sala
     * @param {Object} dependencies - { activeGames, io, teamConfigs, players, ... }
     * @returns {Promise<Object>} { success: false, reason }
     */
    async _handlePrepareFailure(result, game, roomId, dependencies) {
        if (!result.isGameEnd) {
            return { success: false, reason: result.error || result.reason || 'prepare-failed' };
        }

        logger.info('Game end detected - calling endGameAutomatically', { roomId });
        await endGameAutomatically({
            game,
            roomId,
            io: dependencies.io,
            activeGames: dependencies.activeGames,
            teamConfigs: dependencies.teamConfigs,
            players: dependencies.players,
            socketToPlayer: dependencies.socketToPlayer,
            lobbyPlayers: dependencies.lobbyPlayers,
            clearGameTimer: dependencies.clearGameTimer
        });
        return { success: false, reason: 'game-ended' };
    }

    _prepareNext(game, dependencies) {
        // NOTE: prepareNextQuestion sets game.questionStartTime = Date.now() internally and
        // broadcasts it as the canonical epoch to all workers. We align questionStartTime
        // here immediately before that call so both fields share the same instant.
        game.questionStartTime = Date.now();
        return prepareNextQuestion({
            game,
            players: dependencies.players,
            syncBus: dependencies.syncBus,
            clearGameTimer: dependencies.clearGameTimer,
            io: dependencies.io
        });
    }

    _emitQuestionRevealed(roomId, game, question) {
        // QuestionRevealedHandler lo procesará
        EventBus.emit(
            'question.revealed',
            new QuestionRevealedEvent({
                roomId,
                question,
                questionIndex: game.currentIndex,
                totalQuestions: game.questions.length,
                timestamp: Date.now()
            })
        );
    }

    _startTimerIfAnswerable(roomId, question, io) {
        // comment/info/text/image/text-image: slides sin respuestas ni cuenta atrás
        // (la lista vive en QuestionScoringPolicy, compartida con MaxScoreCalculator)
        if (hasTimer(question) && typeof question.time_limit === 'number') {
            startTimer(roomId, question.time_limit, io);
        }
    }

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

            const validation = validateSocket(schemas.nextQuestion, { roomIdOrPin });
            if (!validation.valid) {
                return { success: false, reason: 'validation-error', errors: validation.errors };
            }

            const roomId = roomIdOrPin;
            const game = activeGames.get(roomId);
            if (!game) {
                return { success: false, reason: 'game-not-found' };
            }

            // Juegos personalizados en revisión: lo ya mostrado no se vuelve a jugar
            if (forwardMode(game) === 'review') {
                return new NavigateSlideUseCase().execute({ ...context, data: { roomIdOrPin, direction: 'forward' } });
            }

            const result = await this._prepareNext(game, dependencies);
            if (!result.success) {
                return this._handlePrepareFailure(result, game, roomId, dependencies);
            }

            const currentQuestion = result.currentQuestion;

            // Pantalla "JUGÁIS POR XXX PUNTOS" si la pregunta usa puntuación aleatoria. Espera su
            // duración y vuelve a sellar questionStartTime: el bonus de tiempo se mide desde que se ve.
            const shouldReveal = await runRandomPointsReveal({
                game,
                question: currentQuestion,
                roomId,
                io,
                syncBus: dependencies.syncBus
            });
            if (!shouldReveal) {
                return { success: false, reason: 'reveal-aborted' };
            }

            this._emitQuestionRevealed(roomId, game, currentQuestion);
            this._startTimerIfAnswerable(roomId, currentQuestion, io);
            return { success: true };
        } catch (error) {
            logger.error('Error in AdvanceQuestionUseCase', { error: error.message, stack: error.stack });
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
