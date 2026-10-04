/**
 * @fileoverview Ranking Calculator - Cálculo de rankings finales
 * @module sockets/utils/RankingCalculator
 * 
 * Separado de GameEndManager para evitar dependencias circulares
 */

const { roundScore } = require('../../services/game.logic');
const { calculateTeamScore } = require('../../services/game.logic');
const { teamScoreParams } = require('../../domain/services/TeamScoreParams');
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
        // Team ranking with adaptive formula (same parameters as the live scoreboard)
        const scoreLambda = runtimeConfig.get('TEAM_SCORE_LAMBDA');
        const { globalMean, lambda: effectiveLambda } = teamScoreParams(teamConfig.teams, game.scores, scoreLambda);

        if (debugEnabled) {
            logger.debug('[DEBUG] Team scoring parameters:', {
                teamSizes: teamConfig.teams.map(t => t.players?.length || 0),
                TEAM_SCORE_LAMBDA: scoreLambda,
                globalMean,
                effectiveLambda
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
                // Miembros con sus puntos individuales: el visor de resultados los
                // necesita para el desglose del equipo (las respuestas se guardan por nick).
                const members = (team.players || [])
                    .map(nick => ({ name: nick, pts: roundScore(game.scores[nick] || 0) }))
                    .sort((a, b) => b.pts - a.pts);
                return {
                    name: team.name,
                    pts: teamScore,
                    color: team.color,
                    isTeam: true,
                    members
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
