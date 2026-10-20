/**
 * @fileoverview Esquema Joi del campo slide_video (diapositiva de vídeo de los juegos
 * personalizados). Obligatorio y reproducible (core/video-source.js) en las diapositivas
 * 'video'; en las demás se ignora si viene vacío. Lo usa customGameQuestionSchema en validation.js.
 */

'use strict';

const Joi = require('joi');
const { parseVideoSource, MAX_URL_LENGTH } = require('../../public/js/core/video-source');

/**
 * @param {string} value - URL de vídeo a validar
 * @param {Object} helpers - Helpers de Joi
 * @returns {string|Error} - Valor original si es válido, error si no lo es
 */
const checkVideoUrl = (value, helpers) => {
    if (parseVideoSource(value) === null) {
        return helpers.error('videoSlide.unsupported');
    }
    return value;
};

const slideVideoSchema = Joi.string()
    .max(MAX_URL_LENGTH)
    .trim()
    .when('slide_type', {
        is: 'video',
        then: Joi.string().required().custom(checkVideoUrl),
        otherwise: Joi.allow(null, '').optional()
    })
    .messages({
        'videoSlide.unsupported':
            'La URL del vídeo no es compatible: usa YouTube, Vimeo, Dailymotion o un archivo .mp4, .webm, .ogg o .mov'
    });

module.exports = { slideVideoSchema, checkVideoUrl };
