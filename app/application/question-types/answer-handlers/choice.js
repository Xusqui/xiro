/**
 * @fileoverview Manejadores de los tipos de elegir opción: quiz y encuesta (un índice),
 * selección múltiple y encuesta de selección múltiple (varios índices).
 * @module application/question-types/answer-handlers/choice
 */

'use strict';

const AnswerStateService = require('../../../domain/services/AnswerStateService');
const MultipleChoiceAnswerStateService = require('../../../domain/services/MultipleChoiceAnswerStateService');
const MultipleChoiceAnswerService = require('../../../domain/services/MultipleChoiceAnswerService');
const {
    validateSurveyMultipleAnswer,
    processSurveyMultipleAnswer
} = require('../../../domain/services/SurveyMultipleAnswerService');
const { allowWhenClosed, scoreWithScoringService } = require('./shared');

// Quiz y encuesta simple: la encuesta no puntúa porque la pregunta no tiene correcta
const singleChoice = Object.freeze({
    lateAnswer: false,
    validate: ({ payload, question, flags }) =>
        AnswerStateService.validateAnswer({
            question,
            answerIndex: payload.index,
            gameCanAnswer: flags.canAnswerOrEnded,
            allowWhenClosed: allowWhenClosed(flags)
        }),
    evaluate: (ctx) => scoreWithScoringService(ctx, undefined)
});

const multipleChoice = Object.freeze({
    lateAnswer: false,
    validate: ({ payload, question, flags }) =>
        MultipleChoiceAnswerStateService.validateMultipleChoiceAnswer({
            question,
            selectedIndices: payload.selectedIndices,
            gameCanAnswer: flags.canAnswerOrEnded,
            allowWhenClosed: allowWhenClosed(flags)
        }),
    evaluate: (ctx) =>
        MultipleChoiceAnswerService.processMultipleChoiceAnswer({
            question: ctx.currentQuestion,
            selectedIndices: ctx.payload.selectedIndices,
            gameStartTime: ctx.resolvedStartTime,
            currentTime: Date.now()
        })
});

const surveyMultiple = Object.freeze({
    lateAnswer: false,
    validate: ({ payload, question, flags }) =>
        validateSurveyMultipleAnswer({
            question,
            selectedIndices: payload.selectedIndices,
            gameCanAnswer: flags.canAnswerOrEnded,
            allowWhenClosed: allowWhenClosed(flags)
        }),
    evaluate: (ctx) => processSurveyMultipleAnswer({ selectedIndices: ctx.payload.selectedIndices })
});

module.exports = {
    quiz: singleChoice,
    survey: singleChoice,
    multiple_choice: multipleChoice,
    survey_multiple: surveyMultiple
};
