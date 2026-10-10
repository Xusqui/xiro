/**
 * @fileoverview Sopa de letras: pistas pedidas por cada jugador o, en equipos,
 * por cada equipo (la pista de uno vale para todo el equipo).
 *
 * Se guardan en Redis (compartido entre workers) porque la pista se pide en un
 * evento y la respuesta puede llegar a otro worker: al puntuar, cada palabra
 * encontrada con pista vale la mitad (WordSearchService.processWordSearchAnswer).
 * Clave: game:wshints:<sala>:<pregunta>:<dueño> → conjunto de índices de palabra.
 * Dueño: "player:<nickname>" o "team:<nombre del equipo>" (ver hintOwner).
 */

'use strict';

const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

const HINTS_TTL_SECONDS = 7200;

function hintsKey(sPin, questionIndex, owner) {
    return `game:wshints:${sPin}:${questionIndex}:${owner}`;
}

/** Dueño de las pistas: el equipo si juega en equipos, si no el jugador. */
function hintOwner(nickname, team) {
    return team ? `team:${team.name}` : `player:${nickname}`;
}

/**
 * Anota que `owner` pidió pista para la palabra `wordIndex`.
 * @returns {Promise<boolean>} true si es una pista nueva (no la había pedido nadie del equipo)
 */
async function recordWordSearchHint(sPin, questionIndex, owner, wordIndex) {
    const key = hintsKey(sPin, questionIndex, owner);
    const redis = await getRedisClient();
    const [added] = await redis.multi().sAdd(key, String(wordIndex)).expire(key, HINTS_TTL_SECONDS).exec();
    return Number(added) > 0;
}

/**
 * Índices de las palabras con pista. Si Redis falla devuelve [] (se puntúa sin
 * descuento: mejor regalar media palabra que perder la respuesta).
 * @returns {Promise<number[]>}
 */
async function getWordSearchHints(sPin, questionIndex, owner) {
    try {
        const redis = await getRedisClient();
        const members = await redis.sMembers(hintsKey(sPin, questionIndex, owner));
        return (members || []).map(Number).filter(Number.isInteger);
    } catch (error) {
        logger.warn('No se pudieron leer las pistas de la sopa de letras', { sPin, questionIndex, owner, error: error.message });
        return [];
    }
}

module.exports = {
    hintOwner,
    recordWordSearchHint,
    getWordSearchHints
};
