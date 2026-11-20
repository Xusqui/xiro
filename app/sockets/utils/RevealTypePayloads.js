/**
 * @fileoverview Parte del payload de 'reveal-answer' que depende del tipo de pregunta.
 * Extraído de GameEndManager.js: qué respuesta correcta ve el presentador y qué
 * subconjunto llega a los jugadores.
 */

'use strict';

const { buildWordSearchReveal } = require('./WordSearchRevealStats');
const { buildFillBlanksReveal } = require('./FillBlanksRevealStats');
const { buildSurveyMultipleReveal } = require('./SurveyMultipleRevealStats');
const { buildHotspotReveal } = require('./HotspotRevealStats');
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
    const hotspot = presenterPayload.hotspot;
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
        ...(surveySingle ? { surveySingle } : {}),
        // Toca la imagen: el área correcta; su propio toque ya lo tiene cada jugador
        ...(hotspot ? { hotspot: { area: hotspot.area } } : {})
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

function applyNumericReveal(presenterPayload, question) {
    presenterPayload.correctAnswer = question.correct_answer;
    presenterPayload.maxPoints = question.max_points;
    presenterPayload.toleranceMode = question.tolerance_mode;
    presenterPayload.toleranceValue = question.tolerance_value;
    presenterPayload.toleranceCap = question.tolerance_cap;
    clearOptionFields(presenterPayload);
}

function applyMultipleChoiceReveal(presenterPayload, question, correctIndicesMultiple) {
    presenterPayload.correctIndices = correctIndicesMultiple;
    presenterPayload.correctOptionTexts = (correctIndicesMultiple || [])
        .map(idx => optionText(question.options?.[idx]))
        .filter(Boolean);
    clearOptionFields(presenterPayload);
    presenterPayload.correctAnswer = null;
}

function applyWordScrambleReveal({ presenterPayload, question }) {
    presenterPayload.correctWord = question.correct_word || null;
    clearOptionFields(presenterPayload);
}

async function applyWordSearchReveal({ presenterPayload, question, roomId, slot }) {
    presenterPayload.wordSearch = await buildWordSearchReveal(roomId, slot, question);
    presenterPayload.correctAnswer = (question.ws_words || []).join(', ');
    clearOptionFields(presenterPayload);
}

async function applyFillBlanksReveal({ presenterPayload, question, roomId, slot }) {
    presenterPayload.fillBlanks = await buildFillBlanksReveal(roomId, slot, question);
    presenterPayload.correctAnswer = presenterPayload.fillBlanks.words.join(', ');
    clearOptionFields(presenterPayload);
}

// Sin correcta: porcentaje de encuestados por opción (la suma puede pasar del 100 %)
async function applySurveyMultipleReveal({ presenterPayload, question, roomId, slot }) {
    const surveyMultiple = await buildSurveyMultipleReveal(roomId, slot, question);
    presenterPayload.surveyMultiple = surveyMultiple;
    presenterPayload.percentages = surveyMultiple.options.map(({ count, percentage }) => ({ count, percentage }));
    presenterPayload.isSurvey = true;
    presenterPayload.justification = null;
    clearOptionFields(presenterPayload);
    presenterPayload.correctAnswer = null;
}

// Toca la imagen: área, crédito y toques de todos (anónimos) para el presentador y la TV
async function applyHotspotReveal({ presenterPayload, question, roomId, slot }) {
    presenterPayload.hotspot = await buildHotspotReveal(roomId, slot, question);
    presenterPayload.maxPoints = question.max_points;
    presenterPayload.correctAnswer = null;
    clearOptionFields(presenterPayload);
}

// Ajustes del payload del presentador por tipo; quiz, ordenar y emparejar no tienen
const TYPE_OVERRIDES = Object.freeze({
    numeric_approximation: ({ presenterPayload, question }) => applyNumericReveal(presenterPayload, question),
    word_scramble: applyWordScrambleReveal,
    word_search: applyWordSearchReveal,
    fill_blanks: applyFillBlanksReveal,
    survey: ({ presenterPayload, question }) => {
        presenterPayload.surveySingle = buildSurveySingleReveal(question, presenterPayload.percentages);
    },
    survey_multiple: applySurveyMultipleReveal,
    hotspot: applyHotspotReveal,
    multiple_choice: ({ presenterPayload, question, correctIndicesMultiple }) =>
        applyMultipleChoiceReveal(presenterPayload, question, correctIndicesMultiple)
});

/**
 * Ajusta el payload del presentador según el tipo de pregunta.
 * Async por la sopa de letras, Completa la frase, la encuesta múltiple y Toca la imagen (leen recuentos de Redis).
 * @param {Object} input
 * @param {Object} input.presenterPayload - Payload que se modifica
 * @param {Object} input.question - Pregunta revelada
 * @param {number[]|null} [input.correctIndicesMultiple] - Correctas de la selección múltiple
 * @param {string} input.roomId - Sala
 * @param {number} input.revealIndex - Índice revelado (sin partida)
 * @param {Object} [input.game] - Partida (en Trivial, la clave es la época)
 * @returns {Promise<void>}
 */
async function applyQuestionTypeOverrides({ presenterPayload, question, correctIndicesMultiple, roomId, revealIndex, game }) {
    const type = question?.question_type;
    if (!Object.prototype.hasOwnProperty.call(TYPE_OVERRIDES, type)) return;
    // Clave de las estadísticas por pregunta: en Trivial, por época (QuestionSlot)
    const slot = game ? questionSlot(game) : revealIndex;
    await TYPE_OVERRIDES[type]({ presenterPayload, question, correctIndicesMultiple, roomId, slot });
}

module.exports = {
    buildPlayerRevealPayload,
    applyQuestionTypeOverrides
};
