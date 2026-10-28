/**
 * @fileoverview «Encuesta de selección múltiple» (survey_multiple): encuesta sin
 * respuesta correcta en la que cada jugador marca tantas opciones como quiera,
 * también ninguna. No puntúa ni toca la racha; al revelar se muestra qué parte
 * de los que respondieron eligió cada opción (la suma puede pasar del 100 %).
 *
 * @module domain/services/SurveyMultipleAnswerService
 */

'use strict';

const SURVEY_MULTIPLE = 'survey_multiple';
const SURVEY_TYPES = new Set(['survey', SURVEY_MULTIPLE]);

/** ¿Es una encuesta (simple o de selección múltiple)? No tiene correcta ni puntúa. */
function isSurveyType(type) {
    return SURVEY_TYPES.has(type);
}

function isSurveyMultiple(type) {
    return type === SURVEY_MULTIPLE;
}

/**
 * Valida la selección. A diferencia de multiple_choice, admite un array vacío.
 *
 * @param {Object} params
 * @param {Object} params.question - Pregunta con options
 * @param {Array<number>} params.selectedIndices - Índices marcados
 * @param {boolean} params.gameCanAnswer - Si el juego admite respuestas
 * @param {boolean} [params.allowWhenClosed] - Respuesta tardía permitida (última pregunta)
 * @returns {{ valid: boolean, reason: string|null }}
 */
function validateSurveyMultipleAnswer({ question, selectedIndices, gameCanAnswer, allowWhenClosed = false }) {
    if (!question) return { valid: false, reason: 'question-missing' };
    const options = question.options || [];
    if (options.length === 0) return { valid: false, reason: 'invalid-options' };
    if (!gameCanAnswer && !allowWhenClosed) return { valid: false, reason: 'game-closed' };
    if (!Array.isArray(selectedIndices)) return { valid: false, reason: 'invalid-payload' };
    if (selectedIndices.length > options.length) return { valid: false, reason: 'too-many-selections' };

    const outOfRange = selectedIndices.some(idx => !Number.isInteger(idx) || idx < 0 || idx >= options.length);
    if (outOfRange) return { valid: false, reason: 'invalid-option-index' };
    if (new Set(selectedIndices).size !== selectedIndices.length) {
        return { valid: false, reason: 'duplicate-option-index' };
    }
    return { valid: true, reason: null };
}

/** Índices únicos y ordenados (el recuento no debe contar dos veces la misma opción). */
function normalizeSelection(selectedIndices) {
    if (!Array.isArray(selectedIndices)) return [];
    return [...new Set(selectedIndices.filter(Number.isInteger))].sort((a, b) => a - b);
}

/**
 * Resultado de la respuesta: sin puntos y marcado como encuesta, como survey.
 * @param {{ selectedIndices: Array<number> }} params
 * @returns {{ isCorrect: boolean, pointsEarned: number, isSurvey: true, selectedIndices: number[], details: Object }}
 */
function processSurveyMultipleAnswer({ selectedIndices }) {
    const selection = normalizeSelection(selectedIndices);
    return {
        isCorrect: false,
        pointsEarned: 0,
        isSurvey: true,
        selectedIndices: selection,
        details: { strategy: SURVEY_MULTIPLE, selectedIndices: selection }
    };
}

/**
 * Porcentaje de encuestados que eligió cada opción (una cifra decimal).
 * @param {number[]} counts - Votos por opción
 * @param {number} respondents - Jugadores que respondieron (incluidos los envíos vacíos)
 * @returns {Array<{ count: number, percentage: number }>}
 */
function buildPercentages(counts, respondents) {
    return counts.map(count => {
        const votes = Number(count) || 0;
        const raw = respondents > 0 ? (votes / respondents) * 100 : 0;
        return { count: votes, percentage: Math.round(Math.min(raw, 100) * 10) / 10 };
    });
}

module.exports = {
    isSurveyType,
    isSurveyMultiple,
    validateSurveyMultipleAnswer,
    normalizeSelection,
    processSurveyMultipleAnswer,
    buildPercentages
};
