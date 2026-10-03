/**
 * @fileoverview Question Banks database operations
 * @module services/db/bank.service
 */

const { pool } = require('../../config/database');
const pinCache = require('../pin-cache.service');
const {
    assertEditorCanModifyResource,
    normalizeCreatorRole
} = require('./resource-ownership.service');
const { DEFAULTS: RANDOM_POINTS_DEFAULTS } = require('./random-points-config.service');
const runtimeConfig = require('../../config/runtime-config');

/** time_limit de la pregunta o, si no trae, el de Config → Partidas (QUESTION_TIME_LIMIT). */
function resolveTimeLimit(question) {
    return question.time_limit || runtimeConfig.get('QUESTION_TIME_LIMIT');
}

/**
 * Obtiene todos los bancos de preguntas
 * @returns {Promise<Array>}
 */
async function getAllBanks() {
    const result = await pool.query(
        `SELECT qb.id, qb.name, qb.pin, qb.created_at, qb.created_by_role, qb.created_by_user_id,
                qb.image_url, au.username AS created_by_username
         FROM question_banks qb
         LEFT JOIN admin_users au ON au.id = qb.created_by_user_id
         ORDER BY qb.created_at DESC`
    );
    return result.rows;
}

/**
 * Obtiene todos los bancos con el conteo de preguntas
 * @returns {Promise<Array>} Array de bancos con question_count
 */
async function getAllBanksWithQuestionCounts() {
    const result = await pool.query(`
        SELECT 
            qb.id, 
            qb.name, 
            qb.pin, 
            qb.created_at,
            qb.created_by_role,
            qb.created_by_user_id,
            qb.image_url,
            au.username AS created_by_username,
            COUNT(q.id)::int as question_count
        FROM question_banks qb
        LEFT JOIN admin_users au ON au.id = qb.created_by_user_id
        LEFT JOIN questions q ON q.bank_id = qb.id
        GROUP BY qb.id, qb.name, qb.pin, qb.created_at, qb.created_by_role, qb.created_by_user_id, qb.image_url, au.username
        ORDER BY qb.created_at DESC
    `);
    return result.rows;
}

/**
 * Obtiene un banco con sus preguntas
 * @param {number} bankId - ID del banco
 * @returns {Promise<{bank: Object, questions: Array}|null>}
 */
async function getBankWithQuestions(bankId) {
    const bank = await pool.query(
        'SELECT * FROM question_banks WHERE id = $1',
        [bankId]
    );
    if (bank.rows.length === 0) return null;

    const questions = await pool.query(`
        SELECT q.*, (SELECT json_agg(o.* ORDER BY COALESCE(o.order_index, o.id)) FROM options o WHERE o.question_id = q.id) as options
        FROM questions q WHERE q.bank_id = $1 ORDER BY q.id ASC
    `, [bankId]);

    return { bank: bank.rows[0], questions: questions.rows || [] };
}

/**
 * Crea un nuevo banco de preguntas
 * @param {string} name - Nombre del banco
 * @returns {Promise<Object>}
 */
async function createBank(name, createdByRole = 'admin', createdByUserId = null) {
    const ownerRole = normalizeCreatorRole(createdByRole);
    const ownerUserId = Number.isInteger(Number(createdByUserId)) && Number(createdByUserId) > 0
        ? Number(createdByUserId)
        : null;
    const result = await pool.query(
        'INSERT INTO question_banks (name, created_by_role, created_by_user_id) VALUES ($1, $2, $3) RETURNING *',
        [name, ownerRole, ownerUserId]
    );

    if (result.rows[0].pin) {
        pinCache.invalidate(result.rows[0].pin);
        pinCache.invalidate(`presenter:${result.rows[0].pin}`);
    }

    return result.rows[0];
}

