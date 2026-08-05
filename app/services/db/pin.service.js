/**
 * @fileoverview PIN validation database operations
 * @module services/db/pin.service
 */

const { pool } = require('../../config/database');
const metrics = require('../../state/metrics');
const logger = require('../../config/logger');
const pinCache = require('../pin-cache.service');

/**
 * Valida que un PIN exista en la base de datos (cualquier tipo)
 * OPTIMIZADO: 1 query UNION en lugar de 4 queries secuenciales + caché
 * @param {string} pin - PIN a validar
 * @returns {Promise<{valid: boolean, type: string|null, id: number|null}>}
 */
async function validatePinInDatabase(pin) {
    const sPin = String(pin).toUpperCase();

    const cached = pinCache.get(sPin);
    if (cached !== null) {
        return cached;
    }

    const startTime = Date.now();

    try {
        const result = await pool.query(`
            SELECT id, 'custom_game' as type FROM custom_games WHERE pin = $1
            UNION ALL
            SELECT id, 'game' as type FROM games WHERE pin = $1
            UNION ALL
            SELECT id, 'bank' as type FROM question_banks WHERE pin = $1
            UNION ALL
            SELECT id, 'quiz' as type FROM quizzes WHERE pin = $1
            UNION ALL
            SELECT id, 'trivial' as type FROM trivial_games WHERE pin = $1
            LIMIT 1
        `, [sPin]);

        metrics.recordDbQuery(Date.now() - startTime);

        let response;
        if (result.rows.length > 0) {
            response = {
                valid: true,
                type: result.rows[0].type,
                id: result.rows[0].id
            };
        } else {
            response = { valid: false, type: null, id: null };
        }

        pinCache.set(sPin, response.valid, response.type, response.id);
        return response;
    } catch (err) {
        metrics.recordDbError();
        logger.error('Error validando PIN en BD:', err);
        return { valid: false, type: null, id: null };
    }
}

/**
 * Valida un PIN y verifica que sea visible para el presentador
 * @param {string} pin - PIN a validar
 * @returns {Promise<{valid: boolean, type: string|null, id: number|null}>}
 */
async function validatePinForPresenter(pin) {
    const sPin = String(pin).toUpperCase();
    const cacheKey = `presenter:${sPin}`;

    const cached = pinCache.get(cacheKey);
    if (cached !== null) {
        return cached;
    }

    const startTime = Date.now();

    try {
        const result = await pool.query(`
            SELECT id, 'custom_game' as type FROM custom_games 
            WHERE pin = $1 AND visible_to_presenter = true
            UNION ALL
            SELECT id, 'game' as type FROM games 
            WHERE pin = $1 AND visible_to_presenter = true
            UNION ALL
            SELECT id, 'bank' as type FROM question_banks 
            WHERE pin = $1 AND visible_to_presenter = true
            UNION ALL
            SELECT id, 'quiz' as type FROM quizzes WHERE pin = $1
            UNION ALL
            SELECT id, 'trivial' as type FROM trivial_games 
            WHERE pin = $1 AND visible_to_presenter = true
            LIMIT 1
        `, [sPin]);

        metrics.recordDbQuery(Date.now() - startTime);

        let response;
        if (result.rows.length > 0) {
            response = {
                valid: true,
                type: result.rows[0].type,
                id: result.rows[0].id
            };
        } else {
            response = { valid: false, type: null, id: null };
        }

        pinCache.set(cacheKey, response.valid, response.type, response.id);
        return response;
    } catch (err) {
        metrics.recordDbError();
        logger.error('Error validando PIN para presentador:', err);
        return { valid: false, type: null, id: null };
    }
}

/**
 * Verifica si un PIN de banco existe
 * @param {string} pin - PIN a validar
 * @param {number} excludeId - ID del banco a excluir (opcional)
 * @returns {Promise<boolean>}
 */
async function bankPinExists(pin, excludeId = null) {
    let query = 'SELECT id FROM question_banks WHERE pin = $1';
    const params = [pin];
    if (excludeId) {
        query += ' AND id != $2';
        params.push(excludeId);
    }
    const result = await pool.query(query, params);
    return result.rows.length > 0;
}

/**
 * Verifica si un PIN de juego existe
 * @param {string} pin - PIN a validar
 * @param {number} excludeId - ID del juego a excluir (opcional)
 * @returns {Promise<boolean>}
 */
async function gamePinExists(pin, excludeId = null) {
    let query = 'SELECT id FROM games WHERE pin = $1';
    const params = [pin];
    if (excludeId) {
        query += ' AND id != $2';
        params.push(excludeId);
    }
    const result = await pool.query(query, params);
    return result.rows.length > 0;
}

/**
 * ⭐ NUEVO: Verifica si un PIN existe en CUALQUIER parte del sistema (globalmente)
 * Útil para prevenir duplicados entre bancos, juegos, custom games y quizzes
 * @param {string} pin - PIN a validar
 * @param {Object} options - Opciones de búsqueda
 * @param {string} options.excludeType - Tipo de entidad a excluir ('bank', 'game', 'custom_game', 'quiz')
 * @param {number} options.excludeId - ID de la entidad a excluir
 * @returns {Promise<{exists: boolean, conflictType: string|null, conflictId: number|null}>}
 */
