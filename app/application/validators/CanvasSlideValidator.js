/**
 * @fileoverview Esquema Joi del campo slide_canvas (diapositiva libre de los juegos personalizados).
 * Obligatorio y reproducible en las diapositivas 'canvas'; en las demás se ignora si viene vacío.
 * Lo usa customGameQuestionSchema en validation.js.
 */

'use strict';

const Joi = require('joi');
const {
    isSafeMediaUrl,
    ELEMENT_TYPES,
    SHAPES,
    MAX_ELEMENTS,
    MAX_JSON_BYTES,
    MIN_SIZE,
    MAX_URL,
    GROUP_ID_RE
} = require('../../public/js/core/slide-canvas-model');
const { parseVideoSource } = require('../../public/js/core/video-source');
const { normalizePath, MAX_CHARS: MAX_PATH_CHARS } = require('../../public/js/core/slide-canvas-path');
const { MAX_ALT } = require('../../public/js/core/slide-canvas-style');
const { tablePropsSchema } = require('./CanvasTableSchema');
const { textPropsSchema } = require('./CanvasTextSchema');

/**
 * @param {string} value - URL de imagen o video a validar
 * @param {Object} helpers - Helpers de Joi
 * @returns {string|Error} - Valor original si es válido, error si no lo es
 */
const checkMediaUrl = (value, helpers) => {
    if (!isSafeMediaUrl(value)) {
        return helpers.error('canvasSlide.unsafeUrl');
    }
    return value;
};

/**
 * @param {string} value - URL de video a validar
 * @param {Object} helpers - Helpers de Joi
 * @returns {string|Error} - Valor original si es válido, error si no lo es
 */
const checkVideoUrl = (value, helpers) => {
    if (parseVideoSource(value) === null) {
        return helpers.error('canvasSlide.unsupportedVideo');
    }
    return value;
};

/**
 * @param {string} value - Trazado SVG de la forma libre
 * @param {Object} helpers - Helpers de Joi
 * @returns {string|Error} - Valor original si el tokenizador lo acepta, error si no
 */
const checkPath = (value, helpers) => (normalizePath(value) === null ? helpers.error('canvasSlide.badPath') : value);

// Colores en formato hex (#rrggbb o #rrggbbaa)
const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

const MESSAGES = {
    'canvasSlide.unsafeUrl': 'La imagen de la diapositiva libre debe estar en /uploads/ o ser una URL http(s)',
    'canvasSlide.unsupportedVideo':
        'Vídeo no compatible: usa YouTube, Vimeo, Dailymotion o un archivo .mp4, .webm, .ogg o .mov',
    'canvasSlide.tooLarge': 'La diapositiva libre es demasiado grande',
    'canvasSlide.badPath': 'La forma libre tiene un trazado no válido'
};

// Sombra (fase B): desplazamiento, desenfoque y color, como la normaliza slide-canvas-style.js
const shadowSchema = Joi.object({
    x: Joi.number().integer().min(-100).max(100).required(),
    y: Joi.number().integer().min(-100).max(100).required(),
    blur: Joi.number().integer().min(0).max(100).required(),
    color: Joi.string().pattern(COLOR_RE).required()
}).unknown(false);

const canvasElementSchema = Joi.object({
    id: Joi.string()
        .pattern(/^el_[a-z0-9]{4,16}$/)
        .required(),
    type: Joi.string()
        .valid(...ELEMENT_TYPES)
        .required(),
    x: Joi.number().integer().min(-1920).max(3840).required(),
    y: Joi.number().integer().min(-1080).max(2160).required(),
    w: Joi.number().integer().min(MIN_SIZE).max(3840).required(),
    h: Joi.number().integer().min(MIN_SIZE).max(2160).required(),
    rotation: Joi.number().integer().min(-180).max(180),
    locked: Joi.boolean().strict(),
    groupId: Joi.string().pattern(GROUP_ID_RE),
    opacity: Joi.number().min(0.05).max(0.99),
    shadow: shadowSchema,
    props: Joi.alternatives()
        .conditional('type', {
            is: 'text',
            then: textPropsSchema,
            otherwise: Joi.alternatives().conditional('type', {
                is: 'shape',
                then: Joi.object({
                    shape: Joi.string().valid(...SHAPES),
                    fill: Joi.string().pattern(COLOR_RE).allow(null),
                    stroke: Joi.string().pattern(COLOR_RE).allow(null),
                    strokeWidth: Joi.number().integer().min(0).max(60),
                    radius: Joi.number().integer().min(0).max(540),
                    d: Joi.when('shape', {
                        is: 'path',
                        then: Joi.string().max(MAX_PATH_CHARS).required().custom(checkPath),
                        otherwise: Joi.forbidden()
                    }),
                    viewBox: Joi.when('shape', {
                        is: 'path',
                        then: Joi.array().items(Joi.number().greater(0).max(1000000)).length(2).required(),
                        otherwise: Joi.forbidden()
                    })
                }).unknown(false),
                otherwise: Joi.alternatives().conditional('type', {
                    is: 'image',
                    then: Joi.object({
                        src: Joi.string().max(MAX_URL).required().custom(checkMediaUrl),
                        ratio: Joi.number().min(0.05).max(20).allow(null),
                        lockRatio: Joi.boolean(),
                        fit: Joi.string().valid('contain', 'cover'),
                        radius: Joi.number().integer().min(0).max(540),
                        alt: Joi.string().max(MAX_ALT),
                        borderWidth: Joi.number().integer().min(1).max(40),
                        borderColor: Joi.string().pattern(COLOR_RE)
                    }).unknown(false),
                    otherwise: Joi.alternatives().conditional('type', {
                        is: 'table',
                        then: tablePropsSchema,
                        otherwise: Joi.object({
                            url: Joi.string().max(MAX_URL).required().custom(checkVideoUrl),
                            autoplay: Joi.boolean()
                        }).unknown(false)
                    })
                })
            })
        })
        .required()
})
    .unknown(false)
    .messages(MESSAGES);

const canvasSchema = Joi.object({
    version: Joi.number().integer().valid(1).required(),
    background: Joi.object({
        color: Joi.string().pattern(COLOR_RE).required(),
        image: Joi.string().max(MAX_URL).allow(null).custom(checkMediaUrl),
        gradient: Joi.object({
            to: Joi.string().pattern(COLOR_RE).required(),
            angle: Joi.number().integer().min(0).max(359).required()
        }).unknown(false)
    }).required(),
    elements: Joi.array().items(canvasElementSchema).max(MAX_ELEMENTS).unique('id').required()
})
    .custom((value, helpers) => {
        if (JSON.stringify(value).length > MAX_JSON_BYTES) {
            return helpers.error('canvasSlide.tooLarge');
        }
        return value;
    })
    .messages(MESSAGES);

// Obligatorio en las diapositivas 'canvas'; en las demás se admite null o ausente
const slideCanvasSchema = Joi.any()
    .when('slide_type', {
        is: 'canvas',
        then: canvasSchema.required(),
        otherwise: Joi.object().allow(null).optional()
    })
    .messages(MESSAGES);

module.exports = { slideCanvasSchema, canvasSchema };
