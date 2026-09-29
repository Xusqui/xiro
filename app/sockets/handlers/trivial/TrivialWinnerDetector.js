'use strict';

/**
 * @fileoverview Trivial — winner detection helper
 *
 * Checks whether any player/team has all tokens filled and, if so,
 * emits `trivial-winner` with ranking and sets state.phase = 'game_over'.
 *
 * Returns true if a winner was found (caller should stop turn logic).
 *
 * Public API:
 *   checkAndEmitWinner({ io, roomId, state, activeGames })
 */

const trivialState = require('../../services/TrivialGameState');
const { buildTrivialRanking } = require('../../services/TrivialEndGameService');
const { finalizeTrivialGame } = require('./TrivialFinalize');
const { activeGames } = require('../../../state/globalState');
const logger = require('../../../config/logger');

/**
 * Detects a winner and emits trivial-winner if found.
 * Mutates state.phase to 'game_over' and persists it to Redis.
 *
 * @param {{ io: Object, roomId: string, state: Object }} params
 * @returns {Promise<boolean>} true if a winner was detected
 */
async function checkAndEmitWinner({ io, roomId, state }) {
    for (const [nick, playerData] of Object.entries(state.players)) {
        const token = state.teamMode
            ? state.teamTokens[playerData.teamName]
            : playerData.token;

        if (!trivialState.isAllTokensFilled(token)) continue;

        const game = activeGames.get(roomId);
        const ranking = buildTrivialRanking(state, game?.scores || {});

        state.phase = 'game_over';
        await trivialState.setTrivialState(roomId, state);

        io.to(roomId + ':presenter').emit('trivial-winner', { ranking });
        io.to(roomId + ':players').emit('trivial-winner', { ranking });

        logger.info('Trivial winner detected', { roomId, winner: nick });

        // Finalize in background: send player-final-position + cleanup.
        // Passes teamConfig so sendFinalPositions uses team-mode path for team games.
        const teamConfig = state.teamMode && state.teamConfig
            ? { ...state.teamConfig, isTeamMode: true }
            : null;
        finalizeTrivialGame({ io, roomId, ranking, teamConfig }).catch(err =>
            logger.error('TrivialFinalize error', { roomId, error: err.message })
        );

        return true;
    }
    return false;
}

module.exports = { checkAndEmitWinner };
