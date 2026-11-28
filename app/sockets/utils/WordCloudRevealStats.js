/**
 * @fileoverview «Nube de palabras»: recuento y reveal. Cada palabra aceptada suma en el hash
 * `<pregunta>:wc` de AnswerStatsStore (campo `clave<TAB>texto`, compartido entre workers). Las
 * palabras que oculta el presentador van a un set de Redis aparte, válido para todos los workers.
 * La nube que ven las pantallas junta ambos y agrupa las variantes (WordCloudAggregation).
 */

'use strict';

const answerStatsStore = require('../../services/AnswerStatsStore');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');
const { fieldFor, aggregateWords, totalWords } = require('../../domain/services/WordCloudAggregation');

const HIDDEN_TTL_SECONDS = 6 * 60 * 60;

function statsSlot(questionIndex) {
    return `${questionIndex}:wc`;
}

/**
 * Clave Redis del set de palabras ocultas de una pregunta.
 * @param {string} sessionId
 * @param {string|number} questionIndex
 * @returns {string}
 */
function hiddenWordsKey(sessionId, questionIndex) {
    return `wordcloud:${sessionId}:${questionIndex}:hidden`;
}

/**
 * Suma una vez la variante escrita de una palabra aceptada.
 * @param {Object} options
 * @param {string} options.sessionId
 * @param {string|number} options.questionIndex
 * @param {string} options.wordKey - Clave de agrupado
 * @param {string} options.text - Texto tal como lo escribió el jugador
 * @returns {Promise<void>}
 */
async function recordWord({ sessionId, questionIndex, wordKey, text }) {
    await answerStatsStore.increment(sessionId, statsSlot(questionIndex), fieldFor(text, wordKey));
}

/**
 * Oculta una palabra (todas sus variantes) de la nube de la pregunta.
 * @param {Object} options
 * @param {string} options.sessionId
 * @param {string|number} options.questionIndex
 * @param {string} options.wordKey - Clave de agrupado de la palabra a ocultar
 * @returns {Promise<void>}
 * @throws {Error} Si falla Redis
 */
async function hideWord({ sessionId, questionIndex, wordKey }) {
    const client = await getRedisClient();
    const key = hiddenWordsKey(sessionId, questionIndex);
    await client.sAdd(key, wordKey);
    await client.expire(key, HIDDEN_TTL_SECONDS);
}

/** Claves ocultas; si Redis falla se registra y se devuelve vacío para no romper el reveal. */
async function readHiddenKeys(sessionId, questionIndex) {
    try {
        const client = await getRedisClient();
        return await client.sMembers(hiddenWordsKey(sessionId, questionIndex));
    } catch (error) {
        logger.warn('No se pudieron leer las palabras ocultas de la nube', {
            sessionId,
            questionIndex,
            error: error.message
        });
        return [];
    }
}

/**
 * Nube de la pregunta: palabras visibles agrupadas y ordenadas, con el total escrito.
 * @param {string} sessionId
 * @param {string|number} questionIndex
 * @returns {Promise<{words: Array<{key: string, text: string, count: number}>, total: number}>}
 */
async function buildWordCloudReveal(sessionId, questionIndex) {
    const [stats, hiddenKeys] = await Promise.all([
        answerStatsStore.getStats(sessionId, statsSlot(questionIndex)),
        readHiddenKeys(sessionId, questionIndex)
    ]);
    const words = aggregateWords(stats, { hiddenKeys });
    return { words, total: totalWords(words) };
}

module.exports = { recordWord, hideWord, buildWordCloudReveal, hiddenWordsKey };
