/**
 * @fileoverview Esquema y validación para preguntas tipo numeric_approximation
 * Respuesta numérica con tolerancia. Sin opciones.
 */

const EXAMPLE = {
    question_text: '¿En qué año se publicó el Quijote?',
    type: 'numeric_approximation',
    tipo_contenido: 'texto',
    url_recurso: null,
    time_limit: 30,
    correctAnswer: 1605,
    maxPoints: 100,
    toleranceMode: 'hybrid',
    toleranceValue: 25,
    toleranceCap: 50,
    hint: 'Fue publicado a principios del siglo XVII',
    options: []
};

// maxPoints es opcional: el prompt no lo pide y normalize pone 100 por defecto
function validate(q) {
    return Number.isFinite(q.correctAnswer) &&
        Number.isFinite(q.toleranceValue) &&
        (q.maxPoints === undefined || Number.isFinite(q.maxPoints));
}

function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'numeric_approximation',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 30,
        correctAnswer: q.correctAnswer,
        maxPoints: q.maxPoints || 100,
        toleranceMode: q.toleranceMode || 'hybrid',
        toleranceValue: q.toleranceValue ?? 25,
        toleranceCap: q.toleranceCap !== undefined ? q.toleranceCap : 1000,
        hint: q.hint || null,
        options: []
    };
}

module.exports = { EXAMPLE, validate, normalize };
