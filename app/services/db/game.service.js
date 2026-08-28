/**
 * @fileoverview Games database operations
 * @module services/db/game.service
 */

const { pool } = require('../../config/database');
const metrics = require('../../state/metrics');
const logger = require('../../config/logger');
const { questionBankCache } = require('../cache.service');
const pinCache = require('../pin-cache.service');
const {
    assertEditorCanModifyResource,
    normalizeCreatorRole
} = require('./resource-ownership.service');

/**
 * Obtiene todos los juegos con sus bancos
 * @returns {Promise<Array>}
 */
async function getAllGames() {
    const result = await pool.query(`
        SELECT g.*, au.username AS created_by_username,
            json_agg(json_build_object('bank_id', gb.bank_id, 'bank_name', qb.name, 'question_count', gb.question_count)) as banks
        FROM games g
        LEFT JOIN admin_users au ON au.id = g.created_by_user_id
        LEFT JOIN game_banks gb ON g.id = gb.game_id
        LEFT JOIN question_banks qb ON gb.bank_id = qb.id
        GROUP BY g.id, au.username
        ORDER BY g.created_at DESC
    `);
    return result.rows;
}

/**
 * Obtiene todos los juegos con paginación
 * @param {Object} opts - { page, limit }
 * @returns {Promise<{games: Array, total: number, page: number, limit: number}>}
 */
