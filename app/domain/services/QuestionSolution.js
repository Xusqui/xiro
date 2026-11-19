/**
 * @fileoverview Texto de la solución de una pregunta para el resultado del jugador y el
 * revelado por equipos. Depende de la forma de la solución del catálogo de tipos
 * (public/js/core/question-types.js), no de una lista de tipos.
 *
 * ARQUITECTURA: Domain Service (funciones puras, sin I/O).
 * @module domain/services/QuestionSolution
 */

'use strict';

const QuestionTypes = require('../../public/js/core/question-types');

const joinWords = (words) => (words || []).join(', ');

// Soluciones que no son una opción: número, palabra o lista de palabras
const SOLUTION_TEXT = Object.freeze({
    value: (question) => question.correct_answer ?? null,
    word: (question) => question.correct_word ?? null,
    words: (question) => joinWords(question.ws_words),
    blanks: (question) => joinWords(question.fb_words)
});

function optionText(correctOption) {
    return correctOption?.text || correctOption?.optionText || correctOption?.option_text || '';
}

/**
 * Texto de la solución. Numérica y anagrama devuelven el número o la palabra; sopa de
 * letras y completa la frase, sus palabras separadas por comas; el resto, el texto de
 * la opción correcta (cadena vacía si no la hay).
 * @param {Object|null} question - Pregunta
 * @param {Object|null} [correctOption] - Opción correcta, en tipos de opción
 * @returns {string|number|null}
 */
function solutionText(question, correctOption) {
    const solution = QuestionTypes.solutionOf(question?.question_type);
    const fromQuestion = Object.prototype.hasOwnProperty.call(SOLUTION_TEXT, solution) ? SOLUTION_TEXT[solution] : null;
    return fromQuestion ? fromQuestion(question) : optionText(correctOption);
}

module.exports = { solutionText };
