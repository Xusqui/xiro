/**
 * @fileoverview Servicio para mezclar bancos de preguntas
 * @module services/db/bank-merge.service
 * 
 * Funcionalidad modular para combinar preguntas de múltiples bancos
 * en un nuevo banco sin modificar los originales.
 */

const { pool } = require('../../config/database');
const pinCache = require('../pin-cache.service');
const { normalizeCreatorRole } = require('./resource-ownership.service');
const { DEFAULTS: RANDOM_POINTS_DEFAULTS } = require('./random-points-config.service');

function normalizeMergeOptions(options = {}) {
    const {
        created_by_role = 'admin',
        created_by_user_id = null,
        visible_to_presenter = true,
        use_streaks = false,
        streak_threshold = 3,
        streak_bonus_percentage = 0.50,
        use_double_streaks = false,
        double_streak_threshold = 5,
        double_streak_bonus_percentage = 1.00,
        use_random_points = false,
        random_points_min = RANDOM_POINTS_DEFAULTS.random_points_min,
        random_points_max = RANDOM_POINTS_DEFAULTS.random_points_max
    } = options;

    return {
        ownerRole: normalizeCreatorRole(created_by_role),
        ownerUserId: Number.isInteger(Number(created_by_user_id)) && Number(created_by_user_id) > 0
            ? Number(created_by_user_id)
            : null,
        visible_to_presenter,
        use_streaks,
        streak_threshold,
        streak_bonus_percentage,
        use_double_streaks,
        double_streak_threshold,
        double_streak_bonus_percentage,
        use_random_points,
        random_points_min,
        random_points_max
    };
}

function validateMergeInput(bankIds, newName) {
    if (!Array.isArray(bankIds) || bankIds.length < 2) {
        throw new Error('Debes seleccionar al menos 2 bancos para mezclar');
    }

    if (!newName || newName.trim().length === 0) {
        throw new Error('El nombre del nuevo banco es obligatorio');
    }
}

