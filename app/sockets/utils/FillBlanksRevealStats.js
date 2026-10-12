/**
 * @fileoverview «Completa la frase»: cuántos jugadores acertaron cada hueco.
 *
 * Se guarda en Redis con AnswerStatsStore (compartido entre workers) en una clave
 * propia por pregunta (`<índice>:fb`), para no mezclarlo con el reparto de votos
 * por opción que usa el reveal para contar respuestas:
 *   answers → respuestas recibidas · "0".."2" → jugadores que acertaron ese hueco
 * En equipos cuenta cada jugador (todos los miembros envían), como pidió el usuario.
 */

'use strict';

const answerStatsStore = require('../../services/AnswerStatsStore');
const { getQuestionWords } = require('../../domain/services/FillBlanksService');

const ANSWERS_FIELD = 'answers';

function statsSlot(questionIndex) {
    return `${questionIndex}:fb`;
}

/**
 * Suma una respuesta y los huecos que acertó.
 * @param {string} sPin - Sala
 * @param {string|number} questionIndex - Índice de la pregunta o `t<epoch>` en Trivial (QuestionSlot)
 * @param {{ blanksCorrect?: boolean[] }} details - answerResult.details de FillBlanksService
 * @returns {Promise<void>}
 */
async function recordFillBlanksStats(sPin, questionIndex, details) {
    if (!Array.isArray(details?.blanksCorrect)) return;
    const slot = statsSlot(questionIndex);
    const fields = details.blanksCorrect
        .map((correct, index) => (correct ? String(index) : null))
        .filter(field => field !== null);
    await Promise.all([ANSWERS_FIELD, ...fields].map(field => answerStatsStore.increment(sPin, slot, field)));
}

/**
 * Datos del reveal: la frase con marcadores, las palabras, sus longitudes y cuántos
 * acertaron cada hueco. Presentador y TV pintan las letras; a los jugadores solo
 * les llega text/words/lengths (RevealTypePayloads).
 * @returns {Promise<{ text: string, words: string[], lengths: number[], stats: { answers: number, counts: number[] } }>}
 */
async function buildFillBlanksReveal(roomId, slot, question) {
    const words = getQuestionWords(question);
    const stats = (await answerStatsStore.getStats(roomId, statsSlot(slot))) || {};
    return {
        text: question.question_text || '',
        words,
        lengths: words.map(word => word.length),
        stats: {
            answers: stats[ANSWERS_FIELD] || 0,
            counts: words.map((_, index) => stats[index] || 0)
        }
    };
}

module.exports = {
    recordFillBlanksStats,
    buildFillBlanksReveal
};
