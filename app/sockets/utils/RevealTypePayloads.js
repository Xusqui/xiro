/**
 * @fileoverview Parte del payload de 'reveal-answer' que depende del tipo de pregunta.
 * Extraído de GameEndManager.js: qué respuesta correcta ve el presentador y qué
 * subconjunto llega a los jugadores.
 */

'use strict';

const { buildWordSearchReveal } = require('./WordSearchRevealStats');

function optionText(option) {
    return option?.text || option?.optionText || option?.option_text || '';
}

/** Sin índice/orden/parejas: los tipos que muestran su respuesta de otra forma. */
function clearOptionFields(presenterPayload) {
    presenterPayload.correctIndex = null;
    presenterPayload.correctOrder = null;
    presenterPayload.correctMatches = null;
}

/**
 * Lo que ven los jugadores al revelar: la respuesta correcta en el formato
 * de cada tipo (número, palabra, parejas, orden u opciones correctas).
 */
function buildPlayerRevealPayload(presenterPayload) {
    const wordSearch = presenterPayload.wordSearch;
    return {
        correctAnswer: presenterPayload.correctAnswer ?? null,
        justification: presenterPayload.justification ?? null,
        correctOrder: presenterPayload.correctOrder ?? null,
        correctMatches: presenterPayload.correctMatches ?? null,
        correctWord: presenterPayload.correctWord ?? null,
        correctOptionTexts: presenterPayload.correctOptionTexts ?? null,
        // Sopa de letras: tras revelar, el jugador ya puede ver dónde estaban las palabras
        ...(wordSearch ? { wordSearch: { words: wordSearch.words, placements: wordSearch.placements } } : {})
    };
}

/**
 * Ajusta el payload del presentador según el tipo de pregunta.
 * Async solo por la sopa de letras (lee de Redis cuántos encontraron cada palabra).
 */
async function applyQuestionTypeOverrides({ presenterPayload, question, flags, correctIndicesMultiple, roomId, revealIndex }) {
    if (flags.isNumericQuestion) {
        presenterPayload.correctAnswer = question.correct_answer;
        presenterPayload.maxPoints = question.max_points;
        presenterPayload.toleranceMode = question.tolerance_mode;
        presenterPayload.toleranceValue = question.tolerance_value;
        presenterPayload.toleranceCap = question.tolerance_cap;
        clearOptionFields(presenterPayload);
    }

    if (flags.isWordScrambleQuestion) {
        presenterPayload.correctWord = question.correct_word || null;
        clearOptionFields(presenterPayload);
    }

    if (flags.isWordSearchQuestion) {
        presenterPayload.wordSearch = await buildWordSearchReveal(roomId, revealIndex, question);
        presenterPayload.correctAnswer = (question.ws_words || []).join(', ');
        clearOptionFields(presenterPayload);
    }

    if (flags.isMultipleChoiceQuestion) {
        presenterPayload.correctIndices = correctIndicesMultiple;
        presenterPayload.correctOptionTexts = (correctIndicesMultiple || [])
            .map(idx => optionText(question.options?.[idx]))
            .filter(Boolean);
        clearOptionFields(presenterPayload);
        presenterPayload.correctAnswer = null;
    }
}

module.exports = {
    buildPlayerRevealPayload,
    applyQuestionTypeOverrides
};
