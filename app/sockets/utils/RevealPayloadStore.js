/**
 * @fileoverview Payload del presentador de cada pregunta revelada, en Redis
 * (`game:revealpayload:<sala>`, campo = índice de la pregunta).
 *
 * Lo guarda GameEndManager al revelar. La revisión de diapositivas de los juegos
 * personalizados lo busca primero en memoria (`game.revealPayloads`, que también
 * reparte la sincronía question-revealed) y, si este worker no lo tiene, aquí.
 */

'use strict';

const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

const TTL_SECONDS = 7200;

const keyFor = roomId => `game:revealpayload:${roomId}`;

/**
 * @param {string} roomId
 * @param {number} index
 * @param {Object} payload - Payload del presentador ('reveal-answer')
 * @returns {Promise<void>} Nunca rechaza: un fallo de Redis no debe romper el reveal
 */
async function saveRevealPayload(roomId, index, payload) {
    try {
        const redis = await getRedisClient();
        await redis.hSet(keyFor(roomId), String(index), JSON.stringify(payload));
        await redis.expire(keyFor(roomId), TTL_SECONDS);
    } catch (err) {
        logger.warn('No se pudo guardar el payload del reveal', { roomId, index, error: err.message });
    }
}

/**
 * @param {string} roomId
 * @param {number} index
 * @returns {Promise<Object|null>}
 */
async function loadRevealPayload(roomId, index) {
    try {
        const redis = await getRedisClient();
        const raw = await redis.hGet(keyFor(roomId), String(index));
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        logger.warn('No se pudo leer el payload del reveal', { roomId, index, error: err.message });
        return null;
    }
}

/**
 * Memoria primero; lo leído de Redis se deja en memoria para la próxima vez.
 *
 * @param {string} roomId
 * @param {Object} game - Partida en memoria (activeGames)
 * @param {number} index
 * @returns {Promise<Object|null>}
 */
async function findRevealPayload(roomId, game, index) {
    const inMemory = game?.revealPayloads?.[index];
    if (inMemory) return inMemory;

    const stored = await loadRevealPayload(roomId, index);
    if (stored && game) {
        game.revealPayloads = game.revealPayloads || {};
        game.revealPayloads[index] = stored;
    }
    return stored;
}

module.exports = { saveRevealPayload, loadRevealPayload, findRevealPayload };
