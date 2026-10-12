/**
 * @fileoverview Validación de las preguntas fill_blanks («Completa la frase») y de
 * los payloads que envía el jugador.
 *
 * - fillBlanksOptionsSchema: las palabras (una opción por hueco), 1-3, de 4 a 14
 *   letras A-Z/Ñ/Ç tras normalizar (admite tildes y minúsculas: se normalizan).
 * - fillBlanksQuestionRule: regla de pregunta completa (questionSchema.custom). Si el
 *   enunciado llega con corchetes (JSON importado a mano, add-in…) lo convierte a
 *   marcadores + opciones; después exige que haya tantos marcadores como palabras.
 * - isValidWordsPayload / isValidBlankIndex: forma de lo que manda el móvil.
 */

'use strict';

const Joi = require('joi');
const FB = require('../../public/js/core/fill-blanks-text.js');

const { LIMITS } = FB;
// Lo que puede teclear un jugador antes de normalizar: letras (con tildes) y nada más
const RAW_WORD = /^[A-Za-zÀ-ɏ]*$/;
// Margen para tildes escritas como marcas combinantes (NFD) en algunos teclados
const RAW_WORD_MAX = LIMITS.MAX_WORD_LENGTH * 2;

const ERROR_MESSAGES = {
    word_chars: 'Cada palabra solo puede tener letras (sin espacios, números ni signos)',
    word_short: `Cada palabra debe tener al menos ${LIMITS.MIN_WORD_LENGTH} letras`,
    word_long: `Cada palabra no puede tener más de ${LIMITS.MAX_WORD_LENGTH} letras`,
    no_blanks: 'La frase necesita al menos una palabra entre corchetes',
    too_many_blanks: `La frase admite como máximo ${LIMITS.MAX_BLANKS} palabras entre corchetes`,
    unbalanced: 'Hay corchetes sin cerrar o sueltos en la frase',
    // Sin llaves en el texto: Joi las interpretaría como plantilla del mensaje
    marker_literal: 'La frase no puede contener marcadores de hueco escritos a mano: escribe las palabras a adivinar entre corchetes',
    mismatch: 'Los huecos de la frase no coinciden con las palabras'
};

const wordSchema = Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
        const normalized = FB.normalizeWord(value.normalize('NFC'));
        const code = FB.wordError(normalized);
        if (code) return helpers.error(`fillBlanks.${code}`);
        // Se guarda ya normalizada: en mayúsculas y sin tildes (Ñ y Ç se conservan)
        return normalized;
    }, 'fill_blanks word')
    .messages({
        'string.empty': 'La palabra de un hueco no puede estar vacía',
        'fillBlanks.word_chars': ERROR_MESSAGES.word_chars,
        'fillBlanks.word_short': ERROR_MESSAGES.word_short,
        'fillBlanks.word_long': ERROR_MESSAGES.word_long
    });

// Mismos campos opcionales que optionSchema: el editor envía la opción genérica
const fillBlanksOptionSchema = Joi.object({
    optionText: wordSchema,
    // Todas las palabras son "correctas"; default para que options.is_correct no quede NULL
    isCorrect: Joi.boolean().default(true),
    justification: Joi.string().allow(null, '').optional(),
    order_index: Joi.number().integer().min(0).allow(null).optional(),
    orderIndex: Joi.number().integer().min(0).allow(null).optional(),
    match_value: Joi.string().allow(null, '').optional(),
    option_image_url: Joi.string().allow(null, '').optional()
});

const fillBlanksOptionsSchema = Joi.array()
    .items(fillBlanksOptionSchema)
    .min(LIMITS.MIN_BLANKS)
    .max(LIMITS.MAX_BLANKS)
    .required()
    .messages({
        'array.min': ERROR_MESSAGES.no_blanks,
        'array.max': ERROR_MESSAGES.too_many_blanks,
        'any.required': 'Completa la frase necesita sus palabras'
    });

/**
 * Enunciado con corchetes → marcadores + opciones (misma regla que el editor).
 * @returns {{ value: Object }|{ error: string }}
 */
function convertBracketText(value) {
    const parsed = FB.parseEditorText(value.questionText);
    if (parsed.errors.length > 0) return { error: parsed.errors[0].code };
    return {
        value: {
            ...value,
            questionText: parsed.text,
            options: parsed.words.map((word, index) => ({ optionText: word, isCorrect: true, order_index: index }))
        }
    };
}

/**
 * Regla de la pregunta completa (questionSchema.custom): solo actúa en fill_blanks.
 * @param {Object} value - Pregunta ya validada campo a campo
 * @param {Object} helpers - Helpers de Joi
 */
function fillBlanksQuestionRule(value, helpers) {
    if (!value || value.type !== 'fill_blanks') return value;

    let question = value;
    // Corchetes y marcadores mezclados: el editor escribió un {{n}} a mano
    if (FB.hasMarkers(question.questionText) && /\[[^[\]]*\]/.test(question.questionText)) {
        return helpers.error('fillBlanks.marker_literal');
    }
    if (!FB.hasMarkers(question.questionText)) {
        const converted = convertBracketText(question);
        if (converted.error) return helpers.error(`fillBlanks.${converted.error}`);
        question = converted.value;
    }

    const blanks = FB.countBlanks(question.questionText);
    const words = Array.isArray(question.options) ? question.options.length : 0;
    if (blanks !== words || blanks < LIMITS.MIN_BLANKS || blanks > LIMITS.MAX_BLANKS) {
        return helpers.error('fillBlanks.mismatch');
    }
    for (let n = 1; n <= blanks; n++) {
        if (!question.questionText.includes(`{{${n}}}`)) return helpers.error('fillBlanks.mismatch');
    }
    return question;
}

/** Mensajes de la regla de pregunta completa (para questionSchema.messages) */
const fillBlanksRuleMessages = Object.fromEntries(
    Object.entries(ERROR_MESSAGES).map(([code, message]) => [`fillBlanks.${code}`, message])
);

/**
 * Forma del payload `words` que envía el jugador: una palabra (o '') por hueco, nunca
 * más de MAX_BLANKS, solo letras. Un array vacío es válido (envío automático sin nada).
 * @param {*} words
 * @returns {boolean}
 */
function isValidWordsPayload(words) {
    if (!Array.isArray(words) || words.length > LIMITS.MAX_BLANKS) return false;
    return words.every(word => typeof word === 'string' && word.length <= RAW_WORD_MAX && RAW_WORD.test(word));
}

function isValidBlankIndex(blankIndex) {
    return Number.isInteger(blankIndex) && blankIndex >= 0 && blankIndex < LIMITS.MAX_BLANKS;
}

module.exports = {
    ERROR_MESSAGES,
    fillBlanksOptionsSchema,
    fillBlanksQuestionRule,
    fillBlanksRuleMessages,
    isValidWordsPayload,
    isValidBlankIndex
};
