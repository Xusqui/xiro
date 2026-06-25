/**
 * @fileoverview Esquema y validación para preguntas tipo survey (encuesta)
 * 2-5 opciones, todas is_correct: false, justification: null.
 */

const EXAMPLE = {
    question_text: '¿Cómo valorarías esta sesión formativa?',
    type: 'survey',
    tipo_contenido: 'texto',
    url_recurso: null,
    time_limit: 20,
    options: [
        { option_text: 'Excelente', is_correct: false, justification: null, order_index: null },
        { option_text: 'Muy bien', is_correct: false, justification: null, order_index: null },
        { option_text: 'Bien', is_correct: false, justification: null, order_index: null },
        { option_text: 'Mejorable', is_correct: false, justification: null, order_index: null }
    ]
};

function validate(q) {
    if (!q.options || !Array.isArray(q.options)) return false;
    if (q.options.length < 2 || q.options.length > 5) return false;
    return q.options.every(o => o.is_correct === false);
}

function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'survey',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 20,
        options: (q.options || []).map(o => ({
            optionText: o.option_text,
            isCorrect: false,
            justification: null,
            order_index: null
        }))
    };
}

module.exports = { EXAMPLE, validate, normalize };
