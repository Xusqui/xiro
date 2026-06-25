/**
 * @fileoverview Answer Processing Service - Orquestación de procesamiento de respuestas
 * Centraliza la lógica de manejo de respuestas individuales y por equipos
 */

const ScoringService = require('./ScoringService');
const AnswerStateService = require('./AnswerStateService');

class AnswerProcessingService {
    /**
     * Procesar respuesta duplicada (idempotencia)
     */
    static handleDuplicateAnswer({ socket, player, game, currentQuestion, callback }) {
        const previousAnswer = AnswerStateService.getPreviousAnswer(player.answers, game.currentIndex);
        const ranking = ScoringService.generateRanking(game.scores || {});
        const correctOption = ScoringService.getCorrectOption(currentQuestion);

        const duplicatePayload = AnswerStateService.prepareDuplicateAnswerPayload({
            previousAnswer,
            question: currentQuestion,
            ranking,
            correctOption
        });

        const playerJustification = ScoringService.getJustification(
            previousAnswer.option,
            correctOption
        );
        if (playerJustification) {
            duplicatePayload.justification = playerJustification;
        }

        socket.emit('answer-result', duplicatePayload);
        if (callback) callback({ ok: true, duplicate: true });
        return true; // Indica que se manejó la duplicación
    }

    /**
     * Actualizar estado del jugador (player + socket.data)
     */
    static updatePlayerState({ player, socket, game, answerIndex, optionSelected, currentQuestion }) {
        if (!player) return;

        // Actualizar answeredQuestions
        player.answeredQuestions.add(game.currentIndex);
        player.lastSeen = Date.now();

        // CRÍTICO: También guardar en socket.data para acceso cross-worker
        if (!socket.data.answeredQuestions) socket.data.answeredQuestions = [];
        if (!socket.data.answeredQuestions.includes(game.currentIndex)) {
            socket.data.answeredQuestions.push(game.currentIndex);
        }

        // Preparar datos de respuesta usando AnswerStateService
        const questionTimeLimit = currentQuestion.time_limit || 30;
        const answerState = AnswerStateService.buildCompleteAnswerState({
            answerIndex,
            option: optionSelected,
            gameStartTime: game.questionStartTime,
            currentTime: Date.now(),
            questionTimeLimit,
            pointsEarned: 0, // Se actualiza después
            isCorrect: optionSelected?.isCorrect
        });

        // Almacenar en player.answers
        if (!player.answers) player.answers = {};
        player.answers[game.currentIndex] = answerState.playerAnswer;

        // CRÍTICO: También guardar en socket.data para acceso cross-worker
        if (!socket.data.answers) socket.data.answers = {};
        socket.data.answers[game.currentIndex] = answerState.socketDataAnswer;
    }

    /**
     * Actualizar puntuación del jugador (individual y en player object)
     */
    static updatePlayerScore({ game, nickname, pointsEarned, player, socket }) {
        const logger = require('../../config/logger');
        const scoreBefore = game.scores[nickname] || 0;

        // Actualizar score individual
        game.scores[nickname] = ScoringService.updatePlayerScore({
            currentScore: game.scores[nickname],
            pointsEarned
        });

        logger.debug('🎯 Score actualizado localmente', {
            roomId: game.roomId || game.sessionId || game.pin,
            nickname,
            scoreBefore,
            scoreAfter: game.scores[nickname],
            pointsEarned,
            allScores: JSON.stringify(game.scores),
            workerId: process.pid
        });

        // Actualizar objeto player
        if (player) {
            player.score = game.scores[nickname];

            // Guardar puntos ganados en esta pregunta
            if (player.answers && player.answers[game.currentIndex]) {
                player.answers[game.currentIndex].pointsEarned = pointsEarned;
            }
        }

        // CRÍTICO: Actualizar socket.data también (acceso cross-worker)
        if (socket.data.answers && socket.data.answers[game.currentIndex]) {
            socket.data.answers[game.currentIndex].pointsEarned = pointsEarned;
        }

        return game.scores[nickname];
    }

    /**
     * Preparar payload de resultado de respuesta
     */
    static prepareAnswerPayload({ answerResult, isCorrect, pointsEarned, currentQuestion, sortedScores }) {
        const correctOption = ScoringService.getCorrectOption(currentQuestion);
        const justificationText = ScoringService.getJustification(
            answerResult.optionSelected,
            correctOption
        );

        const payload = {
            correct: answerResult.isSurvey ? null : isCorrect,
            points: answerResult.isSurvey ? 0 : pointsEarned,
            correctAnswer: answerResult.isSurvey ? null : correctOption?.text,
            ranking: sortedScores
        };

        if (justificationText) {
            payload.justification = justificationText;
        }

        return payload;
    }
}

module.exports = AnswerProcessingService;
