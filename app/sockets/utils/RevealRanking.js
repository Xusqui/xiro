/**
 * @fileoverview Ranking que acompaña al reveal de una pregunta.
 * Extraído de GameEndManager.js para que la revisión de diapositivas
 * (ReviewRevealPayload) muestre el ranking de ahora con el mismo criterio.
 */

'use strict';

const { roundScore } = require('../../services/game.logic');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

/**
 * Leer el hash canónico de scores desde Redis (game:scores:{roomId}).
 * Este hash se actualiza atómicamente vía HINCRBYFLOAT en ImprovedSubmitAnswerCommand
 * y es la fuente de verdad en clúster PM2, ya que cada worker solo conoce en memoria
 * los nicknames cuyas respuestas ha procesado.
 */
async function loadCanonicalScores(roomId) {
    try {
        const client = await getRedisClient();
        const raw = await client.hGetAll(`game:scores:${roomId}`);
        if (!raw || Object.keys(raw).length === 0) return null;
        const parsed = {};
        for (const [nick, val] of Object.entries(raw)) {
            const num = Number(val);
            if (!Number.isNaN(num)) parsed[nick] = roundScore(num);
        }
        return parsed;
    } catch (err) {
        logger.warn('loadCanonicalScores failed', { roomId, error: err.message });
        return null;
    }
}

function buildRankings(game) {
    const rankingNicknames = [
        ...new Set([
            ...(game.players || []).filter(name => name && name !== 'HOST'),
            ...Object.keys(game.scores || {}).filter(name => name && name !== 'HOST')
        ])
    ];

    return rankingNicknames
        .map(nickname => ({
            nickname,
            score: game.scores?.[nickname] || 0,
            team: null
        }))
        .sort((a, b) => b.score - a.score);
}

function buildRankingFormatted(rankings) {
    return rankings.map(ranking => ({
        name: ranking.nickname,
        pts: ranking.score,
        team: ranking.team
    }));
}

module.exports = { loadCanonicalScores, buildRankings, buildRankingFormatted };
