/**
 * @fileoverview Esquema Joi del campo slide_howto (diapositiva de instrucciones de los juegos
 * personalizados). El valor solo elige un tema de una lista cerrada; el contenido (animación,
 * textos y locución) está en el código del cliente, así que nada del usuario llega al HTML.
 * Lista espejo de los temas registrados en public/js/core/howto-*.js y de `ready` en slides-howto.js.
 */

'use strict';

const Joi = require('joi');

// Un tema por tipo de pregunta con animación y voz ya hechas (clave = question_type)
const HOWTO_TOPICS = ['word_search', 'quiz'];

// Obligatorio en las diapositivas 'howto'; en las demás se admite null, vacío o ausente
const slideHowToSchema = Joi.string()
    .when('slide_type', {
        is: 'howto',
        then: Joi.string().valid(...HOWTO_TOPICS).required(),
        otherwise: Joi.allow(null, '').optional()
    })
    .messages({ 'any.only': 'El tema de las instrucciones no existe' });

module.exports = { slideHowToSchema, HOWTO_TOPICS };
