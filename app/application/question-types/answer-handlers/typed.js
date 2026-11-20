/**
 * @fileoverview Manejadores de los tipos de respuesta escrita o marcada: numérica,
 * anagrama, sopa de letras, completa la frase y toca la imagen. Sopa y frase admiten el envío
 * automático justo después del cierre (lateAnswer); en equipos llega entonces.
 * @module application/question-types/answer-handlers/typed
 */

'use strict';

const { processWordScrambleAnswer } = require('../../../domain/services/WordScrambleService');
const { processWordSearchAnswer, getWordSearchStreakAction } = require('../../../domain/services/WordSearchService');
const { getNumericStreakAction } = require('../../../domain/services/NumericAnswerService');
const { processFillBlanksAnswer } = require('../../../domain/services/FillBlanksService');
const { processHotspotAnswer } = require('../../../domain/services/HotspotAnswerService');
const { isValidFoundPayload } = require('../../validators/WordSearchQuestionValidator');
const { isValidWordsPayload } = require('../../validators/FillBlanksQuestionValidator');
const { isValidTapPayload } = require('../../validators/HotspotQuestionValidator');
const { freeInputValidator, elapsedSeconds, scoreWithScoringService } = require('./shared');

const numeric = Object.freeze({
    lateAnswer: false,
    // Exacta sube la racha, aproximada con puntos la mantiene y sin puntos la rompe
    streakAction: getNumericStreakAction,
    validate: freeInputValidator((payload) => Number.isFinite(Number(payload.playerAnswer))),
    evaluate: (ctx) => scoreWithScoringService(ctx, Number(ctx.payload.playerAnswer))
});

const wordScramble = Object.freeze({
    lateAnswer: false,
    validate: freeInputValidator(
        (payload) => typeof payload.playerAnswer === 'string' && payload.playerAnswer.trim().length > 0
    ),
    evaluate: (ctx) =>
        processWordScrambleAnswer({
            correctWord: ctx.currentQuestion.correct_word || '',
            playerAnswer: String(ctx.payload.playerAnswer),
            gameStartTime: ctx.resolvedStartTime,
            currentTime: Date.now(),
            questionTimeLimit: ctx.questionTimeLimit,
            basePoints: ctx.basePoints
        })
});

const wordSearch = Object.freeze({
    lateAnswer: true,
    streakAction: ({ details }) => getWordSearchStreakAction(details.foundCount, details.totalWords),
    validate: freeInputValidator((payload) => isValidFoundPayload(payload.found)),
    evaluate: (ctx) =>
        processWordSearchAnswer({
            question: ctx.currentQuestion,
            found: ctx.payload.found,
            hintedWords: ctx.hintedWords,
            sharedFound: ctx.sharedFound,
            timeElapsed: elapsedSeconds(ctx),
            questionTimeLimit: ctx.questionTimeLimit
        })
});

const fillBlanks = Object.freeze({
    lateAnswer: true,
    validate: freeInputValidator((payload) => isValidWordsPayload(payload.words)),
    // En equipos manda el tiempo del primer envío del equipo (mismo bonus para todos)
    evaluate: (ctx) =>
        processFillBlanksAnswer({
            question: ctx.currentQuestion,
            words: ctx.payload.words,
            hintCounts: ctx.hintCounts,
            sharedSolved: ctx.sharedSolved,
            timeElapsed: ctx.timeElapsedOverride ?? elapsedSeconds(ctx),
            questionTimeLimit: ctx.questionTimeLimit,
            basePoints: ctx.basePoints
        })
});

const hotspot = Object.freeze({
    lateAnswer: false,
    // Puntúa por cercanía como la numérica: dentro sube la racha, con puntos la mantiene
    streakAction: getNumericStreakAction,
    validate: freeInputValidator((payload) => isValidTapPayload(payload.tap)),
    evaluate: (ctx) => processHotspotAnswer({ question: ctx.currentQuestion, playerAnswer: ctx.payload.tap })
});

module.exports = {
    numeric_approximation: numeric,
    word_scramble: wordScramble,
    word_search: wordSearch,
    fill_blanks: fillBlanks,
    hotspot
};
