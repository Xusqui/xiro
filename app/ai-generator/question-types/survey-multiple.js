/**
 * @fileoverview Esquema y validación para preguntas tipo survey_multiple
 * (encuesta de selección múltiple): 3-6 opciones, todas is_correct: false,
 * justification: null. Cada jugador puede marcar varias.
 */

const MIN_OPTIONS = 3;
const MAX_OPTIONS = 6;

/**
 * Indica si la pregunta de encuesta múltiple (número de opciones y ninguna marcada como correcta) de la IA es válida.
 * @param {Object} q - Pregunta devuelta por la IA
 * @returns {boolean}
 */
function validate(q) {
    if (!q.options || !Array.isArray(q.options)) return false;
    if (q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS) return false;
    return q.options.every(o => o.is_correct === false && typeof o.option_text === 'string' && o.option_text.trim());
}

/**
 * Convierte una pregunta de encuesta múltiple de la IA al formato de subida de bancos.
 * @param {Object} q - Pregunta devuelta por la IA
 * @returns {Object} Pregunta normalizada
 */
function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'survey_multiple',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 30,
        options: (q.options || []).map(o => ({
            optionText: o.option_text,
            isCorrect: false,
            justification: null,
            order_index: null
        }))
    };
}

module.exports = { validate, normalize, MIN_OPTIONS, MAX_OPTIONS };
