/**
 * @fileoverview Efectos del envío que solo tienen algunos tipos de pregunta: contexto de
 * puntuación compartido (pistas y equipo) y recuentos que se muestran al revelar.
 * Los tipos sin entrada en estos mapas no tienen ese efecto.
 * @module application/commands/submit-answer/questionTypeEffects
 */

'use strict';

const { recordWordSearchStats } = require('../../../sockets/utils/WordSearchRevealStats');
const { getWordSearchScoringContext } = require('../../../sockets/utils/WordSearchTeam');
const { recordFillBlanksStats } = require('../../../sockets/utils/FillBlanksRevealStats');
const { getFillBlanksScoringContext, emitToTeammates } = require('../../../sockets/utils/FillBlanksTeam');
const { recordSurveyMultipleStats } = require('../../../sockets/utils/SurveyMultipleRevealStats');
const { questionSlot } = require('../../../sockets/utils/QuestionSlot');

/**
 * Avisa a los compañeros de equipo del primer envío de Completa la frase.
 * @param {{io: Object, sPin: string, nickname: string, shared: Object, words: string[]}} input
 * @returns {void}
 */
function notifyTeamFirstSubmit({ io, sPin, nickname, shared, words }) {
    if (!shared?.teamToNotify || !io) return;
    emitToTeammates({ io, roomId: sPin, team: shared.teamToNotify, nickname }, 'fill-blanks-team-submitted', {
        by: nickname,
        words: Array.isArray(words) ? words : []
    });
}

// Contexto de puntuación compartido que solo necesitan algunos tipos (pistas y equipo)
const SCORING_CONTEXT_LOADERS = Object.freeze({
    // Sopa de letras: pistas (valen la mitad) y, en equipos, palabras del equipo
    word_search: ({ game, sPin, nickname }) =>
        getWordSearchScoringContext(sPin, questionSlot(game), nickname, game).then(wordSearchShared => ({
            wordSearchShared
        })),
    // Completa la frase: pistas, huecos del equipo y el tiempo del primer envío del equipo
    fill_blanks: ({ flags, game, sPin, nickname, payload, resolvedStartTime }) =>
        getFillBlanksScoringContext({
            sPin,
            questionIndex: questionSlot(game),
            nickname,
            game,
            totalBlanks: (flags.currentQuestion.fb_words || flags.currentQuestion.options || []).length,
            elapsed: resolvedStartTime ? (Date.now() - Number(resolvedStartTime)) / 1000 : undefined,
            words: payload.words
        }).then(fillBlanksShared => ({ fillBlanksShared }))
});

// Recuentos por tipo que se muestran al revelar
const QUESTION_TYPE_STATS = Object.freeze({
    // Sopa de letras: cuántos encontraron cada palabra
    word_search: ({ game, sPin, answerResult }) => recordWordSearchStats(sPin, questionSlot(game), answerResult.details),
    // Completa la frase: cuántos acertaron cada hueco, y aviso al equipo
    fill_blanks: async ({ game, sPin, io, nickname, payload, answerResult, fillBlanksShared }) => {
        await recordFillBlanksStats(sPin, questionSlot(game), answerResult.details);
        notifyTeamFirstSubmit({ io, sPin, nickname, shared: fillBlanksShared, words: payload.words });
    },
    // Encuesta de selección múltiple: encuestados y votos por opción
    survey_multiple: ({ game, sPin, answerResult }) =>
        recordSurveyMultipleStats(sPin, questionSlot(game), answerResult.selectedIndices)
});

const ownEntry = (table, key) => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null);

/**
 * Carga el contexto de puntuación compartido del tipo (sopa de letras y completa la frase).
 * @param {Object} ctx - Contexto del flujo submit-answer (flags.questionType decide)
 * @returns {Promise<{wordSearchShared: Object, fillBlanksShared: Object}>}
 */
async function loadWordScoringContexts(ctx) {
    const loader = ownEntry(SCORING_CONTEXT_LOADERS, ctx.flags.questionType);
    const loaded = loader ? await loader(ctx) : {};
    return { wordSearchShared: loaded.wordSearchShared || {}, fillBlanksShared: loaded.fillBlanksShared || {} };
}

/**
 * Registra los recuentos del tipo que se muestran al revelar.
 * @param {Object} ctx - Contexto del flujo con answerResult
 * @returns {Promise<void>}
 */
async function recordQuestionTypeStats(ctx) {
    const record = ownEntry(QUESTION_TYPE_STATS, ctx.flags.questionType);
    if (record) await record(ctx);
}

module.exports = { notifyTeamFirstSubmit, loadWordScoringContexts, recordQuestionTypeStats };