/**
 * Elimina un banco de preguntas si no está en uso
 * @param {number} bankId - ID del banco
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteBank(bankId, actorUserId = null) {
    await assertEditorCanModifyResource('bank', bankId, actorUserId, pool);

    const bankData = await pool.query('SELECT pin FROM question_banks WHERE id = $1', [bankId]);

    const usage = await pool.query(
        'SELECT COUNT(*) as count FROM game_banks WHERE bank_id = $1',
        [bankId]
    );
    if (parseInt(usage.rows[0].count) > 0) {
        return {
            success: false,
            error: 'No se puede eliminar un banco que está siendo usado en un juego',
            code: 'BANK_IN_USE'
        };
    }

    await pool.query('DELETE FROM question_banks WHERE id = $1', [bankId]);

    if (bankData.rows[0]?.pin) {
        pinCache.invalidate(bankData.rows[0].pin);
        pinCache.invalidate(`presenter:${bankData.rows[0].pin}`);
    }

    return { success: true };
}

/**
 * Inserta las opciones de una pregunta en un único multi-row INSERT.
 * Reduce N queries (una por opción) a 1 query por pregunta.
 * @param {Object} client - Cliente PostgreSQL de la transacción
 * @param {number} questionId
 * @param {Array} options
 */
async function batchInsertOptions(client, questionId, options) {
    if (!options || options.length === 0) return;
    const placeholders = options.map((_, i) =>
        `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
    ).join(', ');
    const values = options.flatMap(opt => [
        questionId,
        opt.optionText || '',
        opt.isCorrect,
        opt.justification || null,
        opt.order_index ?? opt.orderIndex ?? null,
        opt.match_value ?? opt.matchValue ?? null,
        opt.option_image_url ?? opt.optionImageUrl ?? null
    ]);
    await client.query(
        `INSERT INTO options (question_id, option_text, is_correct, justification, order_index, match_value, option_image_url) VALUES ${placeholders}`,
        values
    );
}

function normalizeOwnerUserId(createdByUserId) {
    const parsed = Number(createdByUserId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizePin(pin) {
    return pin ? pin.toUpperCase().trim() : null;
}

function generateFallbackPin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function invalidatePinCaches(pin) {
    if (!pin) {
        return;
    }
    pinCache.invalidate(pin);
    pinCache.invalidate(`presenter:${pin}`);
}

function buildQuestionValues(bankId, question) {
    return [
        bankId,
        question.questionText,
        question.type || 'quiz',
        question.tipo_contenido || 'texto',
        question.url_recurso || null,
        resolveTimeLimit(question),
        question.correctAnswer ?? null,
        question.maxPoints ?? null,
        question.hint ?? null,
        question.toleranceMode ?? null,
        question.toleranceValue ?? null,
        question.toleranceCap ?? null,
        question.correctWord ?? null,
        question.question_image_url ?? null
    ];
}

async function ensureEditPin(client, bankId, currentPin) {
    if (currentPin) {
        return currentPin;
    }

    const existingBank = await client.query(
        'SELECT pin FROM question_banks WHERE id = $1',
        [bankId]
    );
    return existingBank.rows[0]?.pin || generateFallbackPin();
}

async function loadDependentEntities(client, bankId) {
    const dependentGamesRes = await client.query(
        `SELECT DISTINCT g.id, g.pin
         FROM games g
         INNER JOIN game_banks gb ON gb.game_id = g.id
         WHERE gb.bank_id = $1`,
        [bankId]
    );
    const dependentCustomGamesRes = await client.query(
        `SELECT DISTINCT cg.id, cg.pin
         FROM custom_games cg
         INNER JOIN custom_game_questions cgq ON cgq.custom_game_id = cg.id
         INNER JOIN questions q ON q.id = cgq.question_id
         WHERE q.bank_id = $1`,
        [bankId]
    );
    const dependentTrivialsRes = await client.query(
        `SELECT DISTINCT tg.id, tg.pin
         FROM trivial_games tg
         INNER JOIN trivial_categories tc ON tc.trivial_id = tg.id
         WHERE tc.source_id = $1 AND (tc.source_type = 'bank' OR tc.source_type IS NULL)`,
        [bankId]
    );

    return {
        dependentGames: Array.isArray(dependentGamesRes?.rows) ? dependentGamesRes.rows : [],
        dependentCustomGames: Array.isArray(dependentCustomGamesRes?.rows) ? dependentCustomGamesRes.rows : [],
        dependentTrivials: Array.isArray(dependentTrivialsRes?.rows) ? dependentTrivialsRes.rows : []
    };
}

async function updateBankMetadata(client, payload) {
    const {
        name,
        upperPin,
        language,
        visibleToPresenter,
        useStreaks,
        streakThreshold,
        streakBonusPercentage,
        useDoubleStreaks,
        doubleStreakThreshold,
        doubleStreakBonusPercentage,
        imageUrl,
        useRandomPoints,
        randomPointsMin,
        randomPointsMax,
        bankId
    } = payload;

    await client.query(
        `UPDATE question_banks
         SET name = $1, pin = $2, language = $3, visible_to_presenter = $4,
             use_streaks = $5, streak_threshold = $6, streak_bonus_percentage = $7,
             use_double_streaks = $8, double_streak_threshold = $9, double_streak_bonus_percentage = $10,
             image_url = $11,
             use_random_points = $12, random_points_min = $13, random_points_max = $14
         WHERE id = $15`,
        [
            name,
            upperPin,
            language,
            visibleToPresenter,
            useStreaks,
            streakThreshold,
            streakBonusPercentage,
            useDoubleStreaks,
            doubleStreakThreshold,
            doubleStreakBonusPercentage,
            imageUrl,
            useRandomPoints,
            randomPointsMin,
            randomPointsMax,
            bankId
        ]
    );
}

async function updateExistingQuestion(client, question) {
    await client.query(
        `UPDATE questions
         SET question_text = $1, question_type = $2, tipo_contenido = $3, url_recurso = $4,
             time_limit = $5, correct_answer = $7, max_points = $8, hint_text = $9,
             tolerance_mode = $10, tolerance_value = $11, tolerance_cap = $12,
             correct_word = $13, question_image_url = $14
         WHERE id = $6`,
        [
            question.questionText,
            question.type || 'quiz',
            question.tipo_contenido || 'texto',
            question.url_recurso || null,
            resolveTimeLimit(question),
            question.id,
            question.correctAnswer ?? null,
            question.maxPoints ?? null,
            question.hint ?? null,
            question.toleranceMode ?? null,
            question.toleranceValue ?? null,
            question.toleranceCap ?? null,
            question.correctWord ?? null,
            question.question_image_url ?? null
        ]
    );
}

async function insertQuestion(client, bankId, question) {
    const resQ = await client.query(
        `INSERT INTO questions
         (bank_id, question_text, question_type, tipo_contenido, url_recurso, time_limit,
          correct_answer, max_points, hint_text, tolerance_mode, tolerance_value, tolerance_cap,
          correct_word, question_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        buildQuestionValues(bankId, question)
    );
    return resQ.rows[0].id;
}

async function syncExistingBankQuestions(client, bankId, questions) {
    const existingQuestionsRes = await client.query(
        'SELECT id FROM questions WHERE bank_id = $1',
        [bankId]
    );
    const existingQuestionIds = existingQuestionsRes.rows.map(r => r.id);
    const existingQuestionIdSet = new Set(existingQuestionIds);
    const processedQuestionIds = new Set();

    for (const question of questions) {
        const isExisting = Boolean(question.id) && existingQuestionIdSet.has(question.id);
        let questionId;

        if (isExisting) {
            await updateExistingQuestion(client, question);
            questionId = question.id;
            await client.query('DELETE FROM options WHERE question_id = $1', [questionId]);
        } else {
            questionId = await insertQuestion(client, bankId, question);
        }

        processedQuestionIds.add(questionId);
        await batchInsertOptions(client, questionId, question.options);
    }

    for (const existingId of existingQuestionIds) {
        if (!processedQuestionIds.has(existingId)) {
            await client.query('DELETE FROM questions WHERE id = $1', [existingId]);
        }
    }
}

async function insertQuestionsForNewBank(client, bankId, questions) {
    for (const question of questions) {
        const questionId = await insertQuestion(client, bankId, question);
        await batchInsertOptions(client, questionId, question.options);
    }
}

async function createBankRecord(client, payload) {
    const {
        name,
        upperPin,
        language,
        visibleToPresenter,
        ownerRole,
        ownerUserId,
        useStreaks,
        streakThreshold,
        streakBonusPercentage,
        useDoubleStreaks,
        doubleStreakThreshold,
        doubleStreakBonusPercentage,
        imageUrl,
        useRandomPoints,
        randomPointsMin,
        randomPointsMax
    } = payload;

    const resBank = await client.query(
        `INSERT INTO question_banks
         (name, pin, language, visible_to_presenter,
          created_by_role, created_by_user_id,
          use_streaks, streak_threshold, streak_bonus_percentage,
          use_double_streaks, double_streak_threshold, double_streak_bonus_percentage,
          image_url,
          use_random_points, random_points_min, random_points_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
        [
            name,
            upperPin,
            language,
            visibleToPresenter,
            ownerRole,
            ownerUserId,
            useStreaks,
            streakThreshold,
            streakBonusPercentage,
            useDoubleStreaks,
            doubleStreakThreshold,
            doubleStreakBonusPercentage,
            imageUrl,
            useRandomPoints,
            randomPointsMin,
            randomPointsMax
        ]
    );

    return resBank.rows[0].id;
}

function invalidateEntityCaches(questionBankCache, entity, entityType) {
    questionBankCache.invalidate(entity.id, entityType);
    if (entity.pin) {
        questionBankCache.invalidate(entity.pin, entityType);
    }

    if (typeof questionBankCache.invalidateGame === 'function') {
        questionBankCache.invalidateGame(entity.id, entityType);
        if (entity.pin) {
            questionBankCache.invalidateGame(entity.pin, entityType);
        }
    }
}

function invalidateTrivialDependencies(questionBankCache, dependentTrivials) {
    for (const trivial of dependentTrivials) {
        invalidateEntityCaches(questionBankCache, trivial, 'trivial');
    }
}

function invalidateDependentResourceCaches(questionBankCache, dependencies) {
    const { dependentGames, dependentCustomGames, dependentTrivials } = dependencies;

    for (const game of dependentGames) {
        invalidateEntityCaches(questionBankCache, game, 'game');
    }

    for (const customGame of dependentCustomGames) {
        invalidateEntityCaches(questionBankCache, customGame, 'custom_game');
        if (customGame.pin) {
            invalidateTrivialDependencies(questionBankCache, dependentTrivials);
        }
    }
}

/**
 * Guarda un banco completo con sus preguntas
 * @param {Object} data - {id, name, pin, questions}
 * @returns {Promise<{success: boolean, id: number}>}
 */
async function saveBankComplete(data, actorUserId = null) {
    const {
        id, name, pin, language, questions,
        created_by_role = 'admin',
        created_by_user_id = null,
        visible_to_presenter = true,
        use_streaks = false,
        streak_threshold = 3,
        streak_bonus_percentage = 0.50,
        use_double_streaks = false,
        double_streak_threshold = 5,
        double_streak_bonus_percentage = 1.00,
        image_url = null,
        use_random_points = false,
        random_points_min = RANDOM_POINTS_DEFAULTS.random_points_min,
        random_points_max = RANDOM_POINTS_DEFAULTS.random_points_max
    } = data;
    const { questionBankCache } = require('../cache.service');
    const ownerRole = normalizeCreatorRole(created_by_role);
    const ownerUserId = normalizeOwnerUserId(created_by_user_id);

    const client = await pool.connect();
    const isEditingExistingBank = Boolean(id);
    let upperPin = normalizePin(pin);
    let dependentResources = {
        dependentGames: [],
        dependentCustomGames: [],
        dependentTrivials: []
    };

    try {
        await client.query('BEGIN');
        let bankId = id;

        if (bankId) {
            await assertEditorCanModifyResource('bank', bankId, actorUserId, client);
        }

        if (bankId) {
            upperPin = await ensureEditPin(client, bankId, upperPin);
            dependentResources = await loadDependentEntities(client, bankId);

            await updateBankMetadata(client, {
                name,
                upperPin,
                language,
                visibleToPresenter: visible_to_presenter,
                useStreaks: use_streaks,
                streakThreshold: streak_threshold,
                streakBonusPercentage: streak_bonus_percentage,
                useDoubleStreaks: use_double_streaks,
                doubleStreakThreshold: double_streak_threshold,
                doubleStreakBonusPercentage: double_streak_bonus_percentage,
                imageUrl: image_url,
                useRandomPoints: use_random_points,
                randomPointsMin: random_points_min,
                randomPointsMax: random_points_max,
                bankId
            });

            await syncExistingBankQuestions(client, bankId, questions);
            invalidatePinCaches(upperPin);
        } else {
            if (!upperPin) {
                upperPin = generateFallbackPin();
            }

            bankId = await createBankRecord(client, {
                name,
                upperPin,
                language,
                visibleToPresenter: visible_to_presenter,
                ownerRole,
                ownerUserId,
                useStreaks: use_streaks,
                streakThreshold: streak_threshold,
                streakBonusPercentage: streak_bonus_percentage,
                useDoubleStreaks: use_double_streaks,
                doubleStreakThreshold: double_streak_threshold,
                doubleStreakBonusPercentage: double_streak_bonus_percentage,
                imageUrl: image_url,
                useRandomPoints: use_random_points,
                randomPointsMin: random_points_min,
                randomPointsMax: random_points_max
            });

            invalidatePinCaches(upperPin);
            await insertQuestionsForNewBank(client, bankId, questions);
        }

        await client.query('COMMIT');

        questionBankCache.invalidate(bankId, 'bank');

        if (isEditingExistingBank) {
            invalidateDependentResourceCaches(questionBankCache, dependentResources);
        }

        return { success: true, id: bankId };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Obtiene todas las preguntas de un banco (para juego directo)
 * @param {number} bankId - ID del banco
 * @returns {Promise<Array>}
 */
async function getBankQuestions(bankId) {
    const { questionBankCache } = require('../cache.service');
    const logger = require('../../config/logger');
    const metrics = require('../../state/metrics');

    const cached = questionBankCache.get(bankId, 'bank');
    if (cached) {
        logger.info('Bank questions from CACHE', { bankId, questionCount: cached.length });
        return cached;
    }

    const startTime = Date.now();

    try {
        const questionsRes = await pool.query(`
            SELECT 
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
                json_agg(
                    json_build_object(
                        'optionText', o.option_text,
                        'isCorrect', o.is_correct,
                        'justification', o.justification,
                        'order_index', o.order_index,
                        'match_value', o.match_value,
                        'option_image_url', o.option_image_url
                    ) ORDER BY CASE WHEN q.question_type IN ('order', 'matching') THEN o.order_index ELSE o.id END
                ) as options
            FROM questions q 
            LEFT JOIN options o ON o.question_id = q.id
            WHERE q.bank_id = $1 
            GROUP BY q.id, q.question_text, q.question_type, 
                     q.tipo_contenido, q.url_recurso, q.question_image_url, q.time_limit,
                     q.correct_answer, q.max_points, q.hint_text,
                     q.tolerance_mode, q.tolerance_value, q.tolerance_cap, q.correct_word
            ORDER BY RANDOM()
        `, [bankId]);

        const duration = Date.now() - startTime;
        metrics.recordDbQuery(duration);

        questionBankCache.set(bankId, questionsRes.rows, 'bank');

        logger.debug('Bank questions loaded from DB', {
            bankId,
            questionCount: questionsRes.rows.length,
            duration: `${duration}ms`
        });

        return questionsRes.rows;
    } catch (err) {
        const metrics = require('../../state/metrics');
        metrics.recordDbError();
        const logger = require('../../config/logger');
        logger.error('Error loading bank questions', { bankId, error: err.message });
        throw err;
    }
}

module.exports = {
    getAllBanks,
    getAllBanksWithQuestionCounts,
    getBankWithQuestions,
    createBank,
    deleteBank,
    saveBankComplete,
    getBankQuestions
};
