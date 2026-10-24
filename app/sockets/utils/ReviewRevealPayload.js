/**
 * @fileoverview Payload 'reveal-answer' del presentador al revisar una pregunta ya
 * revelada de un juego personalizado: votos, solución y justificación de cuando se
 * reveló, con el ranking (y las puntuaciones de equipo) de ahora.
 */

'use strict';

const { findRevealPayload } = require('./RevealPayloadStore');
const { loadCanonicalScores, buildRankings, buildRankingFormatted } = require('./RevealRanking');
const { addTeamScoresToPayload } = require('./TeamManager');
const { canGoBack } = require('../../domain/services/SlideNavigationPolicy');
const logger = require('../../config/logger');

/**
 * @param {Object} params
 * @param {string} params.roomId
 * @param {Object} params.game - Partida en memoria (activeGames)
 * @param {number} params.index - Pregunta revisada
 * @param {Object} [params.teamConfig]
 * @returns {Promise<Object|null>} null si no hay reveal guardado de esa pregunta
 */
async function buildReviewRevealPayload({ roomId, game, index, teamConfig }) {
    const stored = await findRevealPayload(roomId, game, index);
    if (!stored) return null;

    const canonicalScores = await loadCanonicalScores(roomId);
    if (canonicalScores) {
        game.scores = { ...(game.scores || {}), ...canonicalScores };
    }

    const payload = {
        ...stored,
        ranking: buildRankingFormatted(buildRankings(game)),
        review: true,
        canGoBack: canGoBack(game)
    };

    if (teamConfig?.isTeamMode) {
        try {
            addTeamScoresToPayload(payload, teamConfig, game.scores || {});
        } catch (err) {
            logger.error('Error en addTeamScoresToPayload (revisión):', err.message);
        }
    }

    return payload;
}

module.exports = { buildReviewRevealPayload };
