/**
 * @fileoverview Servicio de carga de configuración de rachas desde base de datos
 *
 * Lee los campos de racha (use_streaks, streak_threshold, …) de la tabla correcta
 * según el tipo de juego. Usado al iniciar una partida para poblar game.use_streaks, etc.
 */

'use strict';

const { pool } = require('../../config/database');
const logger = require('../../config/logger');

// Mapa tipo → tabla donde están las columnas de racha
const TABLE_BY_TYPE = {
    game: 'games',
    custom_game: 'custom_games',
    trivial: 'trivial_games',
    bank: 'question_banks',
};

const STREAK_FIELDS = [
    'use_streaks',
    'streak_threshold',
    'streak_bonus_percentage',
    'use_double_streaks',
    'double_streak_threshold',
    'double_streak_bonus_percentage',
].join(', ');

const DEFAULTS = {
    use_streaks: false,
    streak_threshold: 3,
    streak_bonus_percentage: 0.50,
    use_double_streaks: false,
    double_streak_threshold: 5,
    double_streak_bonus_percentage: 1.00,
};

/**
 * Carga la configuración de rachas para un juego dado.
 *
 * @param {string} type  Tipo de juego: 'game' | 'custom_game' | 'trivial' | 'bank'
 * @param {number} id    ID del registro en la tabla correspondiente
 * @returns {Promise<Object>} Objeto con los 6 campos de streak (con defaults si falla)
 */
async function getStreakConfig(type, id) {
    const table = TABLE_BY_TYPE[type];
    if (!table) {
        logger.debug('getStreakConfig: tipo desconocido, usando defaults', { type, id });
        return { ...DEFAULTS };
    }

    try {
        const res = await pool.query(
            `SELECT ${STREAK_FIELDS} FROM ${table} WHERE id = $1`,
            [id]
        );
        if (!res.rows.length) {
            logger.warn('getStreakConfig: registro no encontrado, usando defaults', { type, id });
            return { ...DEFAULTS };
        }
        const row = res.rows[0];
        // Coerce values (PostgreSQL returns booleans but JSON round-trip can change them)
        return {
            use_streaks: !!row.use_streaks,
            streak_threshold: Number(row.streak_threshold) || DEFAULTS.streak_threshold,
            streak_bonus_percentage: parseFloat(row.streak_bonus_percentage) || DEFAULTS.streak_bonus_percentage,
            use_double_streaks: !!row.use_double_streaks,
            double_streak_threshold: Number(row.double_streak_threshold) || DEFAULTS.double_streak_threshold,
            double_streak_bonus_percentage: parseFloat(row.double_streak_bonus_percentage) || DEFAULTS.double_streak_bonus_percentage,
        };
    } catch (err) {
        logger.warn('getStreakConfig: error de BD, usando defaults', { type, id, error: err.message });
        return { ...DEFAULTS };
    }
}

module.exports = { getStreakConfig };