async function pinExistsGlobally(pin, options = {}) {
    const { excludeType = null, excludeId = null } = options;

    const query = `
        SELECT id, 'custom_game' as type FROM custom_games WHERE pin = $1
        UNION ALL
        SELECT id, 'game' as type FROM games WHERE pin = $1
        UNION ALL
        SELECT id, 'bank' as type FROM question_banks WHERE pin = $1
        UNION ALL
        SELECT id, 'quiz' as type FROM quizzes WHERE pin = $1
        UNION ALL
        SELECT id, 'trivial' as type FROM trivial_games WHERE pin = $1
    `;

    const result = await pool.query(query, [pin]);

    // Si no hay resultados, el PIN está libre
    if (result.rows.length === 0) {
        return { exists: false, conflictType: null, conflictId: null };
    }

    // Si hay resultados, verificar si alguno es diferente al que excluimos
    for (const row of result.rows) {
        if (excludeType && excludeId) {
            // Excluir solo si es exactamente el mismo tipo e ID
            if (row.type === excludeType && row.id === excludeId) {
                continue; // Este es el mismo, lo ignoramos
            }
        }

        // Encontramos un conflicto
        return {
            exists: true,
            conflictType: row.type,
            conflictId: row.id
        };
    }

    // Si llegamos aquí, todos los resultados fueron del mismo tipo/ID, así que está libre
    return { exists: false, conflictType: null, conflictId: null };
}

/**
 * Obtiene todos los PINs del sistema (para admin)
 * @returns {Promise<Array>}
 */
async function getAllPins() {
    const pins = [];

    const games = await pool.query(
        'SELECT pin, name FROM games WHERE pin IS NOT NULL ORDER BY created_at DESC'
    );
    games.rows.forEach(g => pins.push({ pin: g.pin, name: g.name, type: 'Juego' }));

    const customGames = await pool.query(
        'SELECT pin, name FROM custom_games WHERE pin IS NOT NULL ORDER BY created_at DESC'
    );
    customGames.rows.forEach(cg => pins.push({ pin: cg.pin, name: cg.name, type: 'Juego Personalizado' }));

    const banks = await pool.query(
        'SELECT pin, name FROM question_banks WHERE pin IS NOT NULL ORDER BY created_at DESC'
    );
    banks.rows.forEach(b => pins.push({ pin: b.pin, name: b.name, type: 'Banco' }));

    const quizzes = await pool.query(
        'SELECT pin FROM quizzes WHERE pin IS NOT NULL ORDER BY created_at DESC'
    );
    quizzes.rows.forEach(q => pins.push({ pin: q.pin, name: `Quiz ${q.pin}`, type: 'Quiz' }));

    const trivials = await pool.query(
        'SELECT pin, name FROM trivial_games WHERE pin IS NOT NULL ORDER BY created_at DESC'
    );
    trivials.rows.forEach(t => pins.push({ pin: t.pin, name: t.name, type: 'Trivial' }));

    return pins;
}

/**
 * Obtiene solo los PINs visibles para el presentador
 * @returns {Promise<Array>}
 */
async function getPinsForPresenter() {
    const [games, customGames, banks, quizzes, trivials] = await Promise.all([
        pool.query(`
            SELECT g.pin, g.name,
                COALESCE(SUM(gb.question_count), 0)
                    + CASE WHEN BOOL_OR(gb.question_count IS NULL) THEN COALESCE(g.pool_question_count, 0) ELSE 0 END
                    AS question_count
            FROM games g
            LEFT JOIN game_banks gb ON gb.game_id = g.id
            WHERE g.pin IS NOT NULL AND g.visible_to_presenter = true
            GROUP BY g.id, g.pin, g.name, g.pool_question_count, g.created_at
            ORDER BY g.created_at DESC
        `),
        pool.query(`
            SELECT cg.pin, cg.name, COALESCE(q.question_count, 0) AS question_count
            FROM custom_games cg
            LEFT JOIN (
                SELECT custom_game_id, COUNT(*) AS question_count
                FROM custom_game_questions
                GROUP BY custom_game_id
            ) q ON q.custom_game_id = cg.id
            WHERE cg.pin IS NOT NULL AND cg.visible_to_presenter = true
            ORDER BY cg.created_at DESC
        `),
        pool.query(`
            SELECT qb.pin, qb.name, COALESCE(q.question_count, 0) AS question_count
            FROM question_banks qb
            LEFT JOIN (
                SELECT bank_id, COUNT(*) AS question_count
                FROM questions
                GROUP BY bank_id
            ) q ON q.bank_id = qb.id
            WHERE qb.pin IS NOT NULL AND qb.visible_to_presenter = true
            ORDER BY qb.created_at DESC
        `),
        pool.query(`
            SELECT qz.pin, COALESCE(q.question_count, 0) AS question_count
            FROM quizzes qz
            LEFT JOIN (
                SELECT quiz_id, COUNT(*) AS question_count
                FROM questions
                GROUP BY quiz_id
            ) q ON q.quiz_id = qz.id
            WHERE qz.pin IS NOT NULL
            ORDER BY qz.created_at DESC
        `),
        pool.query('SELECT pin, name FROM trivial_games WHERE pin IS NOT NULL AND visible_to_presenter = true ORDER BY created_at DESC'),
    ]);

    return [
        ...games.rows.map(g => ({ pin: g.pin, name: g.name, type: 'Juego', question_count: Number(g.question_count) || 0 })),
        ...customGames.rows.map(cg => ({ pin: cg.pin, name: cg.name, type: 'Juego Personalizado', question_count: Number(cg.question_count) || 0 })),
        ...banks.rows.map(b => ({ pin: b.pin, name: b.name, type: 'Banco', question_count: Number(b.question_count) || 0 })),
        ...quizzes.rows.map(q => ({ pin: q.pin, name: `Quiz ${q.pin}`, type: 'Quiz', question_count: Number(q.question_count) || 0 })),
        ...trivials.rows.map(t => ({ pin: t.pin, name: t.name, type: 'Trivial' })),
    ];
}

module.exports = {
    validatePinInDatabase,
    validatePinForPresenter,
    bankPinExists,
    gamePinExists,
    pinExistsGlobally,
    getAllPins,
    getPinsForPresenter
};
