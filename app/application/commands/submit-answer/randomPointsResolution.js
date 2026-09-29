/**
 * @fileoverview Resolución del valor de puntuación aleatoria de la pregunta actual.
 * @module application/commands/submit-answer/randomPointsResolution
 *
 * El valor lo genera una sola vez el worker que avanza la pregunta
 * (sockets/utils/QuestionTransitionManager.js) y se propaga por pub/sub. Este
 * módulo es el fallback para el worker que se perdió ese mensaje, siguiendo el
 * mismo patrón que `resolveCanonicalQuestionStartTime` con la epoch de la pregunta.
 */

'use strict';

const { getRedisClient } = require('../../../config/redis');
const logger = require('../../../config/logger');
const { usesRandomPoints, resolveBasePoints } = require('../../../domain/services/QuestionScoringPolicy');

const REDIS_KEY_PREFIX = 'game:randompoints:';

/**
 * Clave Redis canónica del valor sorteado de una sala.
 * @param {string} roomId
 * @returns {string}
 */
function randomPointsKey(roomId) {
    return `${REDIS_KEY_PREFIX}${roomId}`;
}

/**
 * Persiste el valor sorteado para que cualquier worker pueda recuperarlo.
 * Fire-and-forget, igual que `game:questionstart:`.
 *
 * @param {Object} params
 * @param {string} params.roomId
 * @param {number} params.questionIndex
 * @param {number} params.points
 */
function persistRandomPoints({ roomId, questionIndex, points }) {
    Promise.resolve(getRedisClient())
        .then(rc => rc.set(
            randomPointsKey(roomId),
            JSON.stringify({ index: questionIndex, points }),
            { EX: 7200 }
        ))
        .catch(err => logger.warn('Failed to persist random points to Redis', {
            roomId,
            error: err.message
        }));
}

/**
 * Devuelve los puntos base de la pregunta actual, o `undefined` si no aplica.
 *
 * Si el juego usa puntuación aleatoria pero este worker no tiene el valor en
 * memoria (se perdió el pub/sub), lo recupera de Redis y lo deja cacheado en
 * `game.currentRandomPoints` para el resto de respuestas de la misma pregunta.
 *
 * @param {Object} params
 * @param {Object} params.game
 * @param {Object} params.currentQuestion
 * @param {string} params.sPin
 * @returns {Promise<number|undefined>}
 */
async function resolveCanonicalRandomPoints({ game, currentQuestion, sPin }) {
    if (!usesRandomPoints(currentQuestion, game)) {
        return undefined;
    }

    const local = resolveBasePoints(currentQuestion, game);
    if (local !== undefined) {
        return local;
    }

    try {
        const redisClient = await getRedisClient();
        const raw = await redisClient.get(randomPointsKey(sPin));
        if (!raw) return undefined;

        const parsed = JSON.parse(raw);
        if (parsed?.index !== game.currentIndex) {
            logger.warn('Random points in Redis belong to another question — ignoring', {
                roomId: sPin,
                redisIndex: parsed?.index,
                currentIndex: game.currentIndex
            });
            return undefined;
        }

        const points = Number(parsed.points);
        if (!Number.isFinite(points) || points <= 0) return undefined;

        game.currentRandomPoints = points;
        logger.warn('Recovered random points from Redis on non-originating worker', {
            roomId: sPin,
            currentIndex: game.currentIndex,
            points
        });
        return points;
    } catch (error) {
        logger.warn('Could not read random points from Redis, falling back to BASE_POINTS', {
            roomId: sPin,
            error: error.message
        });
        return undefined;
    }
}

module.exports = {
    randomPointsKey,
    persistRandomPoints,
    resolveCanonicalRandomPoints,
};
