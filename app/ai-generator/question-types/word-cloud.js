/**
 * @fileoverview Esquema y validación para preguntas tipo word_cloud («Nube de palabras»):
 * pregunta abierta sin opciones ni respuesta correcta. La IA solo escribe el enunciado y,
 * si quiere, max_words (palabras que envía cada jugador, de 1 a 5; 1 por defecto).
 */

const { MIN_WORDS, MAX_WORDS, DEFAULT_MAX_WORDS } = require('../../public/js/core/word-cloud-text');

/**
 * Indica si la pregunta de nube de palabras de la IA es válida.
 * @param {Object} q - Pregunta devuelta por la IA
 * @returns {boolean}
 */
function validate(q) {
    if (typeof q.question_text !== 'string' || !q.question_text.trim()) return false;
    if (q.max_words === undefined) return true;
    return Number.isInteger(q.max_words) && q.max_words >= MIN_WORDS && q.max_words <= MAX_WORDS;
}

/**
 * Convierte una pregunta de nube de palabras de la IA al formato de subida de bancos.
 * Las opciones que la IA invente se descartan: el tipo no tiene.
 * @param {Object} q - Pregunta devuelta por la IA
 * @returns {Object} Pregunta normalizada
 */
function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'word_cloud',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 30,
        max_words: Number.isInteger(q.max_words) ? q.max_words : DEFAULT_MAX_WORDS,
        options: []
    };
}

module.exports = { validate, normalize };
