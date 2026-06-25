/**
 * @fileoverview Construcción del banco de preguntas en el formato esperado
 * por saveBankComplete (services/db/bank.service.js).
 * Reutiliza: normalizers de cada question-type module.
 */

const NORMALIZERS = {
    quiz: require('./question-types/quiz').normalize,
    survey: require('./question-types/survey').normalize,
    numeric_approximation: require('./question-types/numeric').normalize,
    order: require('./question-types/order').normalize,
    word_scramble: require('./question-types/word-scramble').normalize,
    multiple_choice: require('./question-types/multiple-choice').normalize
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
    return rawQuestions.map(q => normalize(q));
}

/**
 * Ensambla el objeto final compatible con POST /api/banks/save-all.
 * @param {string} bankName - Nombre del banco
 * @param {Array} allQuestions - Preguntas normalizadas de todos los tipos
 * @returns {{ id: null, name: string, questions: Array }}
 */
function buildBankPayload(bankName, allQuestions) {
    return {
        id: null,       // null = nuevo banco
        name: bankName,
        questions: allQuestions
    };
}

module.exports = { buildQuestionsForType, buildBankPayload };
