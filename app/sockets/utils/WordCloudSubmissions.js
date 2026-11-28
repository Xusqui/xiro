/**
 * @fileoverview «Nube de palabras»: cupo y repetidas por jugador. Cada jugador tiene en Redis un
 * set con las claves de agrupado de sus palabras (compartido entre workers). Un script Lua
 * decide en una sola operación atómica si la palabra es repetida, si ya no cabe o si entra;
 * así dos envíos simultáneos del mismo jugador nunca superan el cupo.
 */

'use strict';

const { getRedisClient } = require('../../config/redis');

const TTL_SECONDS = 6 * 60 * 60;
const MAX_QUOTA = 5;
const REPLY_QUOTA_FULL = -1;
const REPLY_DUPLICATE = -2;

// Repetida primero: no gasta cupo aunque el jugador ya haya llegado al límite.
const SUBMIT_SCRIPT = `
    if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return -2 end
    if redis.call('SCARD', KEYS[1]) >= tonumber(ARGV[2]) then return -1 end
    redis.call('SADD', KEYS[1], ARGV[1])
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    return redis.call('SCARD', KEYS[1])
`;

/**
 * Clave Redis del set de palabras de un jugador en una pregunta.
 * @param {string} sessionId
 * @param {string|number} questionIndex
 * @param {string} nickname
 * @returns {string}
 */
function playerWordsKey(sessionId, questionIndex, nickname) {
    return `wordcloud:${sessionId}:${questionIndex}:player:${nickname}`;
}

/**
 * Clave Redis de la marca «ya pulsó Enviar» de un jugador en una pregunta.
 * @param {string} sessionId
 * @param {string|number} questionIndex
 * @param {string} nickname
 * @returns {string}
 */
function finishedKey(sessionId, questionIndex, nickname) {
    return `wordcloud:${sessionId}:${questionIndex}:finished:${nickname}`;
}

function assertValid({ wordKey, nickname, maxWords }) {
    if (!wordKey || !nickname) throw new Error('WordCloudSubmissions: faltan la palabra o el jugador');
    if (!Number.isInteger(maxWords) || maxWords < 1 || maxWords > MAX_QUOTA) {
        throw new Error(`WordCloudSubmissions: el cupo debe ser un entero de 1 a ${MAX_QUOTA}`);
    }
}

function interpretReply(reply) {
    if (reply === REPLY_DUPLICATE) return { status: 'duplicate' };
    if (reply === REPLY_QUOTA_FULL) return { status: 'quota-full' };
    return { status: 'accepted', used: reply };
}

/**
 * Registra la palabra de un jugador si es nueva y le queda cupo.
 * @param {Object} options
 * @param {string} options.sessionId - Sesión
 * @param {string|number} options.questionIndex - Pregunta
 * @param {string} options.nickname - Jugador
 * @param {string} options.wordKey - Clave de agrupado de la palabra
 * @param {number} options.maxWords - Cupo del jugador (1 a 5)
 * @returns {Promise<{status: 'accepted', used: number}|{status: 'duplicate'}|{status: 'quota-full'}>}
 * @throws {Error} Si la llamada está mal formada o falla Redis
 */
async function submitWord(options) {
    assertValid(options);
    const client = await getRedisClient();
    const reply = await client.eval(SUBMIT_SCRIPT, {
        keys: [playerWordsKey(options.sessionId, options.questionIndex, options.nickname)],
        arguments: [options.wordKey, String(options.maxWords), String(TTL_SECONDS)]
    });
    return interpretReply(reply);
}

/**
 * Marca al jugador como terminado: ya envió sus palabras y no se admiten más.
 * @param {{sessionId: string, questionIndex: string|number, nickname: string}} room
 * @returns {Promise<void>}
 * @throws {Error} Si falla Redis
 */
async function markFinished({ sessionId, questionIndex, nickname }) {
    const client = await getRedisClient();
    await client.set(finishedKey(sessionId, questionIndex, nickname), '1', { EX: TTL_SECONDS });
}

/**
 * @param {{sessionId: string, questionIndex: string|number, nickname: string}} room
 * @returns {Promise<boolean>} Si el jugador ya pulsó Enviar
 * @throws {Error} Si falla Redis
 */
async function isFinished({ sessionId, questionIndex, nickname }) {
    const client = await getRedisClient();
    return Number(await client.exists(finishedKey(sessionId, questionIndex, nickname))) === 1;
}

module.exports = { submitWord, playerWordsKey, finishedKey, markFinished, isFinished };