async function getAllGamesPaginated({ page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    const startTime = Date.now();
    const [result, countResult] = await Promise.all([
        pool.query(`
            SELECT g.*, au.username AS created_by_username,
                json_agg(json_build_object('bank_id', gb.bank_id, 'bank_name', qb.name, 'question_count', gb.question_count)) as banks
            FROM games g
            LEFT JOIN admin_users au ON au.id = g.created_by_user_id
            LEFT JOIN game_banks gb ON g.id = gb.game_id
            LEFT JOIN question_banks qb ON gb.bank_id = qb.id
            GROUP BY g.id, au.username
            ORDER BY g.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]),
        pool.query('SELECT COUNT(*) FROM games')
    ]);
    const total = parseInt(countResult.rows[0].count, 10);
    logger.debug('getAllGamesPaginated', { page, limit, offset, returned: result.rows.length, total, duration: `${Date.now() - startTime}ms` });
    return { games: result.rows, total, page, limit };
}

/**
 * Obtiene un juego con sus bancos
 * @param {number} gameId - ID del juego
 * @returns {Promise<{game: Object, banks: Array}|null>}
 */
async function getGameWithBanks(gameId) {
    /* Both queries depend only on gameId — run in parallel */
    const startTime = Date.now();
    const [game, banks] = await Promise.all([
        pool.query('SELECT * FROM games WHERE id = $1', [gameId]),
        pool.query(`
            SELECT gb.*, qb.name as bank_name,
                (SELECT COUNT(*) FROM questions WHERE bank_id = gb.bank_id) as total_questions
            FROM game_banks gb
            JOIN question_banks qb ON gb.bank_id = qb.id
            WHERE gb.game_id = $1
        `, [gameId])
    ]);

    const gameRows = Array.isArray(game?.rows) ? game.rows : [];
    const bankRows = Array.isArray(banks?.rows) ? banks.rows : [];

    logger.debug('getGameWithBanks parallel queries', { gameId, found: gameRows.length > 0, banks: bankRows.length, duration: `${Date.now() - startTime}ms` });
    if (gameRows.length === 0) return null;
    return { game: gameRows[0], banks: bankRows };
}

/**
 * Crea un nuevo juego
 * @param {Object} data - {name, pin, banks}
 * @returns {Promise<Object>}
 */
async function createGame(data) {
    const {
        name, pin, language, banks,
        created_by_role = 'admin',
        created_by_user_id = null,
        visible_to_presenter = true,
        use_streaks = false,
        streak_threshold = 3,
        streak_bonus_percentage = 0.50,
        use_double_streaks = false,
        double_streak_threshold = 5,
        double_streak_bonus_percentage = 1.00,
        pool_question_count = null,
    } = data;
    const finalPin = (pin || Math.floor(100000 + Math.random() * 900000).toString()).toUpperCase();
    const ownerRole = normalizeCreatorRole(created_by_role);
    const ownerUserId = Number.isInteger(Number(created_by_user_id)) && Number(created_by_user_id) > 0
        ? Number(created_by_user_id)
        : null;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const gameRes = await client.query(
            `INSERT INTO games
                (name, pin, language, visible_to_presenter, created_by_role, created_by_user_id,
                 use_streaks, streak_threshold, streak_bonus_percentage,
                 use_double_streaks, double_streak_threshold, double_streak_bonus_percentage,
                 pool_question_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [name, finalPin, language, visible_to_presenter, ownerRole, ownerUserId,
                use_streaks, streak_threshold, streak_bonus_percentage,
                use_double_streaks, double_streak_threshold, double_streak_bonus_percentage,
                pool_question_count]
        );
        const gameId = gameRes.rows[0].id;

        for (const bank of banks) {
            await client.query(
                'INSERT INTO game_banks (game_id, bank_id, question_count) VALUES ($1, $2, $3)',
                [gameId, bank.bank_id, bank.question_count]
            );
        }

        await client.query('COMMIT');
        return gameRes.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Actualiza un juego existente
 * @param {number} gameId - ID del juego
 * @param {Object} data - {name, pin, banks}
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updateGame(gameId, data, actorUserId = null) {
    const {
        name, pin, language, banks,
        visible_to_presenter = true,
        use_streaks = false,
        streak_threshold = 3,
        streak_bonus_percentage = 0.50,
        use_double_streaks = false,
        double_streak_threshold = 5,
        double_streak_bonus_percentage = 1.00,
        pool_question_count = null,
    } = data;
    const upperPin = pin.toUpperCase();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await assertEditorCanModifyResource('game', gameId, actorUserId, client);

        const pinCheck = await client.query(
            'SELECT id FROM games WHERE pin = $1 AND id != $2',
            [upperPin, gameId]
        );
        const pinCheckRows = Array.isArray(pinCheck?.rows) ? pinCheck.rows : [];
        if (pinCheckRows.length > 0) {
            await client.query('ROLLBACK');
            return { success: false, error: 'El PIN ya está en uso por otro juego', code: 'PIN_DUPLICATE' };
        }

        const currentGameRes = await client.query(
            'SELECT pin FROM games WHERE id = $1',
            [gameId]
        );
        const currentRows = Array.isArray(currentGameRes?.rows) ? currentGameRes.rows : [];
        const previousPin = currentRows[0]?.pin || null;

        await client.query(
            `UPDATE games SET
                name = $1, pin = $2, language = $3, visible_to_presenter = $4,
                use_streaks = $5, streak_threshold = $6, streak_bonus_percentage = $7,
                use_double_streaks = $8, double_streak_threshold = $9, double_streak_bonus_percentage = $10,
                pool_question_count = $11
             WHERE id = $12`,
            [name, upperPin, language, visible_to_presenter,
                use_streaks, streak_threshold, streak_bonus_percentage,
                use_double_streaks, double_streak_threshold, double_streak_bonus_percentage,
                pool_question_count, gameId]
        );
        await client.query('DELETE FROM game_banks WHERE game_id = $1', [gameId]);

        for (const bank of banks) {
            await client.query(
                'INSERT INTO game_banks (game_id, bank_id, question_count) VALUES ($1, $2, $3)',
                [gameId, bank.bank_id, bank.question_count]
            );
        }

        await client.query('COMMIT');

        questionBankCache.invalidate(gameId, 'game');
        questionBankCache.invalidate(upperPin, 'game');
        if (typeof questionBankCache.invalidateGame === 'function') {
            questionBankCache.invalidateGame(gameId, 'game');
            questionBankCache.invalidateGame(upperPin, 'game');
        }

        if (previousPin) {
            questionBankCache.invalidate(previousPin, 'game');
            if (typeof questionBankCache.invalidateGame === 'function') {
                questionBankCache.invalidateGame(previousPin, 'game');
            }

            pinCache.invalidate(previousPin);
            pinCache.invalidate(`presenter:${previousPin}`);
        }

        pinCache.invalidate(upperPin);
        pinCache.invalidate(`presenter:${upperPin}`);

        return { success: true };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Elimina un juego
 * @param {number} gameId - ID del juego
 * @returns {Promise<void>}
 */
async function deleteGame(gameId, actorUserId = null) {
    await assertEditorCanModifyResource('game', gameId, actorUserId, pool);

    const gameData = await pool.query('SELECT pin FROM games WHERE id = $1', [gameId]);

    await pool.query('DELETE FROM games WHERE id = $1', [gameId]);

    questionBankCache.invalidate(gameId, 'game');
    if (typeof questionBankCache.invalidateGame === 'function') {
        questionBankCache.invalidateGame(gameId, 'game');
    }

    const gameRows = Array.isArray(gameData?.rows) ? gameData.rows : [];
    const pin = gameRows[0]?.pin;
    if (pin) {
        questionBankCache.invalidate(pin, 'game');
        if (typeof questionBankCache.invalidateGame === 'function') {
            questionBankCache.invalidateGame(pin, 'game');
        }
        pinCache.invalidate(pin);
        pinCache.invalidate(`presenter:${pin}`);
    }
}

/**
 * Obtiene preguntas para iniciar un juego (desde games con múltiples bancos)
 * Usa window functions para un solo query en lugar de loop.
 * Bancos con question_count fijo se reparten por partición; los bancos
 * marcados como pool (question_count IS NULL) se combinan en un único
 * conjunto del que se extraen games.pool_question_count preguntas al azar,
 * sin importar de qué banco del pool proceden.
 * @param {number} gameId - ID del juego
 * @returns {Promise<Array>}
 */
async function getGameQuestions(gameId) {
    const startTime = Date.now();

    try {
        const result = await pool.query(`
            WITH pool_config AS (
                SELECT COALESCE(pool_question_count, 0) AS pool_question_count
                FROM games WHERE id = $1
            ),
            fixed_banks AS (
                SELECT bank_id, question_count
                FROM game_banks
                WHERE game_id = $1 AND question_count IS NOT NULL
            ),
            pool_banks AS (
                SELECT bank_id
                FROM game_banks
                WHERE game_id = $1 AND question_count IS NULL
            ),
            fixed_questions AS (
                SELECT
                    q.id, q.question_text, q.question_type, q.tipo_contenido, q.url_recurso,
                    q.question_image_url, q.time_limit, q.correct_answer, q.max_points, q.hint_text,
                    q.tolerance_mode, q.tolerance_value, q.tolerance_cap, q.correct_word,
                    ROW_NUMBER() OVER (PARTITION BY q.bank_id ORDER BY RANDOM()) as rn,
                    fb.question_count as take_count
                FROM questions q
                INNER JOIN fixed_banks fb ON q.bank_id = fb.bank_id
            ),
            pool_questions AS (
                SELECT
                    q.id, q.question_text, q.question_type, q.tipo_contenido, q.url_recurso,
                    q.question_image_url, q.time_limit, q.correct_answer, q.max_points, q.hint_text,
                    q.tolerance_mode, q.tolerance_value, q.tolerance_cap, q.correct_word,
                    ROW_NUMBER() OVER (ORDER BY RANDOM()) as rn,
                    (SELECT pool_question_count FROM pool_config) as take_count
                FROM questions q
                INNER JOIN pool_banks pb ON q.bank_id = pb.bank_id
            ),
            selected_questions AS (
                SELECT id, question_text, question_type, tipo_contenido, url_recurso,
                    question_image_url, time_limit, correct_answer, max_points, hint_text,
                    tolerance_mode, tolerance_value, tolerance_cap, correct_word
                FROM fixed_questions WHERE rn <= take_count
                UNION ALL
                SELECT id, question_text, question_type, tipo_contenido, url_recurso,
                    question_image_url, time_limit, correct_answer, max_points, hint_text,
                    tolerance_mode, tolerance_value, tolerance_cap, correct_word
                FROM pool_questions WHERE rn <= take_count
            )
            SELECT
                sq.id,
                sq.question_text,
                sq.question_type,
                sq.tipo_contenido,
                sq.url_recurso,
                sq.question_image_url,
                sq.time_limit,
                sq.correct_answer,
                sq.max_points,
                sq.hint_text,
                sq.tolerance_mode,
                sq.tolerance_value,
                sq.tolerance_cap,
                sq.correct_word,
                json_agg(
                    json_build_object(
                        'text', o.option_text,
                        'optionText', o.option_text,
                        'isCorrect', o.is_correct,
                        'justification', o.justification,
                        'order_index', o.order_index,
                        'match_value', o.match_value,
                        'option_image_url', o.option_image_url
                    ) ORDER BY CASE WHEN sq.question_type IN ('order', 'matching') THEN o.order_index ELSE o.id END
                ) as options
            FROM selected_questions sq
            LEFT JOIN options o ON o.question_id = sq.id
            GROUP BY sq.id, sq.question_text, sq.question_type,
                     sq.tipo_contenido, sq.url_recurso, sq.question_image_url, sq.time_limit, sq.correct_answer, sq.max_points, sq.hint_text,
                     sq.tolerance_mode, sq.tolerance_value, sq.tolerance_cap, sq.correct_word
            ORDER BY RANDOM()
        `, [gameId]);

        const duration = Date.now() - startTime;
        metrics.recordDbQuery(duration);

        logger.debug('Game questions loaded', {
            gameId,
            questionCount: result.rows.length,
            duration: `${duration}ms`
        });

        return result.rows;
    } catch (err) {
        metrics.recordDbError();
        logger.error('Error loading game questions', { gameId, error: err.message });
        throw err;
    }
}

module.exports = {
    getAllGames,
    getAllGamesPaginated,
    getGameWithBanks,
    createGame,
    updateGame,
    deleteGame,
    getGameQuestions
};
