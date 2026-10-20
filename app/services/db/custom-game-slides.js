/**
 * @fileoverview Inserción de las filas de custom_game_questions (preguntas y
 * diapositivas especiales). Compartido por crear y actualizar juego personalizado.
 * @module services/db/custom-game-slides
 */

const { LIMITS } = require('../../validation');

const SLIDE_FOOTER_MAX = LIMITS.SLIDE_FOOTER_MAX;

/**
 * Sentencias por tipo de diapositiva. SQL estático: el texto del usuario viaja
 * siempre como parámetro. `fields` son las columnas propias del tipo, en orden.
 */
const SLIDE_INSERTS = {
    comment: {
        sql: 'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, comment_text, slide_footer) VALUES ($1, $2, $3, $4, $5, $6)',
        fields: ['comment_text']
    },
    info: {
        sql: 'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, comment_text, slide_footer) VALUES ($1, $2, $3, $4, $5, $6)',
        fields: ['comment_text']
    },
    text: {
        sql: 'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_title, slide_body, slide_footer) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        fields: ['slide_title', 'slide_body']
    },
    image: {
        sql: 'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_image, slide_footer) VALUES ($1, $2, $3, $4, $5, $6)',
        fields: ['slide_image']
    },
    'text-image': {
        sql: 'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_title, slide_body, slide_image, slide_image_position, slide_footer) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        fields: ['slide_title', 'slide_body', 'slide_image', 'slide_image_position']
    },
    video: {
        sql: 'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_video, slide_footer) VALUES ($1, $2, $3, $4, $5, $6)',
        fields: ['slide_video']
    },
    canvas: {
        sql: 'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type, slide_canvas, slide_footer) VALUES ($1, $2, $3, $4, $5::jsonb, $6)',
        fields: ['slide_canvas'],
        serialize: { slide_canvas: JSON.stringify }
    }
};

const QUESTION_INSERT_SQL =
    'INSERT INTO custom_game_questions (custom_game_id, question_id, position, slide_type) VALUES ($1, $2, $3, $4)';

/**
 * Normaliza el pie: texto recortado o null si está vacío o no es texto.
 * @param {*} value
 * @returns {string|null}
 */
function normalizeSlideFooter(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, SLIDE_FOOTER_MAX) : null;
}

/**
 * Inserta una pregunta o diapositiva del juego personalizado.
 * @param {Object} client - Cliente pg dentro de la transacción
 * @param {number} customGameId
 * @param {number} position
 * @param {Object} q - Pregunta/diapositiva validada
 * @returns {Promise<Object>}
 */
function insertCustomGameQuestion(client, customGameId, position, q) {
    const slide = Object.hasOwn(SLIDE_INSERTS, q.slide_type) ? SLIDE_INSERTS[q.slide_type] : null;
    if (!slide) {
        return client.query(QUESTION_INSERT_SQL, [customGameId, q.question_id, position, 'question']);
    }
    const values = slide.fields.map(field => {
        const value = q[field];
        if (slide.serialize && slide.serialize[field]) {
            return slide.serialize[field](value);
        }
        return value;
    });
    return client.query(slide.sql, [
        customGameId,
        null,
        position,
        q.slide_type,
        ...values,
        normalizeSlideFooter(q.slide_footer)
    ]);
}

module.exports = { insertCustomGameQuestion, normalizeSlideFooter, SLIDE_FOOTER_MAX };
