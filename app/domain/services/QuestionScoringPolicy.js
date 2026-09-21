/**
 * @fileoverview Política de puntuación de una pregunta: qué punta y con qué base.
 *
 * Centraliza dos conceptos que antes estaban duplicados o dispersos:
 *
 *  1. `isScorable(question)` — ¿esta diapositiva/pregunta asigna puntos?
 *     Vivía duplicado en MaxScoreCalculator.js y AdvanceQuestionUseCase.js
 *     (ambas copias omitían el slide 'text-image', que sí existe en BD).
 *
 *  2. `usesRandomPoints(question, game)` — ¿esta pregunta usa la puntuación
 *     aleatoria configurada en el juego? Es la única puerta de entrada para la
 *     pantalla intermedia, la generación del valor, el cálculo de puntos y el
 *     máximo teórico.
 *
 * ARQUITECTURA: Domain Service (funciones puras, sin I/O).
 *
 * @module domain/services/QuestionScoringPolicy
 */

'use strict';

const { RANDOM_POINTS_ELIGIBLE_TYPES } = require('../../config/game-constants');

// Diapositivas sin temporizador ni puntuación. Los valores coinciden con el
// CHECK de slide_type en BD (migrations/20260321000001_add_text_image_slide_type.sql)
// y con las listas equivalentes del frontend.
const NO_TIMER_SLIDE_TYPES = new Set(['comment', 'info', 'text', 'image', 'text-image']);

const ELIGIBLE_TYPES = new Set(RANDOM_POINTS_ELIGIBLE_TYPES);

/**
 * ¿La pregunta asigna puntos?
 *
 * @param {Object} question
 * @returns {boolean}
 */
function isScorable(question) {
    if (!question) return false;
    if (NO_TIMER_SLIDE_TYPES.has(question.slide_type)) return false;
    if (question.question_type === 'survey') return false;
    return true;
}

/**
 * ¿La pregunta arranca temporizador?
 * Mismo criterio que la puntuación salvo por las encuestas, que sí cronometran.
 *
 * @param {Object} question
 * @returns {boolean}
 */
function hasTimer(question) {
    if (!question) return false;
    return !NO_TIMER_SLIDE_TYPES.has(question.slide_type);
}

/**
 * ¿Esta pregunta debe puntuar con el valor aleatorio del juego?
 *
 * Requiere las tres condiciones: el juego tiene la opción activada, la pregunta
 * punta, y su tipo es de los que puntúan "acierto/fallo + bonus de tiempo".
 *
 * @param {Object} question
 * @param {Object} game - Juego en memoria (activeGames)
 * @returns {boolean}
 */
function usesRandomPoints(question, game) {
    if (!game || !game.use_random_points) return false;
    if (!isScorable(question)) return false;
    return ELIGIBLE_TYPES.has(question.question_type);
}

/**
 * Puntos base a aplicar a esta pregunta, o `undefined` para que cada servicio
 * use su valor por defecto actual (BASE_POINTS / configuración de la pregunta).
 *
 * @param {Object} question
 * @param {Object} game
 * @returns {number|undefined}
 */
function resolveBasePoints(question, game) {
    if (!usesRandomPoints(question, game)) return undefined;

    const points = Number(game.currentRandomPoints);
    return Number.isFinite(points) && points > 0 ? points : undefined;
}

module.exports = {
    NO_TIMER_SLIDE_TYPES,
    RANDOM_POINTS_ELIGIBLE_TYPES,
    isScorable,
    hasTimer,
    usesRandomPoints,
    resolveBasePoints,
};
