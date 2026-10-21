/**
 * @fileoverview «Encuesta de selección múltiple»: cuántos respondieron y cuántos
 * marcaron cada opción.
 *
 * Se guarda en Redis con AnswerStatsStore (compartido entre workers) en una clave
 * propia por pregunta (`<índice>:sm`), aparte del reparto de votos por opción de
 * las preguntas de una sola respuesta:
 *   answers → jugadores que enviaron (también sin marcar nada) · "0".."5" → votos por opción
 * El porcentaje de cada opción es votos / answers, así que la suma puede pasar del 100 %.
 * En equipos cuenta cada jugador.
 */

'use strict';

const answerStatsStore = require('../../services/AnswerStatsStore');
const { normalizeSelection, buildPercentages } = require('../../domain/services/SurveyMultipleAnswerService');

const ANSWERS_FIELD = 'answers';

function statsSlot(questionIndex) {
    return `${questionIndex}:sm`;
}

/**
 * Suma un encuestado y un voto por cada opción marcada.
 * @param {string} sPin - Sala
 * @param {string|number} questionIndex - Índice de la pregunta (QuestionSlot)
 * @param {Array<number>} selectedIndices - Opciones marcadas (puede estar vacío)
 * @returns {Promise<void>}
 */
async function recordSurveyMultipleStats(sPin, questionIndex, selectedIndices) {
    const slot = statsSlot(questionIndex);
    const fields = normalizeSelection(selectedIndices).map(String);
    await Promise.all([ANSWERS_FIELD, ...fields].map(field => answerStatsStore.increment(sPin, slot, field)));
}

function optionText(option) {
    return option?.text || option?.optionText || option?.option_text || '';
}

/**
 * Datos del reveal: encuestados y, por opción, texto, votos y porcentaje.
 * @returns {Promise<{ respondents: number, options: Array<{ text: string, count: number, percentage: number }> }>}
 */
async function buildSurveyMultipleReveal(roomId, slot, question) {
    const options = question.options || [];
    const stats = (await answerStatsStore.getStats(roomId, statsSlot(slot))) || {};
    const respondents = Number(stats[ANSWERS_FIELD]) || 0;
    const percentages = buildPercentages(
        options.map((_, index) => stats[index]),
        respondents
    );
    return {
        respondents,
        options: options.map((option, index) => ({ text: optionText(option), ...percentages[index] }))
    };
}

module.exports = {
    recordSurveyMultipleStats,
    buildSurveyMultipleReveal
};
