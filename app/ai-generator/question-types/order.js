/**
 * @fileoverview Esquema y validación para preguntas tipo order (secuencia)
 * 4-6 elementos con order_index 0-based. is_correct: false en todas.
 */

function validate(q) {
    if (!q.options || !Array.isArray(q.options)) return false;
    if (q.options.length < 4 || q.options.length > 6) return false;
    return q.options.every(o => typeof o.order_index === 'number');
}

function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'order',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 45,
        options: (q.options || []).map((o, i) => ({
            optionText: o.option_text,
            isCorrect: false,
            justification: o.justification || null,
            order_index: typeof o.order_index === 'number' ? o.order_index : i
        }))
    };
}

module.exports = { validate, normalize };
