/**
 * @fileoverview Esquema y validación para preguntas tipo quiz
 * Una pregunta, 4 opciones, exactamente 1 correcta con justification.
 */

/** Ejemplo de estructura esperada en el prompt */
const EXAMPLE = {
    question_text: '¿Cuál es la capital de Francia?',
    type: 'quiz',
    tipo_contenido: 'texto',
    url_recurso: null,
    time_limit: 30,
    options: [
        { option_text: 'París', is_correct: true, justification: 'París es la capital y ciudad más poblada de Francia desde el siglo X.', order_index: null },
        { option_text: 'Lyon', is_correct: false, justification: null, order_index: null },
        { option_text: 'Marsella', is_correct: false, justification: null, order_index: null },
        { option_text: 'Burdeos', is_correct: false, justification: null, order_index: null }
    ]
};

/**
 * Valida que un objeto tiene la estructura básica de quiz.
 * @param {Object} q
 * @returns {boolean}
 */
function validate(q) {
    if (!q.options || !Array.isArray(q.options) || q.options.length < 2) return false;
    const corrects = q.options.filter(o => o.is_correct === true);
    return corrects.length >= 1;
}

/**
 * Normaliza un objeto quiz al formato esperado por saveBankComplete.
 * Reutiliza la convención camelCase de bank.service.js.
 * @param {Object} q
 * @returns {Object}
 */
function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'quiz',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 30,
        options: (q.options || []).map(o => ({
            optionText: o.option_text,
            isCorrect: !!o.is_correct,
            justification: o.justification || null,
            order_index: null
        }))
    };
}

module.exports = { EXAMPLE, validate, normalize };
