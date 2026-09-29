/**
 * @fileoverview Esquema y validación para preguntas tipo multiple_choice
 * Entre 2 y 6 correctas de un total de 4-8 opciones. justification: null en todas.
 * mc_points_per_correct|mc_penalty_per_incorrect|mc_perfect_bonus usan defaults de BD (10/10/20).
 */

const EXAMPLE = {
    question_text: '¿Cuáles de estos elementos son gases nobles?',
    type: 'multiple_choice',
    tipo_contenido: 'texto',
    url_recurso: null,
    time_limit: 40,
    mc_points_per_correct: 10,
    mc_penalty_per_incorrect: 10,
    mc_perfect_bonus: 20,
    options: [
        { option_text: 'Helio', is_correct: true, justification: null, order_index: null },
        { option_text: 'Neón', is_correct: true, justification: null, order_index: null },
        { option_text: 'Oxígeno', is_correct: false, justification: null, order_index: null },
        { option_text: 'Argón', is_correct: true, justification: null, order_index: null },
        { option_text: 'Nitrógeno', is_correct: false, justification: null, order_index: null }
    ]
};

function validate(q) {
    if (!q.options || !Array.isArray(q.options)) return false;
    if (q.options.length < 4 || q.options.length > 8) return false;
    const corrects = q.options.filter(o => o.is_correct === true);
    return corrects.length >= 2 && corrects.length <= 6;
}

function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'multiple_choice',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 40,
        // Los mc_* aplican defaults del schema DB (10/10/20); se pasan para coherencia
        mc_points_per_correct: q.mc_points_per_correct || 10,
        mc_penalty_per_incorrect: q.mc_penalty_per_incorrect || 10,
        mc_perfect_bonus: q.mc_perfect_bonus || 20,
        options: (q.options || []).map(o => ({
            optionText: o.option_text,
            isCorrect: !!o.is_correct,
            justification: null,
            order_index: null
        }))
    };
}

module.exports = { EXAMPLE, validate, normalize };
