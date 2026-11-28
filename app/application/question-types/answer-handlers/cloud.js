/**
 * @fileoverview Manejador de la nube de palabras (word_cloud): encuesta de texto libre, con todas
 * las palabras del jugador en un envío. No puntúa ni admite el envío tras el cierre. El cupo por jugador y los
 * repetidos se controlan aparte, de forma atómica en Redis.
 * @module application/question-types/answer-handlers/cloud
 */

'use strict';

const {
    validateWordCloudBatch,
    processWordCloudAnswer
} = require('../../../domain/services/WordCloudAnswerService');
const { allowWhenClosed } = require('./shared');

const wordCloud = Object.freeze({
    lateAnswer: false,
    validate: ({ payload, question, flags }) =>
        validateWordCloudBatch({
            question,
            words: payload.words,
            gameCanAnswer: flags.canAnswerOrEnded,
            allowWhenClosed: allowWhenClosed(flags)
        }),
    // El envío real va por wordCloudSubmit; aquí solo se resume la primera palabra
    evaluate: (ctx) => processWordCloudAnswer({ word: (ctx.payload.words || [])[0] })
});

module.exports = { word_cloud: wordCloud };