function resolvePin(newPin) {
    if (newPin) {
        return newPin.toUpperCase().trim();
    }
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getExistingBanks(client, bankIds) {
    const banksCheck = await client.query(
        `SELECT id, name
         FROM question_banks
         WHERE id = ANY($1::int[])`,
        [bankIds]
    );

    if (banksCheck.rows.length !== bankIds.length) {
        throw new Error('Uno o más bancos seleccionados no existen');
    }

    return banksCheck.rows;
}

async function ensurePinAvailable(client, pin) {
    const pinCheck = await client.query(
        'SELECT id FROM question_banks WHERE pin = $1',
        [pin]
    );

    if (pinCheck.rows.length > 0) {
        throw new Error(`Ya existe un banco con el PIN ${pin}`);
    }
}

async function createMergedBank(client, newName, pin, mergeOptions) {
    const result = await client.query(
        `INSERT INTO question_banks
         (name, pin, visible_to_presenter, created_by_role, created_by_user_id,
          use_streaks, streak_threshold, streak_bonus_percentage,
          use_double_streaks, double_streak_threshold, double_streak_bonus_percentage,
          use_random_points, random_points_min, random_points_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
            newName,
            pin,
            mergeOptions.visible_to_presenter,
            mergeOptions.ownerRole,
            mergeOptions.ownerUserId,
            mergeOptions.use_streaks,
            mergeOptions.streak_threshold,
            mergeOptions.streak_bonus_percentage,
            mergeOptions.use_double_streaks,
            mergeOptions.double_streak_threshold,
            mergeOptions.double_streak_bonus_percentage,
            mergeOptions.use_random_points,
            mergeOptions.random_points_min,
            mergeOptions.random_points_max
        ]
    );

    return result.rows[0].id;
}

async function getQuestionsToMerge(client, bankIds) {
    const questionsResult = await client.query(
        `SELECT
            q.id,
            q.question_text,
            q.question_type,
            q.tipo_contenido,
            q.url_recurso,
            q.time_limit,
            q.correct_answer,
            q.max_points,
            q.hint_text,
            q.tolerance_mode,
            q.tolerance_value,
            q.tolerance_cap,
            q.correct_word,
            q.question_image_url
         FROM questions q
         WHERE q.bank_id = ANY($1::int[])
         ORDER BY q.bank_id, q.id`,
        [bankIds]
    );

    return questionsResult.rows;
}

async function cloneQuestion(client, question, newBankId) {
    const newQuestionResult = await client.query(
        `INSERT INTO questions
         (bank_id, question_text, question_type, tipo_contenido,
          url_recurso, time_limit, correct_answer, max_points,
          hint_text, tolerance_mode, tolerance_value, tolerance_cap, correct_word, question_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
            newBankId,
            question.question_text,
            question.question_type,
            question.tipo_contenido,
            question.url_recurso,
            question.time_limit,
            question.correct_answer,
            question.max_points,
            question.hint_text,
            question.tolerance_mode,
            question.tolerance_value,
            question.tolerance_cap,
            question.correct_word,
            question.question_image_url
        ]
    );

    return newQuestionResult.rows[0].id;
}

async function cloneQuestionOptions(client, sourceQuestionId, targetQuestionId) {
    const optionsResult = await client.query(
        `SELECT option_text, is_correct, justification, order_index, match_value, option_image_url
         FROM options
         WHERE question_id = $1
         ORDER BY COALESCE(order_index, id)`,
        [sourceQuestionId]
    );

    for (const option of optionsResult.rows) {
        await client.query(
            `INSERT INTO options
             (question_id, option_text, is_correct, justification, order_index, match_value, option_image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                targetQuestionId,
                option.option_text || '',
                option.is_correct,
                option.justification,
                option.order_index,
                option.match_value,
                option.option_image_url || null
            ]
        );
    }
}

async function copyQuestionsToMergedBank(client, questions, newBankId) {
    let totalQuestions = 0;

    for (const question of questions) {
        const newQuestionId = await cloneQuestion(client, question, newBankId);
        await cloneQuestionOptions(client, question.id, newQuestionId);
        totalQuestions++;
    }

    return totalQuestions;
}

function buildMergeSuccessResponse({ newBankId, pin, totalQuestions, bankIds, bankNames, newName }) {
    return {
        success: true,
        id: newBankId,
        pin,
        totalQuestions,
        message: `Banco "${newName}" creado exitosamente mezclando ${bankIds.length} bancos (${bankNames}). Total de preguntas: ${totalQuestions}`,
        code: 'BANKS_MERGED',
        params: { newName, mergedCount: bankIds.length, bankNames, totalQuestions }
    };
}

/**
 * Mezcla múltiples bancos de preguntas en uno nuevo
 * @param {Array<number>} bankIds - Array de IDs de bancos a mezclar
 * @param {string} newName - Nombre del nuevo banco
 * @param {string|null} newPin - PIN del nuevo banco (opcional, se genera automático si es null)
 * @param {Object} options - Opciones adicionales del banco
 * @returns {Promise<{success: boolean, id: number, message: string}>}
 */
async function mergeBanks(bankIds, newName, newPin = null, options = {}) {
    validateMergeInput(bankIds, newName);

    const mergeOptions = normalizeMergeOptions(options);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const pin = resolvePin(newPin);
        const banks = await getExistingBanks(client, bankIds);
        await ensurePinAvailable(client, pin);

        const newBankId = await createMergedBank(client, newName, pin, mergeOptions);
        const questions = await getQuestionsToMerge(client, bankIds);
        const totalQuestions = await copyQuestionsToMergedBank(client, questions, newBankId);

        await client.query('COMMIT');

        pinCache.invalidate(pin);
        pinCache.invalidate(`presenter:${pin}`);

        const bankNames = banks.map(b => b.name).join(', ');
        return buildMergeSuccessResponse({ newBankId, pin, totalQuestions, bankIds, bankNames, newName });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Obtiene información resumida de múltiples bancos
 * @param {Array<number>} bankIds - Array de IDs de bancos
 * @returns {Promise<Array>} Array con información de cada banco
 */
async function getBanksInfo(bankIds) {
    if (!Array.isArray(bankIds) || bankIds.length === 0) {
        return [];
    }

    const result = await pool.query(
        `SELECT 
            qb.id,
            qb.name,
            qb.pin,
            COUNT(q.id)::int as question_count
         FROM question_banks qb
         LEFT JOIN questions q ON q.bank_id = qb.id
         WHERE qb.id = ANY($1::int[])
         GROUP BY qb.id, qb.name, qb.pin
         ORDER BY qb.name`,
        [bankIds]
    );

    return result.rows;
}

module.exports = {
    mergeBanks,
    getBanksInfo
};
