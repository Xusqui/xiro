/**
 * @fileoverview Servicio de dominio para preguntas tipo fill_blanks («Completa la frase»).
 * Preparación de la pregunta, pistas y cálculo de puntuación.
 *
 * ARQUITECTURA: Domain Service (Clean Architecture)
 * - Funciones puras y testeables, sin dependencias de infraestructura
 *
 * Modelo: el enunciado lleva marcadores {{1}}..{{3}} y las palabras viven en
 * options[].option_text (orden = order_index). Al preparar la partida se añaden
 * fb_words (solución, NUNCA viaja al jugador) y fb_lengths (sí viaja).
 *
 * Puntuación (reglas acordadas con el usuario):
 * - Cada palabra acertada vale `basePoints` (BASE_POINTS o la puntuación aleatoria
 *   de la pregunta) multiplicado por el factor de pistas (1, 0.7, 0.4, 0.25).
 * - Un único bonus de tiempo por pregunta (hasta MAX_TIME_BONUS) si acierta al
 *   menos una palabra; las pistas no lo reducen.
 * - La pregunta cuenta como acierto (contador y racha) con la mitad o más de los
 *   huecos: 1 de 1, 1 de 2, 2 de 3.
 */

'use strict';

const { SCORING } = require('../../config/game-constants');
const FB = require('../../public/js/core/fill-blanks-text.js');

const { LIMITS } = FB;

function round2(value) {
    return Math.round(value * 100) / 100;
}

function toIndexSet(list) {
    return new Set((Array.isArray(list) ? list : []).map(Number).filter(Number.isInteger));
}

function clampHints(count) {
    const n = Math.trunc(Number(count));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(LIMITS.MAX_HINTS_PER_BLANK, n);
}

/** Palabras normalizadas de la pregunta (preparada o tal cual sale del banco) */
function getQuestionWords(question) {
    if (Array.isArray(question?.fb_words)) return question.fb_words;
    return FB.wordsFromOptions(question?.options);
}

/**
 * Prepara una pregunta fill_blanks para jugarla: opciones por order_index,
 * palabras normalizadas (fb_words) y longitudes (fb_lengths). `fb_valid` avisa de
 * bancos antiguos o importados a mano con huecos y palabras que no cuadran.
 * @param {Object} question
 * @returns {Object}
 */
function prepareFillBlanksQuestion(question) {
    const options = [...(question?.options || [])].sort(
        (a, b) => (a.order_index ?? a.orderIndex ?? 0) - (b.order_index ?? b.orderIndex ?? 0)
    );
    const words = FB.wordsFromOptions(options);
    const valid =
        words.length > 0 &&
        words.every(word => FB.wordError(word) === null) &&
        FB.countBlanks(question?.question_text) === words.length;
    return {
        ...question,
        options,
        fb_words: words,
        fb_lengths: words.map(word => word.length),
        fb_valid: valid
    };
}

/**
 * ¿La palabra dada resuelve el hueco `blankIndex`? Ignora mayúsculas y tildes.
 * @param {Object} question
 * @param {number} blankIndex
 * @param {string} word
 * @returns {boolean}
 */
function isBlankCorrect(question, blankIndex, word) {
    const expected = getQuestionWords(question)[blankIndex];
    return Boolean(expected) && FB.normalizeWord(word) === expected;
}

/**
 * Letra que destapa la pista número `hintCount` (0, 1 o 2) del hueco, o null si
 * no quedan pistas o el hueco no existe.
 * @returns {{ position: number, letter: string }|null}
 */
function getHintLetter(question, blankIndex, hintCount) {
    const word = getQuestionWords(question)[blankIndex];
    const n = Number(hintCount);
    if (!word || !Number.isInteger(n) || n < 0 || n >= LIMITS.MAX_HINTS_PER_BLANK) return null;
    const positions = FB.hintPositions(word.length);
    if (n >= positions.length) return null;
    return { position: positions[n], letter: word.charAt(positions[n]) };
}

/** Bonus de tiempo único de la pregunta: MAX_TIME_BONUS × fracción de tiempo restante */
function fillBlanksTimeBonus(timeElapsed, questionTimeLimit) {
    if (!(questionTimeLimit > 0) || !Number.isFinite(timeElapsed)) return 0;
    const timeLeftRatio = Math.max(0, questionTimeLimit - Math.max(0, timeElapsed)) / questionTimeLimit;
    return round2(SCORING.MAX_TIME_BONUS * timeLeftRatio);
}

/** Acierto de la pregunta: la mitad de los huecos o más (1/1, 1/2, 2/3) */
function meetsThreshold(correctCount, totalBlanks) {
    return totalBlanks > 0 && correctCount * 2 >= totalBlanks;
}

/**
 * Evalúa la respuesta de un jugador.
 * @param {Object} params
 * @param {Object} params.question - Pregunta (preparada o no)
 * @param {string[]} params.words - Palabra escrita en cada hueco ('' = vacío)
 * @param {number[]} [params.hintCounts] - Pistas usadas por hueco (del jugador o de su equipo)
 * @param {number[]} [params.sharedSolved] - Huecos ya resueltos por el equipo (validados en servidor)
 * @param {number} [params.timeElapsed] - Segundos desde que empezó la pregunta
 * @param {number} [params.questionTimeLimit]
 * @param {number} [params.basePoints] - Puntos por palabra (aleatorios si procede); por defecto BASE_POINTS
 * @returns {{ isCorrect: boolean, pointsEarned: number, isSurvey: false, details: Object }}
 */
function processFillBlanksAnswer({
    question,
    words,
    hintCounts = [],
    sharedSolved = [],
    timeElapsed,
    questionTimeLimit,
    basePoints
}) {
    const expected = getQuestionWords(question);
    const perWord = Number(basePoints) > 0 ? Number(basePoints) : SCORING.BASE_POINTS;
    const shared = toIndexSet(sharedSolved);
    const given = expected.map((_, i) => FB.normalizeWord(Array.isArray(words) ? words[i] : ''));
    const blanksCorrect = expected.map((word, i) => Boolean(word) && (shared.has(i) || given[i] === word));
    const hints = expected.map((_, i) => clampHints(hintCounts[i]));
    const wordPoints = blanksCorrect.map((ok, i) => (ok ? round2(perWord * FB.hintFactor(hints[i])) : 0));
    const base = round2(wordPoints.reduce((sum, points) => sum + points, 0));
    const correctCount = blanksCorrect.filter(Boolean).length;
    const timeBonus = correctCount > 0 ? fillBlanksTimeBonus(timeElapsed, questionTimeLimit) : 0;

    return {
        isCorrect: meetsThreshold(correctCount, expected.length),
        pointsEarned: round2(base + timeBonus),
        isSurvey: false,
        details: {
            strategy: 'fill_blanks',
            basePoints: base,
            pointsPerWord: perWord,
            timeBonus,
            correctCount,
            totalBlanks: expected.length,
            words: expected,
            given,
            blanksCorrect,
            hintCounts: hints,
            wordPoints,
            lengths: expected.map(word => word.length)
        }
    };
}

module.exports = {
    LIMITS,
    getQuestionWords,
    prepareFillBlanksQuestion,
    isBlankCorrect,
    getHintLetter,
    fillBlanksTimeBonus,
    meetsThreshold,
    processFillBlanksAnswer
};
