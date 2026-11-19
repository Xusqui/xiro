/**
 * @fileoverview Helper para revelación de resultados por equipos
 * Resuelve respuesta correcta y corrección para diferentes tipos de preguntas
 */

const { solutionText } = require('../../domain/services/QuestionSolution');

function resolveTeamRevealCorrectness(question, playerAnswerState) {
    // CRITICAL FIX: SIEMPRE usar isCorrect ya calculado
    // No recalcular para numeric/word_scramble porque usa lógica diferente (solo exacta)
    // y causa inconsistencia: inicialmente correcto → luego incorrecto
    return playerAnswerState?.isCorrect;
}

/**
 * Texto de la respuesta correcta que se muestra a un equipo según el tipo de pregunta.
 * @param {Object} question - Pregunta
 * @param {Object} [correctOption] - Opción correcta, en tipos de opción única
 * @param {boolean} isOrderQuestion - Si es de ordenar
 * @param {boolean} isSurvey - Si es encuesta
 * @returns {*} null en ordenar y encuesta; valor en numérico y anagrama; palabras unidas por comas en sopa de letras y
 *   completar; texto de la opción en el resto
 */
function resolveTeamRevealCorrectAnswer(question, correctOption, isOrderQuestion, isSurvey) {
    if (isOrderQuestion || isSurvey) {
        return null;
    }

    return solutionText(question, correctOption);
}

module.exports = {
    resolveTeamRevealCorrectness,
    resolveTeamRevealCorrectAnswer
};
