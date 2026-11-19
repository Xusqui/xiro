/**
 * @fileoverview Piezas comunes de los manejadores de respuesta: cuándo está abierta la
 * pregunta para un envío y la evaluación «acierto/fallo + bonus de tiempo» de ScoringService.
 * @module application/question-types/answer-handlers/shared
 */

'use strict';

const ScoringService = require('../../../domain/services/ScoringService');

/**
 * ¿Se admite el envío con la pregunta ya cerrada? En la última pregunta siempre; en los
 * tipos con lateAnswer, mientras dure el plazo extra (flags.allowLateAnswer).
 * @param {{lastQuestion: boolean, allowLateAnswer?: boolean}} flags
 * @returns {boolean}
 */
function allowWhenClosed(flags) {
    return Boolean(flags.lastQuestion || flags.allowLateAnswer);
}

/**
 * Validador de los tipos sin servicio de estado propio (respuesta escrita o marcada).
 * @param {(payload: Object) => boolean} isValidPayload
 * @returns {(input: {payload: Object, flags: Object}) => {valid: boolean, reason: string|null}}
 */
function freeInputValidator(isValidPayload) {
    return ({ payload, flags }) => {
        if (!flags.canAnswerOrEnded && !allowWhenClosed(flags)) return { valid: false, reason: 'game-closed' };
        if (!isValidPayload(payload)) return { valid: false, reason: 'invalid-payload' };
        return { valid: true, reason: null };
    };
}

/**
 * Segundos desde el inicio canónico de la pregunta, o undefined si no se conoce.
 * @param {{resolvedStartTime?: number}} ctx
 * @returns {number|undefined}
 */
function elapsedSeconds(ctx) {
    return ctx.resolvedStartTime ? (Date.now() - Number(ctx.resolvedStartTime)) / 1000 : undefined;
}

/**
 * Evaluación de ScoringService (quiz, encuesta y numérica).
 * @param {Object} ctx - Contexto de evaluación del flujo submit-answer
 * @param {number|undefined} playerAnswer - Respuesta escrita (solo la numérica)
 * @returns {Object} Resultado de ScoringService.processAnswer
 */
function scoreWithScoringService(ctx, playerAnswer) {
    return ScoringService.processAnswer({
        question: ctx.currentQuestion,
        answerIndex: ctx.payload.index,
        playerAnswer,
        gameStartTime: ctx.resolvedStartTime,
        currentTime: Date.now(),
        game: ctx.game || {},
        basePoints: ctx.basePoints
    });
}

module.exports = { allowWhenClosed, freeInputValidator, elapsedSeconds, scoreWithScoringService };
