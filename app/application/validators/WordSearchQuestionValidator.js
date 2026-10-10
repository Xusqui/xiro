/**
 * @fileoverview Esquema Joi de las opciones de una pregunta word_search (Sopa de letras).
 *
 * Cada opción es una palabra a esconder: solo letras (se admiten tildes, Ñ, Ç…),
 * entre MIN_WORD_LENGTH y MAX_WORD_LENGTH letras tras normalizar, sin repetir.
 * Lo usa questionSchema en validation.js.
 */

'use strict';

const Joi = require('joi');
const { WORD_SEARCH } = require('../../config/game-constants');
const { normalizeSearchWord } = require('../../domain/services/WordSearchService');

const LETTERS_ONLY = /^\p{L}+$/u;

const wordSchema = Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
        // NFC: una tilde tecleada como carácter combinado cuenta como una sola letra
        const composed = value.normalize('NFC');
        const normalized = normalizeSearchWord(composed);
        if (!LETTERS_ONLY.test(composed) || normalized.length !== [...composed].length) {
            return helpers.error('wordSearch.letters');
        }
        if (normalized.length < WORD_SEARCH.MIN_WORD_LENGTH || normalized.length > WORD_SEARCH.MAX_WORD_LENGTH) {
            return helpers.error('wordSearch.length');
        }
        return value;
    }, 'word_search word')
    .messages({
        'string.empty': 'La palabra no puede estar vacía',
        'wordSearch.letters': 'La palabra solo puede contener letras (sin espacios, números ni símbolos)',
        'wordSearch.length': `Cada palabra debe tener entre ${WORD_SEARCH.MIN_WORD_LENGTH} y ${WORD_SEARCH.MAX_WORD_LENGTH} letras`,
    });

// Mismos campos opcionales que optionSchema: el editor envía la opción genérica
const wordSearchOptionSchema = Joi.object({
    optionText: wordSchema,
    // Todas las palabras son "correctas"; default para que options.is_correct no quede NULL
    isCorrect: Joi.boolean().default(true),
    justification: Joi.string().allow(null, '').optional(),
    order_index: Joi.number().integer().min(0).allow(null).optional(),
    orderIndex: Joi.number().integer().min(0).allow(null).optional(),
    match_value: Joi.string().allow(null, '').optional(),
    option_image_url: Joi.string().allow(null, '').optional(),
});

const wordSearchOptionsSchema = Joi.array()
    .items(wordSearchOptionSchema)
    .min(WORD_SEARCH.MIN_WORDS)
    .max(WORD_SEARCH.MAX_WORDS)
    .unique((a, b) => normalizeSearchWord(a.optionText) === normalizeSearchWord(b.optionText))
    .required()
    .messages({
        'array.min': `La sopa de letras necesita al menos ${WORD_SEARCH.MIN_WORDS} palabras`,
        'array.max': `La sopa de letras admite como máximo ${WORD_SEARCH.MAX_WORDS} palabras`,
        'array.unique': 'Las palabras de la sopa de letras no pueden repetirse',
        'any.required': 'La sopa de letras necesita sus palabras',
    });

const SELECTION_KEYS = ['r1', 'c1', 'r2', 'c2'];

/**
 * Forma del payload `found` que envía el jugador: hasta MAX_WORDS selecciones
 * {r1,c1,r2,c2} con coordenadas enteras dentro de la rejilla. Un array vacío es
 * válido (envío automático al agotarse el tiempo sin palabras encontradas).
 * @param {*} found
 * @returns {boolean}
 */
function isValidFoundPayload(found) {
    if (!Array.isArray(found) || found.length > WORD_SEARCH.MAX_WORDS) return false;
    const inGrid = v => Number.isInteger(v) && v >= 0 && v < WORD_SEARCH.GRID_SIZE;
    return found.every(sel => sel && typeof sel === 'object' && SELECTION_KEYS.every(k => inGrid(sel[k])));
}

module.exports = {
    wordSearchOptionsSchema,
    isValidFoundPayload
};
