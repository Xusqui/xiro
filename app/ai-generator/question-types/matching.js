/**
 * @fileoverview Esquema y validación para preguntas tipo matching (Emparejar).
 * La IA devuelve los pares en options[] (option_text = elemento izquierdo,
 * match_value = pareja derecha), el mismo formato que el JSON de bancos; aquí se
 * exige lo que validation.js (2-6 pares, textos no vacíos de hasta 200 caracteres)
 * y, además, que ningún lado se repita para que cada par tenga una sola solución.
 */

const MIN_PAIRS = 2;
const MAX_PAIRS = 6;
const MAX_TEXT_LENGTH = 200;

function getSide(opt, snake, camel) {
    const value = opt?.[snake] ?? opt?.[camel];
    return typeof value === 'string' ? value.trim() : '';
}

function isValidText(text) {
    return text.length > 0 && text.length <= MAX_TEXT_LENGTH;
}

function allDistinct(values) {
    return new Set(values.map(v => v.toLocaleLowerCase())).size === values.length;
}

function validate(q) {
    if (!q || typeof q.question_text !== 'string' || q.question_text.trim().length === 0) return false;
    if (!Array.isArray(q.options)) return false;
    if (q.options.length < MIN_PAIRS || q.options.length > MAX_PAIRS) return false;
    const lefts = q.options.map(opt => getSide(opt, 'option_text', 'optionText'));
    const rights = q.options.map(opt => getSide(opt, 'match_value', 'matchValue'));
    if (!lefts.every(isValidText) || !rights.every(isValidText)) return false;
    return allDistinct(lefts) && allDistinct(rights);
}

function normalize(q) {
    return {
        questionText: q.question_text.trim(),
        type: 'matching',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 45,
        options: q.options.map((opt, index) => ({
            optionText: getSide(opt, 'option_text', 'optionText'),
            // snake_case: el esquema Joi de /api/banks/save-all solo admite match_value
            // y descarta claves desconocidas, así que matchValue se perdía al guardar
            match_value: getSide(opt, 'match_value', 'matchValue'),
            isCorrect: false,
            justification: opt.justification || null,
            order_index: index
        }))
    };
}

module.exports = { validate, normalize, MIN_PAIRS, MAX_PAIRS };
