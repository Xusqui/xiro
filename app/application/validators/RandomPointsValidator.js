/**
 * @fileoverview Validación de la configuración de puntuación aleatoria de un juego.
 *
 * Fuente de verdad única para servidor y cliente: `validation.js` (Joi) lo usa para
 * la comprobación cruzada min/max, y `routes/trivial.routes.js` — que no valida con
 * Joi — lo usa directamente. El módulo admin del panel replica estas mismas reglas.
 *
 * @module application/validators/RandomPointsValidator
 */

'use strict';

const { SCORING } = require('../../config/game-constants');

const { MIN_VALUE, MAX_VALUE, DEFAULT_MIN, DEFAULT_MAX } = SCORING.RANDOM_POINTS;

const ERROR_CODES = {
    NOT_INTEGER: 'random-points-not-integer',
    OUT_OF_RANGE: 'random-points-out-of-range',
    INVERTED_RANGE: 'random-points-inverted-range',
};

function isInteger(value) {
    return Number.isInteger(Number(value)) && String(value).trim() !== '';
}

/**
 * Valida el trío de campos de puntuación aleatoria.
 *
 * Con `use_random_points` desactivado no se valida el rango: el juego se comporta
 * exactamente como hoy y los valores guardados son irrelevantes.
 *
 * @param {Object} config
 * @param {boolean} [config.use_random_points]
 * @param {number|string} [config.random_points_min]
 * @param {number|string} [config.random_points_max]
 * @returns {{ valid: boolean, code: string|null, field: string|null }}
 */
function validateRandomPointsConfig(config = {}) {
    if (!config.use_random_points) {
        return { valid: true, code: null, field: null };
    }

    const min = config.random_points_min;
    const max = config.random_points_max;

    for (const [field, value] of [['random_points_min', min], ['random_points_max', max]]) {
        if (!isInteger(value)) {
            return { valid: false, code: ERROR_CODES.NOT_INTEGER, field };
        }
        const numeric = Number(value);
        if (numeric < MIN_VALUE || numeric > MAX_VALUE) {
            return { valid: false, code: ERROR_CODES.OUT_OF_RANGE, field };
        }
    }

    if (Number(max) < Number(min)) {
        return { valid: false, code: ERROR_CODES.INVERTED_RANGE, field: 'random_points_max' };
    }

    return { valid: true, code: null, field: null };
}

/**
 * Normaliza el trío para persistirlo, aplicando defaults ante valores ausentes.
 *
 * @param {Object} [config]
 * @returns {{ use_random_points: boolean, random_points_min: number, random_points_max: number }}
 */
function normalizeRandomPointsConfig(config = {}) {
    const min = isInteger(config.random_points_min) ? Number(config.random_points_min) : DEFAULT_MIN;
    const max = isInteger(config.random_points_max) ? Number(config.random_points_max) : DEFAULT_MAX;

    return {
        use_random_points: !!config.use_random_points,
        random_points_min: min,
        random_points_max: max,
    };
}

module.exports = {
    ERROR_CODES,
    MIN_VALUE,
    MAX_VALUE,
    DEFAULT_MIN,
    DEFAULT_MAX,
    validateRandomPointsConfig,
    normalizeRandomPointsConfig,
};
