/**
 * @fileoverview Ranking Calculator - Cálculo de rankings finales
 * @module sockets/utils/RankingCalculator
 * 
 * Separado de GameEndManager para evitar dependencias circulares
 */

const { roundScore } = require('../../services/game.logic');
const { calculateTeamScore } = require('../../services/game.logic');
const runtimeConfig = require('../../config/runtime-config');
const logger = require('../../config/logger');

/**
 * Calculate final ranking for game end
 * @param {Object} game - Game object with scores
 * @param {Object} teamConfig - Team configuration (optional)
 * @returns {Array} Sorted ranking array
 */
function calculateFinalRanking(game, teamConfig) {
    const isTeamMode = teamConfig && teamConfig.isTeamMode;
    let ranking;

    const debugEnabled = typeof logger.isDebugEnabled !== 'function' || logger.isDebugEnabled();

    if (debugEnabled) {
        logger.debug('[DEBUG] calculateFinalRanking - Input:', {
            isTeamMode,
            gameScores: game.scores,
            scoresKeys: Object.keys(game.scores || {}),
            scoresValues: Object.values(game.scores || {}),
            teamConfigTeams: teamConfig?.teams?.map(t => ({ name: t.name, players: t.players }))
        });
    }

    if (isTeamMode) {
        // Team ranking with adaptive formula
        const allScores = Object.values(game.scores);
        const totalPoints = allScores.reduce((sum, pts) => sum + pts, 0);
        const totalPlayers = allScores.length;
        const globalMean = totalPlayers > 0 ? totalPoints / totalPlayers : 0;

        if (debugEnabled) {
            logger.debug('[DEBUG] Team scoring calculation:', {
                allScores,
                totalPoints,
                totalPlayers,
                globalMean
            });
        }

        const teamSizes = teamConfig.teams.map(t => t.players.length);
        const minSize = Math.min(...teamSizes);
        const maxSize = Math.max(...teamSizes);
        const sizeRatio = maxSize / minSize;
        const scoreLambda = runtimeConfig.get('TEAM_SCORE_LAMBDA');
        const effectiveLambda = (sizeRatio === 1) ? 0 : scoreLambda * (sizeRatio - 1);

        if (debugEnabled) {
            logger.debug('[DEBUG] Lambda calculation:', {
                teamSizes,
                minSize,
                maxSize,
                sizeRatio,
                TEAM_SCORE_LAMBDA: scoreLambda,
                effectiveLambda,
                isNaN_effectiveLambda: isNaN(effectiveLambda)
            });
        }

        ranking = teamConfig.teams
            .map(team => {
                const teamScore = calculateTeamScore(team, game.scores, globalMean, effectiveLambda);
                if (debugEnabled) {
                    logger.debug('[DEBUG] Team score calculated:', {
                        teamName: team.name,
                        players: team.players,
                        teamScore,
                        individualScores: team.players.map(p => ({ nickname: p, score: game.scores[p] }))
                    });
                }
                return {
                    name: team.name,
                    pts: teamScore,
                    color: team.color,
                    isTeam: true
                };
            })
            .sort((a, b) => b.pts - a.pts)
            .map((team, index) => ({ ...team, position: index + 1 }));
    } else {
        // Individual ranking
        ranking = Object.entries(game.scores)
            .map(([name, pts]) => ({ name, pts: roundScore(pts), isTeam: false }))
            .sort((a, b) => b.pts - a.pts)
            .map((player, index) => ({ ...player, position: index + 1 }));
    }

    return ranking;
}

module.exports = {
    calculateFinalRanking
};
