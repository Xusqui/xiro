/**
 * @fileoverview Servicio para procesar respuestas a preguntas numéricas por aproximación
 * @module domain/services/NumericAnswerService
 */

const NumericApproximationScoring = require('../strategies/scoring/NumericApproximationScoring');
const { TIMING } = require('../../config/game-constants');

/**
 * Procesa respuesta numérica y calcula puntuación
 *
 * @param {Object} params - Parámetros
 * @param {Object} params.question - Pregunta actual
 * @param {number} params.question.correct_answer - Respuesta correcta
 * @param {number} params.question.max_points - Puntos máximos
 * @param {number} params.question.time_limit - Límite de tiempo
 * @param {number} params.playerAnswer - Respuesta del jugador
 * @param {number} params.gameStartTime - Timestamp inicio de pregunta (ms)
 * @param {number} params.currentTime - Timestamp actual (ms)
 * @returns {Object} Resultado del procesamiento
 *
 * @example
 * const result = processNumericAnswer({
 *   question: { correct_answer: 12756, max_points: 100, time_limit: 30 },
 *   playerAnswer: 12700,
 *   gameStartTime: 1000000,
 *   currentTime: 1000010000
 * });
 */
function processNumericAnswer({
    question,
    playerAnswer,
    gameStartTime,
    currentTime = Date.now()
}) {
    // Validación básica
    if (!question || question.correct_answer === null || question.max_points === null) {
        return {
            isCorrect: false,
            pointsEarned: 0,
            timeBonus: 0,
            playerAnswer: null,
            isSurvey: false,
            details: {
                error: 'Pregunta numérica incompleta (falta correct_answer o max_points)',
                strategy: 'numeric_approximation'
            }
        };
    }

    const strategy = new NumericApproximationScoring();
    const questionTimeLimit = question.time_limit || TIMING.DEFAULT_QUESTION_TIME;
    const timeElapsed = (currentTime - gameStartTime) / 1000; // Segundos

    const result = strategy.calculatePoints({
        playerAnswer,
        correctAnswer: question.correct_answer,
        maxPoints: question.max_points,
        toleranceMode: question.tolerance_mode,
        toleranceValue: question.tolerance_value,
        toleranceCap: question.tolerance_cap,
        timeElapsed,
        questionTimeLimit
    });

    return {
        isCorrect: result.details.isCorrect,
        pointsEarned: result.pointsEarned,
        timeBonus: 0, // No aplica para respuestas numéricas
        playerAnswer: result.details.playerAnswer,
        isSurvey: false,
        details: result.details
    };
}

module.exports = {
    processNumericAnswer
};
