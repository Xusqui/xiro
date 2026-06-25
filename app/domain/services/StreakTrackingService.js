/**
 * @fileoverview Servicio de seguimiento de rachas por jugador
 * Actualiza y devuelve el estado de racha de un jugador en tiempo real.
 *
 * ARQUITECTURA: Domain Service puro (sin dependencias de infraestructura)
 * - Efectos de lado controlados: mutación de game.playerStreaks y game.playerStreakInfos
 * - Funciones puras testables: computeNewStreak, buildStreakInfo
 */

'use strict';

const runtimeConfig = require('../../config/runtime-config');
const { SCORING } = require('../../config/game-constants');

/**
 * Devuelve el umbral de racha configurado para un juego.
 * Prioridad: game.streak_threshold → runtimeConfig → constante por defecto
 */
function getThreshold(game) {
    return (game && game.streak_threshold)
        || runtimeConfig.get('STREAK_THRESHOLD')
        || SCORING.STREAK.DEFAULT_THRESHOLD;
}

/**
 * Calcula el nuevo valor de racha tras una respuesta.
 * @param {number}       currentStreak - Racha actual del jugador
 * @param {boolean|null} isCorrect     - true=correcta, false=incorrecta, null=sin cambio
 * @returns {number} Nueva racha
 */
function computeNewStreak(currentStreak, isCorrect) {
    if (isCorrect === true) return Math.min(currentStreak + 1, SCORING.STREAK.MAX_STREAK);
    if (isCorrect === false) return 0;
    return currentStreak;
}

/**
 * Construye el objeto de información de racha.
 * @param {number} prevStreak  - Racha antes de esta respuesta
 * @param {number} newStreak   - Racha después de esta respuesta
 * @param {number} threshold   - Umbral de activación de racha
 * @returns {Object} streakInfo
 */
function buildStreakInfo(prevStreak, newStreak, threshold) {
    return {
        current: newStreak,
        previous: prevStreak,
        threshold,
        isInStreak: newStreak >= threshold,
        justEntered: prevStreak < threshold && newStreak >= threshold,
        justLost: prevStreak >= threshold && newStreak === 0
    };
}

/**
 * Procesa la racha de un jugador tras responder una pregunta.
 * Actualiza game.playerStreaks y game.playerStreakInfos (side-effects sobre game).
 *
 * @param {Object}       params
 * @param {Object}       params.game      - Estado del juego (se muta)
 * @param {string}       params.nickname  - Nickname del jugador
 * @param {boolean|null} params.isCorrect - Resultado de la respuesta
 * @param {boolean}      params.isTracked - Si false, no cambia la racha (survey, order)
 * @returns {Object} streakInfo: { current, previous, threshold, isInStreak, justEntered, justLost }
 */
function processPlayerStreak({ game, nickname, isCorrect, isTracked = true }) {
    const threshold = getThreshold(game);

    if (!game.playerStreaks) game.playerStreaks = {};
    if (!game.playerStreakInfos) game.playerStreakInfos = {};

    const prevStreak = game.playerStreaks[nickname] || 0;
    const newStreak = isTracked ? computeNewStreak(prevStreak, isCorrect) : prevStreak;

    if (isTracked) {
        game.playerStreaks[nickname] = newStreak;
    }

    const info = buildStreakInfo(prevStreak, newStreak, threshold);
    game.playerStreakInfos[nickname] = info;

    return info;
}

module.exports = {
    processPlayerStreak,
    getThreshold,
    computeNewStreak,
    buildStreakInfo
};
