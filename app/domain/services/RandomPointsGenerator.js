/**
 * @fileoverview Sorteo de los puntos base de una pregunta con puntuación aleatoria.
 *
 * El valor se genera UNA sola vez por pregunta y siempre en servidor
 * (ver sockets/utils/QuestionTransitionManager.js). El RNG es inyectable para
 * poder testear límites y determinismo.
 *
 * ARQUITECTURA: Domain Service (función pura salvo por el RNG inyectado).
 *
 * @module domain/services/RandomPointsGenerator
 */

'use strict';

const { SCORING } = require('../../config/game-constants');

const { MIN_VALUE, MAX_VALUE, DEFAULT_MIN, DEFAULT_MAX } = SCORING.RANDOM_POINTS;

function clamp(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;

    const numeric = Math.trunc(Number(value));
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(MAX_VALUE, Math.max(MIN_VALUE, numeric));
}

/**
 * Sortea un entero en [min, max], ambos inclusive.
 *
 * Defensivo por diseño: valores ausentes o fuera de rango caen a los límites
 * admitidos, y un rango invertido se corrige intercambiando los extremos, de
 * forma que nunca devuelve NaN ni un valor negativo aunque la BD traiga basura.
 *
 * @param {Object} params
 * @param {number} params.min
 * @param {number} params.max
 * @param {Function} [params.rng] - Devuelve un float en [0, 1)
 * @returns {number} Entero en [min, max]
 */
function generateRandomPoints({ min, max, rng = Math.random } = {}) {
    let low = clamp(min, DEFAULT_MIN);
    let high = clamp(max, DEFAULT_MAX);

    if (high < low) {
        [low, high] = [high, low];
    }

    if (low === high) {
        return low;
    }

    const span = high - low + 1;
    const draw = Math.floor(rng() * span);

    // rng() puede devolver exactamente 1 en implementaciones inyectadas
    return low + Math.min(span - 1, Math.max(0, draw));
}

/**
 * Sortea el valor de la pregunta actual a partir de la configuración del juego.
 *
 * @param {Object} game - Juego en memoria, con random_points_min/max
 * @param {Function} [rng]
 * @returns {number}
 */
function generateForGame(game, rng = Math.random) {
    return generateRandomPoints({
        min: game?.random_points_min,
        max: game?.random_points_max,
        rng,
    });
}

module.exports = { generateRandomPoints, generateForGame };
