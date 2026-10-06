/**
 * @fileoverview Esquema y validación para preguntas tipo numeric_approximation
 * Respuesta numérica con tolerancia. Sin opciones.
 */

// maxPoints es opcional: el prompt no lo pide y normalize pone 100 por defecto
function validate(q) {
    return Number.isFinite(q.correctAnswer) &&
        Number.isFinite(q.toleranceValue) &&
        (q.maxPoints === undefined || Number.isFinite(q.maxPoints));
}

// La subida de bancos exige tolerancias > 0 y el juego ignora las demás:
// se sustituyen por los valores por defecto (25 % y 1000 unidades)
function positiveOr(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'numeric_approximation',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 30,
        // La subida de bancos solo admite enteros
        correctAnswer: Math.round(q.correctAnswer),
        maxPoints: q.maxPoints || 100,
        toleranceMode: q.toleranceMode || 'hybrid',
        toleranceValue: positiveOr(q.toleranceValue, 25),
        toleranceCap: q.toleranceCap === null ? null : positiveOr(q.toleranceCap, 1000),
        hint: q.hint || null,
        options: []
    };
}

module.exports = { validate, normalize };
