/**
 * @fileoverview Construcción del banco de preguntas en el formato esperado
 * por saveBankComplete (services/db/bank.service.js).
 * Reutiliza: normalizers de cada question-type module.
 */

const logger = require('../config/logger');
const { LIMITS } = require('../validation/primitives');

const NORMALIZERS = {
    quiz: require('./question-types/quiz').normalize,
    survey: require('./question-types/survey').normalize,
    numeric_approximation: require('./question-types/numeric').normalize,
    order: require('./question-types/order').normalize,
    word_scramble: require('./question-types/word-scramble').normalize,
    multiple_choice: require('./question-types/multiple-choice').normalize,
    fill_blanks: require('./question-types/fill-blanks').normalize,
    word_search: require('./question-types/word-search').normalize,
    matching: require('./question-types/matching').normalize,
    survey_multiple: require('./question-types/survey-multiple').normalize,
    hotspot: require('./question-types/hotspot').normalize,
    word_cloud: require('./question-types/word-cloud').normalize
};

/**
 * Convierte un array de preguntas raw (del JSON de IA) al formato
 * que acepta saveBankComplete en services/db/bank.service.js.
 * @param {string} type - Tipo de pregunta
 * @param {Array} rawQuestions - Preguntas parseadas de la respuesta de IA
 * @returns {Array} Preguntas normalizadas en formato camelCase de saveBankComplete
 */
function buildQuestionsForType(type, rawQuestions) {
    const normalize = NORMALIZERS[type];
    if (!normalize) throw new Error(`Tipo desconocido: ${type}`);
    return rawQuestions.map(q => dropOverlongOptionalTexts(normalize(q)));
}

/**
 * Devuelve el texto, o null si pasa de `max`. Se descarta en vez de recortar: lo que
 * se pasa del límite suele ser razonamiento del modelo colado en el campo, y cortado
 * seguiría sin servir. Sin esto, /api/banks/save-all rechaza el banco entero.
 * @param {*} text
 * @param {number} max
 * @param {string} field - nombre para el log
 * @returns {*} el mismo valor, o null si es un texto demasiado largo
 */
function withinLimit(text, max, field) {
    if (typeof text !== 'string' || text.length <= max) return text;
    logger.warn(`[ai-generator] ${field} de la IA descartado: ${text.length} caracteres (máximo ${max})`);
    return null;
}

/**
 * Aplica a una pregunta normalizada los límites de los textos opcionales
 * (justificaciones y pista) que valida /api/banks/save-all.
 * @param {Object} question - pregunta normalizada
 * @returns {Object} la misma pregunta, con los textos demasiado largos a null
 */
function dropOverlongOptionalTexts(question) {
    const result = { ...question };
    if ('justification' in result) {
        result.justification = withinLimit(result.justification, LIMITS.JUSTIFICATION_MAX, 'justification');
    }
    if ('hint' in result) result.hint = withinLimit(result.hint, LIMITS.HINT_MAX, 'hint');
    if (Array.isArray(result.options)) {
        result.options = result.options.map(option => ({
            ...option,
            justification: withinLimit(option.justification, LIMITS.JUSTIFICATION_MAX, 'justification')
        }));
    }
    return result;
}

/**
 * Ensambla el objeto final compatible con POST /api/banks/save-all.
 * @param {string} bankName - Nombre del banco
 * @param {Array} allQuestions - Preguntas normalizadas de todos los tipos
 * @param {string} language - Código de idioma del contenido (ver config/languages.js)
 * @returns {{ id: null, name: string, language: string, questions: Array }}
 */
function buildBankPayload(bankName, allQuestions, language) {
    return {
        id: null, // null = nuevo banco
        name: bankName,
        language,
        questions: allQuestions
    };
}

module.exports = { buildQuestionsForType, buildBankPayload };
