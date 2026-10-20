/**
 * @fileoverview Esquema y validación para preguntas tipo word_search (Sopa de letras).
 * La IA devuelve la consigna y las palabras en options[].option_text, el mismo
 * formato que el JSON de bancos; aquí se exige lo que WordSearchQuestionValidator
 * (2-6 palabras, 3-10 letras, solo letras, sin repetir) y se convierte al formato
 * camelCase que acepta saveBankComplete.
 */

const { WORD_SEARCH } = require('../../config/game-constants');
const { normalizeSearchWord } = require('../../domain/services/WordSearchService');

const LETTERS_ONLY = /^\p{L}+$/u;

function getWordText(opt) {
    const text = opt?.option_text ?? opt?.optionText;
    return typeof text === 'string' ? text.trim().normalize('NFC') : '';
}

/** Una sola palabra de solo letras cuya forma normalizada tiene 3-10 letras */
function isValidWord(word) {
    if (!LETTERS_ONLY.test(word)) return false;
    const normalized = normalizeSearchWord(word);
    return (
        normalized.length === [...word].length &&
        normalized.length >= WORD_SEARCH.MIN_WORD_LENGTH &&
        normalized.length <= WORD_SEARCH.MAX_WORD_LENGTH
    );
}

function validate(q) {
    if (!q || typeof q.question_text !== 'string' || q.question_text.trim().length === 0) return false;
    if (!Array.isArray(q.options)) return false;
    if (q.options.length < WORD_SEARCH.MIN_WORDS || q.options.length > WORD_SEARCH.MAX_WORDS) return false;
    const words = q.options.map(getWordText);
    if (!words.every(isValidWord)) return false;
    return new Set(words.map(normalizeSearchWord)).size === words.length;
}

function normalize(q) {
    return {
        questionText: q.question_text.trim(),
        type: 'word_search',
        tipo_contenido: 'texto',
        url_recurso: null,
        time_limit: q.time_limit || 90,
        options: q.options.map((opt, index) => ({
            optionText: normalizeSearchWord(getWordText(opt)),
            isCorrect: true,
            justification: null,
            order_index: index
        }))
    };
}

module.exports = { validate, normalize };
