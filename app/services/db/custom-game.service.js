/**
 * @fileoverview Custom Games database operations
 * @module services/db/custom-game.service
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
 * Obtiene todos los juegos personalizados
 * @returns {Promise<Array>}
 */
async function getAllCustomGames() {
    const result = await pool.query(`
        SELECT cg.*, au.username AS created_by_username,
            COALESCE(q.question_count, 0) AS question_count
        FROM custom_games cg
        LEFT JOIN admin_users au ON au.id = cg.created_by_user_id
        /* Aggregated JOIN replaces correlated subquery to avoid N+1 COUNT scans */
        LEFT JOIN (
            SELECT custom_game_id, COUNT(*) AS question_count
            FROM custom_game_questions
            GROUP BY custom_game_id
        ) q ON q.custom_game_id = cg.id
        ORDER BY cg.created_at DESC
    `);
    return result.rows;
}

/**
 * Obtiene juegos personalizados con paginación
 * @param {Object} opts - { page, limit }
 * @returns {Promise<{games: Array, total: number, page: number, limit: number}>}
 */
async function getAllCustomGamesPaginated({ page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    const startTime = Date.now();
    const [result, countResult] = await Promise.all([
        pool.query(`
            SELECT cg.*, au.username AS created_by_username,
                COALESCE(q.question_count, 0) AS question_count
            FROM custom_games cg
            LEFT JOIN admin_users au ON au.id = cg.created_by_user_id
            /* Aggregated JOIN replaces correlated subquery to avoid N+1 COUNT scans */
            LEFT JOIN (
                SELECT custom_game_id, COUNT(*) AS question_count
                FROM custom_game_questions
                GROUP BY custom_game_id
            ) q ON q.custom_game_id = cg.id
            ORDER BY cg.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]),
        pool.query('SELECT COUNT(*) FROM custom_games')
    ]);
    const total = parseInt(countResult.rows[0].count, 10);
    logger.debug('getAllCustomGamesPaginated', { page, limit, offset, returned: result.rows.length, total, duration: `${Date.now() - startTime}ms` });
    return { games: result.rows, total, page, limit };
}

/**
 * Crea un juego personalizado
 * @param {Object} data - {name, pin, questions}
 * @returns {Promise<Object>}
 */
async function createCustomGame(data) {
    const {
        name, pin, language, questions, visible_to_presenter = true,
        created_by_role = 'admin',
        created_by_user_id = null,
        use_streaks = false, streak_threshold = 3, streak_bonus_percentage = 0.50,
        use_double_streaks = false, double_streak_threshold = 5, double_streak_bonus_percentage = 1.00,
        image_url = null,
    } = data;
    const finalPin = (pin || Math.floor(100000 + Math.random() * 900000).toString()).toUpperCase();
    const ownerRole = normalizeCreatorRole(created_by_role);
    const ownerUserId = Number.isInteger(Number(created_by_user_id)) && Number(created_by_user_id) > 0
        ? Number(created_by_user_id)
        : null;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO custom_games
                (name, pin, language, visible_to_presenter, created_by_role, created_by_user_id,
                 use_streaks, streak_threshold, streak_bonus_percentage,
                 use_double_streaks, double_streak_threshold, double_streak_bonus_percentage,
                 image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [name, finalPin, language, visible_to_presenter, ownerRole, ownerUserId,
                use_streaks, streak_threshold, streak_bonus_percentage,
                use_double_streaks, double_streak_threshold, double_streak_bonus_percentage,
                image_url]
        );
        const customGameId = result.rows[0].id;

        if (questions && Array.isArray(questions) && questions.length > 0) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                if (q.slide_type === 'comment' || q.slide_type === 'info') {
                    await client.query(
                        'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, comment_text) VALUES ($1, $2, $3, $4, $5)',
                        [customGameId, null, i, q.slide_type, q.comment_text]
                    );
                    continue;
                }

                if (q.slide_type === 'text') {
                    await client.query(
                        'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_title, slide_body) VALUES ($1, $2, $3, $4, $5, $6)',
                        [customGameId, null, i, 'text', q.slide_title, q.slide_body]
                    );
                    continue;
                }

                if (q.slide_type === 'image') {
                    await client.query(
                        'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_image) VALUES ($1, $2, $3, $4, $5)',
                        [customGameId, null, i, 'image', q.slide_image]
                    );
                    continue;
                }

                if (q.slide_type === 'text-image') {
                    await client.query(
                        'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_title, slide_body, slide_image, slide_image_position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                        [customGameId, null, i, 'text-image', q.slide_title, q.slide_body, q.slide_image, q.slide_image_position]
                    );
                    continue;
                }

                await client.query(
                    'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type) VALUES ($1, $2, $3, $4)',
                    [customGameId, q.question_id, i, 'question']
                );
            }
        }

        await client.query('COMMIT');
        return result.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Obtiene un juego personalizado con sus preguntas
 * @param {number} customGameId - ID del juego personalizado
 * @returns {Promise<{game: Object, questions: Array}|null>}
 */
async function getCustomGameWithQuestions(customGameId) {
    try {
        const game = await pool.query(
            'SELECT * FROM custom_games WHERE id = $1',
            [customGameId]
        );
        if (game.rows.length === 0) return null;

        const questions = await pool.query(`
            SELECT cgq.position, cgq.slide_type, cgq.comment_text, cgq.slide_title, cgq.slide_body, cgq.slide_image, cgq.slide_image_position,
                q.id as question_id, q.question_text, q.bank_id,
                q.question_type,
                q.tipo_contenido, q.url_recurso, q.question_image_url,
                q.correct_answer,
                q.max_points,
                q.hint_text,
                q.tolerance_mode,
                q.tolerance_value,
                q.tolerance_cap,
                q.correct_word,
                qb.name as bank_name,
                (SELECT json_agg(json_build_object('text', o.option_text, 'isCorrect', o.is_correct, 'justification', o.justification, 'order_index', o.order_index, 'match_value', o.match_value, 'option_image_url', o.option_image_url) ORDER BY COALESCE(o.order_index, o.id))
                 FROM options o WHERE o.question_id = q.id) as options
            FROM custom_game_questions cgq
            LEFT JOIN questions q ON cgq.question_id = q.id
            LEFT JOIN question_banks qb ON q.bank_id = qb.id
            WHERE cgq.custom_game_id = $1
            ORDER BY cgq.position ASC
        `, [customGameId]);

        logger.debug('Custom game loaded', { customGameId, questionCount: questions.rows.length });
        return { game: game.rows[0], questions: questions.rows || [] };
    } catch (err) {
        logger.error('Error en getCustomGameWithQuestions:', { customGameId, error: err.message });
        throw err;
    }
}

/**
 * Actualiza un juego personalizado
 * @param {number} customGameId - ID del juego
 * @param {Object} data - {name, pin, questions}
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updateCustomGame(customGameId, data, actorUserId = null) {
    const {
        name, pin, language, questions, visible_to_presenter = true,
        use_streaks = false, streak_threshold = 3, streak_bonus_percentage = 0.50,
        use_double_streaks = false, double_streak_threshold = 5, double_streak_bonus_percentage = 1.00,
        image_url = null,
    } = data;
    const upperPin = pin.toUpperCase();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await assertEditorCanModifyResource('custom_game', customGameId, actorUserId, client);

        const pinCheck = await client.query(
            'SELECT id FROM custom_games WHERE pin = $1 AND id != $2',
            [upperPin, customGameId]
        );
        const pinCheckRows = Array.isArray(pinCheck?.rows) ? pinCheck.rows : [];
        if (pinCheckRows.length > 0) {
            await client.query('ROLLBACK');
            return { success: false, error: 'El PIN ya está en uso por otro juego personalizado', code: 'PIN_DUPLICATE' };
        }

        const currentGameRes = await client.query(
            'SELECT pin FROM custom_games WHERE id = $1',
            [customGameId]
        );
        const currentRows = Array.isArray(currentGameRes?.rows) ? currentGameRes.rows : [];
        const previousPin = currentRows[0]?.pin || null;

        await client.query(
            `UPDATE custom_games SET
                name = $1, pin = $2, language = $3, visible_to_presenter = $4,
                use_streaks = $5, streak_threshold = $6, streak_bonus_percentage = $7,
                use_double_streaks = $8, double_streak_threshold = $9, double_streak_bonus_percentage = $10,
                image_url = $11
             WHERE id = $12`,
            [name, upperPin, language, visible_to_presenter,
                use_streaks, streak_threshold, streak_bonus_percentage,
                use_double_streaks, double_streak_threshold, double_streak_bonus_percentage,
                image_url, customGameId]
        );
        await client.query(
            'DELETE FROM custom_game_questions WHERE custom_game_id = $1',
            [customGameId]
        );

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (q.slide_type === 'comment' || q.slide_type === 'info') {
                await client.query(
                    'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, comment_text) VALUES ($1, $2, $3, $4, $5)',
                    [customGameId, null, i, q.slide_type, q.comment_text]
                );
            } else if (q.slide_type === 'text') {
                await client.query(
                    'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_title, slide_body) VALUES ($1, $2, $3, $4, $5, $6)',
                    [customGameId, null, i, 'text', q.slide_title, q.slide_body]
                );
            } else if (q.slide_type === 'image') {
                await client.query(
                    'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_image) VALUES ($1, $2, $3, $4, $5)',
                    [customGameId, null, i, 'image', q.slide_image]
                );
            } else if (q.slide_type === 'text-image') {
                await client.query(
                    'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_title, slide_body, slide_image, slide_image_position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    [customGameId, null, i, 'text-image', q.slide_title, q.slide_body, q.slide_image, q.slide_image_position]
                );
            } else {
                await client.query(
                    'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type) VALUES ($1, $2, $3, $4)',
                    [customGameId, q.question_id, i, 'question']
                );
            }
        }

        await client.query('COMMIT');

        questionBankCache.invalidate(customGameId, 'custom_game');
        questionBankCache.invalidate(upperPin, 'custom_game');
        if (typeof questionBankCache.invalidateGame === 'function') {
            questionBankCache.invalidateGame(customGameId, 'custom_game');
            questionBankCache.invalidateGame(upperPin, 'custom_game');
        }

        if (previousPin) {
            questionBankCache.invalidate(previousPin, 'custom_game');
            if (typeof questionBankCache.invalidateGame === 'function') {
                questionBankCache.invalidateGame(previousPin, 'custom_game');
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
 * Elimina un juego personalizado
 * @param {number} customGameId - ID del juego
 * @returns {Promise<void>}
 */
async function deleteCustomGame(customGameId, actorUserId = null) {
    await assertEditorCanModifyResource('custom_game', customGameId, actorUserId, pool);

    const gameData = await pool.query('SELECT pin FROM custom_games WHERE id = $1', [customGameId]);

    await pool.query('DELETE FROM custom_games WHERE id = $1', [customGameId]);

    questionBankCache.invalidate(customGameId, 'custom_game');
    if (typeof questionBankCache.invalidateGame === 'function') {
        questionBankCache.invalidateGame(customGameId, 'custom_game');
    }

    const gameRows = Array.isArray(gameData?.rows) ? gameData.rows : [];
    const pin = gameRows[0]?.pin;
    if (pin) {
        questionBankCache.invalidate(pin, 'custom_game');
        if (typeof questionBankCache.invalidateGame === 'function') {
            questionBankCache.invalidateGame(pin, 'custom_game');
        }
        pinCache.invalidate(pin);
        pinCache.invalidate(`presenter:${pin}`);
    }
}

/**
 * Obtiene preguntas de un juego personalizado (para iniciar partida)
 * @param {number} customGameId - ID del juego personalizado
 * @returns {Promise<Array>}
 */
async function getCustomGameQuestionsForPlay(customGameId) {
    const cached = questionBankCache.get(customGameId, 'custom_game');
    if (cached) {
        logger.info('Custom game questions from CACHE', { customGameId, questionCount: cached.length });
        return cached;
    }

    const startTime = Date.now();

    try {
        const questionsRes = await pool.query(`
            SELECT 
                cgq.position,
                cgq.slide_type, 
                cgq.comment_text,
                cgq.slide_title,
                cgq.slide_body,
                cgq.slide_image,
                cgq.slide_image_position,
                q.id, 
                q.question_text, 
                q.question_type, 
                q.tipo_contenido, 
                q.url_recurso,
                q.question_image_url,
                q.time_limit,
                q.correct_answer,
                q.max_points,
                q.hint_text,
                q.tolerance_mode,
                q.tolerance_value,
                q.tolerance_cap,
                q.correct_word,
                CASE 
                    WHEN cgq.slide_type IN ('comment', 'info', 'text', 'image', 'text-image') THEN NULL
                    ELSE (
                        SELECT json_agg(
                            json_build_object(
                                'id', o.id,
                                'optionText', o.option_text,
                                'text', o.option_text,
                                'isCorrect', o.is_correct,
                                'justification', o.justification,
                                'order_index', o.order_index,
                                'match_value', o.match_value,
                                'option_image_url', o.option_image_url
                            ) ORDER BY CASE WHEN q.question_type = 'order' THEN o.order_index ELSE o.id END
                        )
                        FROM options o 
                        WHERE o.question_id = q.id
                    )
                END as options
            FROM custom_game_questions cgq
            LEFT JOIN questions q ON cgq.question_id = q.id
            WHERE cgq.custom_game_id = $1
            ORDER BY cgq.position ASC
        `, [customGameId]);

        const duration = Date.now() - startTime;
        metrics.recordDbQuery(duration);

        questionBankCache.set(customGameId, questionsRes.rows, 'custom_game');

        logger.debug('Custom game questions loaded from DB', {
            customGameId,
            questionCount: questionsRes.rows.length,
            duration: `${duration}ms`
        });

        return questionsRes.rows;
    } catch (err) {
        metrics.recordDbError();
        logger.error('Error loading custom game questions', { customGameId, error: err.message });
        throw err;
    }
}

module.exports = {
    getAllCustomGames,
    getAllCustomGamesPaginated,
    createCustomGame,
    getCustomGameWithQuestions,
    updateCustomGame,
    deleteCustomGame,
    getCustomGameQuestionsForPlay
};
