/**
 * @fileoverview Estrategia para modo individual
 * Revelación inmediata, ranking individual, sin coordinación de equipos
 */

const GameModeStrategy = require('./GameModeStrategy');
const { roundScore } = require('../services/GameUtils');
const { getJustification, getCorrectAnswerText } = require('../services/ScoringService');
const logger = require('../../config/logger');

/**
 * Estrategia para modo de juego individual
 * - Revelación inmediata tras responder
 * - Ranking por jugadores individuales
 * - Sin lógica de equipos
 */
class IndividualGameMode extends GameModeStrategy {
    /**
     * Procesa respuesta en modo individual (revelación inmediata)
     */
    processAnswer(params) {
        const { player, answer, game, question, io, presenterNotification } = params;
        const { nickname, socketId } = player;
        const ranking = this._buildIndividualRanking(game.scores);
        const context = this._buildQuestionContext(question, answer);

        logger.debug('Processing answer in Individual mode', {
            nickname,
            isCorrect: answer.isCorrect,
            points: answer.pointsEarned,
            hasPresenterNotification: !!presenterNotification
        });

        logger.debug('📊 Ranking built for player', {
            nickname,
            rankingCount: ranking.length,
            rankingFormat: ranking[0], // Muestra el primer elemento para verificar formato
            expectedFormat: '{position, nickname, score}'
        });

        const resultPayload = this._buildResultPayload({
            answer,
            game,
            nickname,
            ranking,
            context
        });

        logger.debug('📤 Sending answer-result to player', {
            nickname,
            socketId,
            payloadKeys: Object.keys(resultPayload),
            rankingInPayload: resultPayload.ranking?.[0]
        });

        this._notifyPresenter(presenterNotification, game, nickname, answer);
        this._emitAnswerResult(io, socketId, nickname, answer.isCorrect, resultPayload);

        return {
            revealed: true,
            payload: resultPayload
        };
    }

    /**
     * En modo individual siempre se puede revelar (no hay coordinación)
     */
    canRevealResults(_params) {
        return true;
    }

    /**
     * Broadcast en modo individual (ya se hizo en processAnswer)
     */
    broadcastResults(_params) {
        // En individual la revelación es inmediata en processAnswer
        // No necesita broadcast grupal
        logger.debug('Individual mode: results already sent individually');
    }

    /**
     * Calcula ranking individual ordenado por puntos
     */
    calculateFinalRanking(params) {
        const { game } = params;
        return this._buildIndividualRanking(game.scores);
    }

    /**
     * Limpieza en modo individual (sin recursos específicos)
     */
    cleanup(_params) {
        // Modo individual no tiene recursos adicionales que limpiar
        logger.debug('Individual mode cleanup: no specific resources');
    }

    /**
     * Snapshot de reconexión para modo individual
     */
    buildReconnectionSnapshot(params) {
        const { game, player } = params;
        const { nickname } = player;

        return {
            mode: 'individual',
            score: roundScore(game.scores[nickname] || 0),
            ranking: this._buildIndividualRanking(game.scores),
            teamMode: null // Explícitamente null en modo individual
        };
    }

    /**
     * Helper: construir ranking individual
     * Frontend espera: [{ position, nickname, score }]
     * @private
     */
    _buildIndividualRanking(scores) {
        return Object.entries(scores)
            .map(([nickname, score]) => ({
                nickname,
                score: roundScore(score)
            }))
            .sort((a, b) => b.score - a.score)
            .map((player, index) => ({
                position: index + 1,
                nickname: player.nickname,
                score: player.score
            }));
    }

    _buildQuestionContext(question, answer) {
        const options = Array.isArray(question.options) ? question.options : [];
        const isOrderQuestion = question.question_type === 'order';
        const isMultipleChoiceQuestion = question.question_type === 'multiple_choice';
        const isMatchingQuestion = question.question_type === 'matching';
        const correctOption = isOrderQuestion ? null : options.find(opt => opt.isCorrect);
        const selectedOption = isOrderQuestion ? null : options[answer.answerIndex];
        const justificationText = isOrderQuestion ? null : getJustification(selectedOption, correctOption);

        return {
            isOrderQuestion,
            isMultipleChoiceQuestion,
            isMatchingQuestion,
            correctOption,
            correctAnswerText: isOrderQuestion ? null : getCorrectAnswerText(question, correctOption),
            justificationText
        };
    }

    _buildResultPayload({ answer, game, nickname, ranking, context }) {
        return {
            correct: answer.isSurvey ? null : answer.isCorrect,
            correctAnswer: context.correctAnswerText,
            points: roundScore(answer.pointsEarned),
            totalScore: roundScore(game.scores[nickname] || 0),
            ranking,
            justification: context.justificationText,
            orderDetails: context.isOrderQuestion ? answer.orderDetails : null,
            multipleChoiceDetails: context.isMultipleChoiceQuestion ? answer.multipleChoiceDetails : null,
            matchingDetails: context.isMatchingQuestion ? answer.matchingDetails || null : null,
            streak: answer.streakInfo || null
        };
    }

    _notifyPresenter(presenterNotification, game, nickname, answer) {
        if (!presenterNotification) {
            logger.warn('⚠️ presenterNotification is undefined - presenter will not be notified', {
                nickname,
                gameId: game.roomId || game.sessionId
            });
            return;
        }

        const roomId = game.roomId || game.sessionId;
        logger.debug('📢 Notifying presenter about player answer', {
            roomId,
            nickname,
            isCorrect: answer.isCorrect,
            totalScore: game.scores[nickname]
        });

        presenterNotification.notifyPlayerAnswered({
            roomId,
            nickname,
            isCorrect: answer.isCorrect,
            pointsEarned: answer.pointsEarned,
            totalScore: game.scores[nickname] || 0,
            questionIndex: game.currentIndex,
            answerIndex: answer.answerIndex || 0,
            streakInfo: answer.streakInfo || null
        });
    }

    _emitAnswerResult(io, socketId, nickname, isCorrect, resultPayload) {
        logger.info('🔔 EMITTING answer-result to player', {
            nickname,
            socketId,
            payloadKeys: Object.keys(resultPayload),
            hasMultipleChoiceDetails: !!resultPayload.multipleChoiceDetails,
            points: resultPayload.points
        });

        io.to(socketId).emit('answer-result', resultPayload);

        logger.debug('Answer result sent to player', {
            nickname,
            socketId,
            isCorrect,
            points: resultPayload.points
        });
    }
}

module.exports = IndividualGameMode;
