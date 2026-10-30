/**
 * @fileoverview Parte del payload de 'reveal-answer' que depende del tipo de pregunta.
 * Extraído de GameEndManager.js: qué respuesta correcta ve el presentador y qué
 * subconjunto llega a los jugadores.
 */

'use strict';

const { buildWordSearchReveal } = require('./WordSearchRevealStats');
const { buildFillBlanksReveal } = require('./FillBlanksRevealStats');
const { buildSurveyMultipleReveal } = require('./SurveyMultipleRevealStats');
const { questionSlot } = require('./QuestionSlot');

function optionText(option) {
    return option?.text || option?.optionText || option?.option_text || '';
}

/** Sin índice/orden/parejas: los tipos que muestran su respuesta de otra forma. */
function clearOptionFields(presenterPayload) {
    presenterPayload.correctIndex = null;
    presenterPayload.correctOrder = null;
    presenterPayload.correctMatches = null;
}

/**
 * Lo que ven los jugadores al revelar: la respuesta correcta en el formato
 * de cada tipo (número, palabra, parejas, orden u opciones correctas).
 */
function buildPlayerRevealPayload(presenterPayload) {
    const wordSearch = presenterPayload.wordSearch;
    const fillBlanks = presenterPayload.fillBlanks;
    const surveyMultiple = presenterPayload.surveyMultiple;
    const surveySingle = presenterPayload.surveySingle;
    return {
        correctAnswer: presenterPayload.correctAnswer ?? null,
        justification: presenterPayload.justification ?? null,
        correctOrder: presenterPayload.correctOrder ?? null,
        correctMatches: presenterPayload.correctMatches ?? null,
        correctWord: presenterPayload.correctWord ?? null,
        correctOptionTexts: presenterPayload.correctOptionTexts ?? null,
        // Sopa de letras: tras revelar, el jugador ya puede ver dónde estaban las palabras
        ...(wordSearch ? { wordSearch: { words: wordSearch.words, placements: wordSearch.placements } } : {}),
        // Completa la frase: tras revelar, el jugador ve la frase completa (sin las estadísticas)
        ...(fillBlanks
            ? { fillBlanks: { text: fillBlanks.text, words: fillBlanks.words, lengths: fillBlanks.lengths } }
            : {}),
        // Encuestas: el jugador ve el porcentaje de cada opción
        ...(surveyMultiple ? { surveyMultiple } : {}),
        ...(surveySingle ? { surveySingle } : {})
    };
}

/**
 * Encuesta de respuesta única: los porcentajes (GameEndManager) con el texto de cada opción,
 * con la misma forma que surveyMultiple. Cada jugador vota una vez: suman 100 %.
 */
function buildSurveySingleReveal(question, percentages) {
    const options = (question.options || []).map((option, index) => ({
        text: optionText(option),
        count: percentages?.[index]?.count || 0,
        percentage: percentages?.[index]?.percentage || 0
    }));
    return { respondents: options.reduce((sum, option) => sum + option.count, 0), options };
}

/**
 * Ajusta el payload del presentador según el tipo de pregunta.
 * Async por la sopa de letras y Completa la frase (leen de Redis cuántos acertaron cada palabra/hueco).
 */
async function applyQuestionTypeOverrides({
    presenterPayload,
    question,
    flags,
    correctIndicesMultiple,
    roomId,
    revealIndex,
    game
}) {
    // Clave de las estadísticas por pregunta: en Trivial, por época (QuestionSlot)
    const slot = game ? questionSlot(game) : revealIndex;
    if (flags.isNumericQuestion) {
        presenterPayload.correctAnswer = question.correct_answer;
        presenterPayload.maxPoints = question.max_points;
        presenterPayload.toleranceMode = question.tolerance_mode;
        presenterPayload.toleranceValue = question.tolerance_value;
        presenterPayload.toleranceCap = question.tolerance_cap;
        clearOptionFields(presenterPayload);
    }

    if (flags.isWordScrambleQuestion) {
        presenterPayload.correctWord = question.correct_word || null;
        clearOptionFields(presenterPayload);
    }

    if (flags.isWordSearchQuestion) {
        presenterPayload.wordSearch = await buildWordSearchReveal(roomId, slot, question);
        presenterPayload.correctAnswer = (question.ws_words || []).join(', ');
        clearOptionFields(presenterPayload);
    }

    if (flags.isFillBlanksQuestion) {
        presenterPayload.fillBlanks = await buildFillBlanksReveal(roomId, slot, question);
        presenterPayload.correctAnswer = presenterPayload.fillBlanks.words.join(', ');
        clearOptionFields(presenterPayload);
    }

    if (flags.isSurveyQuestion) {
        presenterPayload.surveySingle = buildSurveySingleReveal(question, presenterPayload.percentages);
    }

    if (flags.isSurveyMultipleQuestion) {
        // Sin correcta: porcentaje de encuestados por opción (la suma puede pasar del 100 %)
        const surveyMultiple = await buildSurveyMultipleReveal(roomId, slot, question);
        presenterPayload.surveyMultiple = surveyMultiple;
        presenterPayload.percentages = surveyMultiple.options.map(({ count, percentage }) => ({ count, percentage }));
        presenterPayload.isSurvey = true;
        presenterPayload.justification = null;
        clearOptionFields(presenterPayload);
        presenterPayload.correctAnswer = null;
    }

    if (flags.isMultipleChoiceQuestion) {
        presenterPayload.correctIndices = correctIndicesMultiple;
        presenterPayload.correctOptionTexts = (correctIndicesMultiple || [])
            .map(idx => optionText(question.options?.[idx]))
            .filter(Boolean);
        clearOptionFields(presenterPayload);
        presenterPayload.correctAnswer = null;
    }
}

module.exports = {
    buildPlayerRevealPayload,
    applyQuestionTypeOverrides
};
