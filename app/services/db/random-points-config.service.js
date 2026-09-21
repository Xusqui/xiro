/**
 * @fileoverview Servicio de carga de configuración de puntuación aleatoria desde BD
 *
 * Lee los campos (use_random_points, random_points_min, random_points_max) de la tabla
 * correcta según el tipo de juego. Usado al iniciar una partida para poblar
 * game.use_random_points, etc. Gemelo de streak-config.service.js.
 */

'use strict';

const { pool } = require('../../config/database');
const logger = require('../../config/logger');
const { SCORING } = require('../../config/game-constants');

// Mapa tipo → tabla donde están las columnas de puntuación aleatoria
const TABLE_BY_TYPE = {
    game: 'games',
    custom_game: 'custom_games',
    trivial: 'trivial_games',
    bank: 'question_banks',
};

const RANDOM_POINTS_FIELDS = [
    'use_random_points',
    'random_points_min',
    'random_points_max',
].join(', ');

const DEFAULTS = {
    use_random_points: false,
    random_points_min: SCORING.RANDOM_POINTS.DEFAULT_MIN,
    random_points_max: SCORING.RANDOM_POINTS.DEFAULT_MAX,
};

/**
 * Carga la configuración de puntuación aleatoria para un juego dado.
 *
 * @param {string} type  Tipo de juego: 'game' | 'custom_game' | 'trivial' | 'bank'
 * @param {number} id    ID del registro en la tabla correspondiente
 * @returns {Promise<Object>} Objeto con los 3 campos (con defaults si falla)
 */
async function getRandomPointsConfig(type, id) {
    const table = TABLE_BY_TYPE[type];
    if (!table) {
        logger.debug('getRandomPointsConfig: tipo desconocido, usando defaults', { type, id });
        return { ...DEFAULTS };
    }

    try {
        const res = await pool.query(
            `SELECT ${RANDOM_POINTS_FIELDS} FROM ${table} WHERE id = $1`,
            [id]
        );
        if (!res.rows.length) {
            logger.warn('getRandomPointsConfig: registro no encontrado, usando defaults', { type, id });
            return { ...DEFAULTS };
        }
        const row = res.rows[0];
        // Coerce values (PostgreSQL returns booleans but JSON round-trip can change them)
        return {
            use_random_points: !!row.use_random_points,
            random_points_min: Number(row.random_points_min) || DEFAULTS.random_points_min,
            random_points_max: Number(row.random_points_max) || DEFAULTS.random_points_max,
        };
    } catch (err) {
        logger.warn('getRandomPointsConfig: error de BD, usando defaults', { type, id, error: err.message });
        return { ...DEFAULTS };
    }
}

module.exports = { getRandomPointsConfig, DEFAULTS };
