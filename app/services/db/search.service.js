/**
 * @fileoverview Search service: búsqueda de preguntas en todos los bancos
 * @module services/db/search.service
 *
 * Busca en question_text y option_text usando ILIKE (case-insensitive).
 * Devuelve hasta 150 resultados con opciones y datos del banco.
 */

const { pool } = require('../../config/database');

/**
 * Busca preguntas por texto del enunciado o de las opciones
 * en todos los bancos de preguntas disponibles.
 *
 * @param {string} query - Texto a buscar (mínimo 2 caracteres)
 * @returns {Promise<Array>} Lista de preguntas con opciones y nombre del banco
 */
async function searchQuestions(query) {
    if (!query || query.trim().length < 2) return [];

    const pattern = `%${query.trim()}%`;

    const result = await pool.query(`
        SELECT 
            q.id,
            q.question_text,
            q.question_type,
            q.correct_answer,
            q.max_points,
            q.tolerance_mode,
            q.tolerance_value,
            q.tolerance_cap,
            q.hint_text,
            q.correct_word,
            q.tipo_contenido,
            q.url_recurso,
            qb.id   AS bank_id,
            qb.name AS bank_name,
            (
                SELECT json_agg(o.* ORDER BY COALESCE(o.order_index, o.id))
                FROM options o
                WHERE o.question_id = q.id
            ) AS options
        FROM questions q
        JOIN question_banks qb ON q.bank_id = qb.id
        WHERE q.question_text ILIKE $1
           OR EXISTS (
               SELECT 1 FROM options o 
               WHERE o.question_id = q.id AND o.option_text ILIKE $1
           )
        ORDER BY q.id
        LIMIT 150
    `, [pattern]);

    return result.rows;
}

module.exports = { searchQuestions };
