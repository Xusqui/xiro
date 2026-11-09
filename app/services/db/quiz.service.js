/**
 * @fileoverview Quizzes database operations (legacy)
 * @module services/db/quiz.service
 */

const { pool } = require('../../config/database');
const { assertEditorCanModifyResource, normalizeCreatorRole } = require('./resource-ownership.service');

/**
 * Obtiene todos los quizzes
 * @returns {Promise<Array>}
 */
async function getAllQuizzes() {
    const result = await pool.query('SELECT * FROM quizzes ORDER BY created_at DESC');
    return result.rows;
}

/**
 * Crea un quiz
 * @param {Object} data - {title, pin}
 * @returns {Promise<Object>}
 */
async function createQuiz(data) {
    const { title, pin, created_by_role = 'admin', created_by_user_id = null } = data;
    const finalPin = (pin || Math.floor(100000 + Math.random() * 900000).toString()).toUpperCase();
    const ownerRole = normalizeCreatorRole(created_by_role);
    const ownerUserId =
        Number.isInteger(Number(created_by_user_id)) && Number(created_by_user_id) > 0
            ? Number(created_by_user_id)
            : null;
    const result = await pool.query(
        'INSERT INTO quizzes (title, pin, created_by_role, created_by_user_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, finalPin, ownerRole, ownerUserId]
    );
    return result.rows[0];
}

/**
 * Obtiene un quiz con sus preguntas
 * @param {number} quizId - ID del quiz
 * @returns {Promise<{quiz: Object, questions: Array}|null>}
 */
async function getQuizWithQuestions(quizId) {
    const quiz = await pool.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    if (quiz.rows.length === 0) return null;

    const questions = await pool.query(
        `
        SELECT q.*, (SELECT json_agg(o.*) FROM options o WHERE o.question_id = q.id) as options
        FROM questions q WHERE q.quiz_id = $1 ORDER BY q.id ASC
    `,
        [quizId]
    );

    return { quiz: quiz.rows[0], questions: questions.rows || [] };
}

/**
 * Elimina un quiz
 * @param {number} quizId - ID del quiz
 * @returns {Promise<void>}
 */
async function deleteQuiz(quizId, actorUserId = null) {
    await assertEditorCanModifyResource('quiz', quizId, actorUserId, pool);
    await pool.query('DELETE FROM quizzes WHERE id = $1', [quizId]);
}

/**
 * Obtiene preguntas de un quiz (para iniciar partida)
 * @param {number} quizId - ID del quiz
 * @returns {Promise<Array>}
 */
async function getQuizQuestions(quizId) {
    const questionsRes = await pool.query(
        `
        SELECT q.id, q.question_text, q.question_type, q.tipo_contenido, q.url_recurso, q.time_limit,
        json_agg(json_build_object('optionText', o.option_text, 'isCorrect', o.is_correct, 'justification', o.justification, 'order_index', o.order_index, 'match_value', o.match_value, 'option_image_url', o.option_image_url) ORDER BY COALESCE(o.order_index, o.id)) as options
        FROM questions q JOIN options o ON q.id = o.question_id
        WHERE q.quiz_id = $1 GROUP BY q.id, q.tipo_contenido, q.url_recurso, q.time_limit ORDER BY q.id ASC
    `,
        [quizId]
    );

    return questionsRes.rows;
}

module.exports = {
    getAllQuizzes,
    createQuiz,
    getQuizWithQuestions,
    deleteQuiz,
    getQuizQuestions
};
