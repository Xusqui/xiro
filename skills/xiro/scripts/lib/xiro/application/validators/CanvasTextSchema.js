/**
 * @fileoverview Esquema Joi de las props de un texto de la diapositiva libre (fase C, tipo Word).
 * Acepta solo lo que escribe normalizeElement (core/slide-canvas-model.js y
 * core/slide-canvas-richtext.js): tramos con formato de carácter que suman props.text y un
 * párrafo por línea con formato acotado. Lo usa CanvasSlideValidator.js en la rama 'text'.
 */

'use strict';

const Joi = require('joi');
const { FONTS, MAX_TEXT } = require('../../public/js/core/slide-canvas-model');
const {
    MAX_RUNS,
    MAX_INDENT,
    MAX_SPACE,
    LISTS,
    ALIGNS,
    SCRIPTS,
    PARA_STYLES,
    LINE_HEIGHTS,
    textOf
} = require('../../public/js/core/slide-canvas-richtext');

const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const FONT_KEYS = Object.keys(FONTS);

// Tramo: solo lo que difiere del formato del cuadro
const runSchema = Joi.object({
    text: Joi.string().min(1).max(MAX_TEXT).required(),
    bold: Joi.boolean(),
    italic: Joi.boolean(),
    underline: Joi.boolean(),
    strike: Joi.boolean().valid(true),
    color: Joi.string().pattern(COLOR_RE),
    font: Joi.string().valid(...FONT_KEYS),
    size: Joi.number().integer().min(8).max(400),
    script: Joi.string().valid(...SCRIPTS),
    highlight: Joi.string().pattern(COLOR_RE)
}).unknown(false);

// Párrafo: los valores por defecto (sin sangría, sin espacios, estilo normal) no se guardan
const paraSchema = Joi.object({
    align: Joi.string().valid(...ALIGNS),
    list: Joi.string().valid(...LISTS, 'none'),
    indent: Joi.number().integer().min(1).max(MAX_INDENT),
    lineHeight: Joi.number().valid(...LINE_HEIGHTS),
    spaceBefore: Joi.number().integer().min(1).max(MAX_SPACE),
    spaceAfter: Joi.number().integer().min(1).max(MAX_SPACE),
    style: Joi.string().valid(...PARA_STYLES)
}).unknown(false);

/**
 * Los tramos suman props.text, hay un párrafo por línea y «sin lista» solo va con lista en el
 * cuadro (normalizeCanvas lo escribe así).
 * @param {Object} props - Props de un texto
 * @param {Object} helpers - Helpers de Joi
 * @returns {Object|Error} - Props si cuadran, error si no
 */
const checkTextShape = (props, helpers) => {
    const text = props.text || '';
    if (props.runs && textOf(props.runs) !== text) return helpers.error('canvasSlide.runsMismatch');
    if (!props.paras) return props;
    if (props.paras.length !== text.split('\n').length) return helpers.error('canvasSlide.parasMismatch');
    if (!props.list && props.paras.some(para => para.list === 'none'))
        return helpers.error('canvasSlide.parasMismatch');
    return props;
};

const textPropsSchema = Joi.object({
    text: Joi.string().max(MAX_TEXT).allow(''),
    font: Joi.string().valid(...FONT_KEYS),
    size: Joi.number().integer().min(8).max(400),
    bold: Joi.boolean(),
    italic: Joi.boolean(),
    color: Joi.string().pattern(COLOR_RE),
    align: Joi.string().valid(...ALIGNS),
    valign: Joi.string().valid('top', 'middle', 'bottom'),
    fill: Joi.string().pattern(COLOR_RE).allow(null),
    fit: Joi.string().valid('wrap', 'shrink'),
    underline: Joi.boolean().valid(true),
    list: Joi.string().valid(...LISTS),
    runs: Joi.array().items(runSchema).min(1).max(MAX_RUNS),
    paras: Joi.array()
        .items(paraSchema)
        .min(1)
        .max(MAX_TEXT + 1)
})
    .unknown(false)
    .custom(checkTextShape)
    .messages({
        'canvasSlide.runsMismatch': 'El formato del texto no coincide con su contenido',
        'canvasSlide.parasMismatch': 'El formato de los párrafos no coincide con el texto'
    });

module.exports = { textPropsSchema };
