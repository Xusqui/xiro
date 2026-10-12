/**
 * @fileoverview Identificador de la pregunta en curso para las claves de Redis que viven
 * mientras dura una pregunta (pistas, huecos del equipo, primer envío, estadísticas del
 * reveal de la sopa de letras y de Completa la frase).
 *
 * En bancos y personalizados basta `game.currentIndex`. En Trivial cada pregunta ocupa el
 * índice 0 y lo que distingue una ronda de otra es `trivialQuestionEpoch`: sin esto, las
 * pistas y los huecos de una ronda contaban en la siguiente. Mismo criterio que
 * `game:answered:<sala>:<epoch>` (TeamManager) y `teamRevealedKey` (TeamRevealHelper).
 */

'use strict';

/**
 * @param {Object} game - Partida en memoria (activeGames)
 * @returns {string|number} `t<epoch>` en Trivial, el índice de la pregunta en el resto
 */
function questionSlot(game) {
    if (game?.isTrivial) return `t${game.trivialQuestionEpoch || 0}`;
    return Number.isInteger(game?.currentIndex) ? game.currentIndex : 0;
}

module.exports = { questionSlot };
