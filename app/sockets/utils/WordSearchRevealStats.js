/**
 * @fileoverview Sopa de letras: cuántos jugadores encontraron cada palabra.
 *
 * Se guarda en Redis con AnswerStatsStore (compartido entre workers) en una
 * clave propia por pregunta (`<índice>:ws`), para no mezclarlo con el reparto de
 * votos por opción que usa el reveal para contar respuestas:
 *   answers → respuestas recibidas · "0".."5" → jugadores que encontraron esa palabra
 */

'use strict';

const answerStatsStore = require('../../services/AnswerStatsStore');

const ANSWERS_FIELD = 'answers';

function statsSlot(questionIndex) {
    return `${questionIndex}:ws`;
}

/**
 * Suma una respuesta y las palabras que encontró.
 * @param {string} sPin - Sala
 * @param {number} questionIndex
 * @param {{ wordsFound?: boolean[] }} details - answerResult.details de WordSearchService
 * @returns {Promise<void>}
 */
async function recordWordSearchStats(sPin, questionIndex, details) {
    if (!Array.isArray(details?.wordsFound)) return;
    const slot = statsSlot(questionIndex);
    const fields = details.wordsFound
        .map((found, index) => (found ? String(index) : null))
        .filter(field => field !== null);
    await Promise.all([ANSWERS_FIELD, ...fields].map(field => answerStatsStore.increment(sPin, slot, field)));
}

/**
 * Datos de la sopa para el reveal: palabras, posiciones y cuántos encontraron cada una.
 * @returns {Promise<{ words: string[], placements: Array, foundStats: { answers: number, counts: number[] } }>}
 */
async function buildWordSearchReveal(roomId, revealIndex, question) {
    const words = question.ws_words || [];
    const stats = (await answerStatsStore.getStats(roomId, statsSlot(revealIndex))) || {};
    return {
        words,
        placements: question.ws_placements || [],
        foundStats: {
            answers: stats[ANSWERS_FIELD] || 0,
            counts: words.map((_, index) => stats[index] || 0)
        }
    };
}

module.exports = {
    recordWordSearchStats,
    buildWordSearchReveal
};
