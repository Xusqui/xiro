/**
 * @fileoverview Manejadores de los tipos de colocar elementos: ordena y emparejar.
 * Admiten el envío automático que llega justo después del cierre (lateAnswer).
 * @module application/question-types/answer-handlers/arranged
 */

'use strict';

const OrderAnswerStateService = require('../../../domain/services/OrderAnswerStateService');
const MatchingAnswerStateService = require('../../../domain/services/MatchingAnswerStateService');
const OrderAnswerService = require('../../../domain/services/OrderAnswerService');
const MatchingAnswerService = require('../../../domain/services/MatchingAnswerService');
const { allowWhenClosed } = require('./shared');

const order = Object.freeze({
    lateAnswer: true,
    streakAction: ({ details }) => OrderAnswerService.getOrderStreakAction(details.correctCount, details.totalOptions),
    validate: ({ payload, question, flags }) =>
        OrderAnswerStateService.validateOrderAnswer({
            question,
            order: payload.order,
            gameCanAnswer: flags.canAnswerOrEnded,
            allowWhenClosed: allowWhenClosed(flags)
        }),
    evaluate: (ctx) => OrderAnswerService.processOrderAnswer({ question: ctx.currentQuestion, order: ctx.payload.order })
});

const matching = Object.freeze({
    lateAnswer: true,
    streakAction: ({ details }) => MatchingAnswerService.getMatchingStreakAction(details.correctCount, details.totalPairs),
    validate: ({ payload, question, flags }) =>
        MatchingAnswerStateService.validateMatchingAnswer({
            question,
            matches: payload.matches,
            gameCanAnswer: flags.canAnswerOrEnded,
            allowWhenClosed: allowWhenClosed(flags)
        }),
    evaluate: (ctx) =>
        MatchingAnswerService.processMatchingAnswer({ question: ctx.currentQuestion, matches: ctx.payload.matches })
});

module.exports = { order, matching };
