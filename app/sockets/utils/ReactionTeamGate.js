/**
 * @fileoverview Reacciones con emoji en modo equipos: ¿el equipo del jugador ya ha
 * respondido entero la pregunta en juego? Lo dice el registro compartido de equipos
 * revelados (TeamRevealHelper), así que vale en cualquier worker. Solo consulta Redis
 * cuando importa: pregunta en juego y jugador de equipo.
 */

'use strict';

const { isQuestionOpen } = require('../../domain/services/ReactionPolicy');
const { isTeamRevealedAnywhere } = require('./TeamRevealHelper');

/**
 * @param {Object} params
 * @param {Object|null} params.game
 * @param {Object|null} params.player
 * @param {string} params.roomId
 * @returns {Promise<boolean>}
 */
async function resolveTeamDone({ game, player, roomId }) {
    if (!player?.teamName || !isQuestionOpen(game)) return false;
    return Boolean(await isTeamRevealedAnywhere(game, roomId, player.teamName));
}

module.exports = { resolveTeamDone };
