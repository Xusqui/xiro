/**
 * @fileoverview MultipleChoiceAnswerService - Lógica de puntuación para preguntas de selección múltiple
 * 
 * Maneja el cálculo de puntos basado en:
 * - Correctas marcadas: +mc_points_per_correct cada una
 * - Incorrectas marcadas: -mc_penalty_per_incorrect cada una
 * - Bonus perfección: +mc_perfect_bonus si marca todas las correctas y ninguna incorrecta
 * 
 * @module domain/services/MultipleChoiceAnswerService
 */

/**
 * Extrae los índices de las opciones correctas de una pregunta
 * 
 * @param {Array<Object>} options - Opciones de la pregunta
 * @returns {Array<number>} Array de índices correctos [0, 2, 4]
 * 
 * @example
 * const options = [
 *   { optionText: 'A', is_correct: true },
 *   { optionText: 'B', is_correct: false },
 *   { optionText: 'C', is_correct: true }
 * ];
 * extractCorrectIndices(options); // => [0, 2]
 */
function extractCorrectIndices(options) {
    if (!Array.isArray(options)) {
        return [];
    }

    return options
        .map((opt, idx) => (opt.is_correct || opt.isCorrect) ? idx : null)
        .filter(idx => idx !== null);
}

/**
 * Calcula la puntuación para una respuesta de selección múltiple
 * 
 * Sistema de puntuación:
 * - +X puntos por cada correcta marcada
 * - 0 puntos por cada correcta NO marcada
 * - -Y puntos por cada incorrecta marcada
 * - +Z bonus si marca TODAS las correctas y NINGUNA incorrecta (perfección)
 * - Permite puntos negativos (sin mínimo)
 * 
 * @param {Object} params - Parámetros
 * @param {Array<number>} params.selectedIndices - Índices seleccionados por el jugador [0, 2, 4]
 * @param {Array<number>} params.correctIndices - Índices de respuestas correctas [0, 2, 5]
 * @param {number} params.pointsPerCorrect - Puntos por cada correcta marcada
 * @param {number} params.penaltyPerIncorrect - Penalización por cada incorrecta marcada
 * @param {number} params.perfectBonus - Bonus extra por perfección absoluta
 * @returns {Object} { pointsEarned, details: { correctSelected, incorrectSelected, correctMissed, isPerfect } }
 * 
 * @example
 * calculateMultipleChoiceScore({
 *   selectedIndices: [0, 2, 4],
 *   correctIndices: [0, 2, 5],
 *   pointsPerCorrect: 10,
 *   penaltyPerIncorrect: 5,
 *   perfectBonus: 20
 * });
 * // Resultado:
 * // - Correctas seleccionadas: 0, 2 → +20 puntos
 * // - Incorrectas seleccionadas: 4 → -5 puntos
 * // - Correctas perdidas: 5
 * // - NO es perfecto → sin bonus
 * // => { pointsEarned: 15, details: { correctSelected: 2, incorrectSelected: 1, correctMissed: 1, isPerfect: false } }
 */
function calculateMultipleChoiceScore({
    selectedIndices,
    correctIndices,
    pointsPerCorrect,
    penaltyPerIncorrect,
    perfectBonus
}) {
    // Validaciones básicas
    if (!Array.isArray(selectedIndices) || !Array.isArray(correctIndices)) {
        return {
            pointsEarned: 0,
            details: {
                correctSelected: 0,
                incorrectSelected: 0,
                correctMissed: correctIndices.length,
                isPerfect: false
            }
        };
    }

    // Convertir a Sets para comparaciones rápidas
    const correctSet = new Set(correctIndices);

    // Contar aciertos y errores
    let correctSelected = 0;
    let incorrectSelected = 0;

    selectedIndices.forEach(idx => {
        if (correctSet.has(idx)) {
            correctSelected++;
        } else {
            incorrectSelected++;
        }
    });

    // Correctas que NO se marcaron
    const correctMissed = correctIndices.length - correctSelected;

    // Verificar perfección: todas las correctas + ninguna incorrecta
    const isPerfect = correctSelected === correctIndices.length && incorrectSelected === 0;

    // Calcular puntos
    let pointsEarned = 0;

    // Puntos por correctas marcadas
    pointsEarned += correctSelected * pointsPerCorrect;

    // Penalización por incorrectas marcadas
    pointsEarned -= incorrectSelected * penaltyPerIncorrect;

    // Bonus por perfección
    if (isPerfect) {
        pointsEarned += perfectBonus;
    }

    // Nota: Se permiten puntos negativos (sin Math.max(0, ...))

    return {
        pointsEarned,
        details: {
            correctSelected,
            incorrectSelected,
            correctMissed,
            isPerfect
        }
    };
}

/**
 * Procesa una respuesta completa de selección múltiple
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.question - Pregunta con options y configuración de puntos
 * @param {Array<number>} params.selectedIndices - Índices seleccionados por el jugador
 * @param {number} params.gameStartTime - Timestamp de inicio de la pregunta
 * @param {number} params.currentTime - Timestamp actual
 * @returns {Object} Resultado completo del procesamiento
 * 
 * @example
 * processMultipleChoiceAnswer({
 *   question: {
 *     options: [...],
 *     mc_points_per_correct: 10,
 *     mc_penalty_per_incorrect: 5,
 *     mc_perfect_bonus: 20,
 *     time_limit: 30
 *   },
 *   selectedIndices: [0, 2],
 *   gameStartTime: 1000000,
 *   currentTime: 1015000
 * });
 */
function processMultipleChoiceAnswer({
    question,
    selectedIndices,
    gameStartTime,
    currentTime
}) {
    const correctIndices = extractCorrectIndices(question.options || []);

    const pointsPerCorrect = question.mc_points_per_correct || 10;
    const penaltyPerIncorrect = question.mc_penalty_per_incorrect || 10;
    const perfectBonus = question.mc_perfect_bonus || 20;
    const questionTimeLimit = question.time_limit || 30;

    // Calcular tiempo transcurrido
    const timeElapsed = (currentTime - gameStartTime) / 1000;
    const timeLeft = Math.max(0, questionTimeLimit - timeElapsed);

    // Calcular puntuación
    const scoreResult = calculateMultipleChoiceScore({
        selectedIndices,
        correctIndices,
        pointsPerCorrect,
        penaltyPerIncorrect,
        perfectBonus
    });

    return {
        ...scoreResult,
        isCorrect: scoreResult.details.isPerfect, // Solo perfección cuenta como "correcta"
        timeLeft,
        timeElapsed,
        correctIndices,
        selectedIndices
    };
}

module.exports = {
    extractCorrectIndices,
    calculateMultipleChoiceScore,
    processMultipleChoiceAnswer
};
