/**
 * @fileoverview Esquema y validación para preguntas tipo order (secuencia)
 * 4-6 elementos con order_index 0-based. is_correct: false en todas.
 */

const EXAMPLE = {
    question_text: 'Ordena los planetas del sistema solar de menor a mayor distancia al Sol',
    type: 'order',
    tipo_contenido: 'texto',
    url_recurso: null,
    time_limit: 45,
    options: [
        { option_text: 'Mercurio', is_correct: false, order_index: 0, justification: 'El más cercano al Sol, a 0.39 UA.' },
        { option_text: 'Venus', is_correct: false, order_index: 1, justification: 'El segundo planeta, a 0.72 UA.' },
        { option_text: 'Tierra', is_correct: false, order_index: 2, justification: 'El tercero, a 1 UA por definición.' },
        { option_text: 'Marte', is_correct: false, order_index: 3, justification: 'El cuarto, a 1.52 UA del Sol.' }
    ]
};

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

module.exports = { EXAMPLE, validate, normalize };
