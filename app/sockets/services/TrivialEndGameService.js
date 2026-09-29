'use strict';

/**
 * @fileoverview TrivialEndGameService
 *
 * Computes the Trivial final ranking (wedges first, pts as tiebreaker),
 * sends the standard `game-ended` + `player-final-position` events so the
 * existing presenter podium and player position screens work with zero new
 * frontend code, then cleans up state.
 *
 * Ranking sort: wedges DESC → pts DESC
 * scoreLabel (used by renderPodio):
 *   - unique wedge count → "5 Categorías"
 *   - tied wedge count   → "4 Categorías · 1400 pts"
 */

const trivialGameState = require('./TrivialGameState');
const { sendFinalPositions } = require('../utils/GameCleanupManager');
const { clearGameTimer, activeGames } = require('../../state/globalState');
const { saveGameSession } = require('../../services/db/game-session.service');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

function clearRoomTimer(roomId) {
    try {
        clearGameTimer(roomId);
    } catch (_e) {
        // No timer active for this room.
    }
}

function buildPlayerWedges(state) {
    const result = {};
    const categories = state.categories || [];

    if (state.teamMode && state.teamConfig?.teams) {
        for (const team of state.teamConfig.teams) {
            const token = state.teamTokens?.[team.name] || [];
            result[team.name] = categories
                .map((category, index) => token[index] ? category.category_name : null)
                .filter(Boolean);
        }
        return result;
    }

    for (const [nick, player] of Object.entries(state.players || {})) {
        result[nick] = categories
            .map((category, index) => (player.token || [])[index] ? category.category_name : null)
            .filter(Boolean);
    }

    return result;
}

function buildTrivialQuestionsSnapshot(state) {
    return {
        isTrivialMeta: true,
        categories: (state.categories || []).map(category => category.category_name || ''),
        playerWedges: buildPlayerWedges(state)
    };
}

function mergeAnswersFromRedisEntries(mergedAnswers, allEntries) {
    for (const [field, value] of Object.entries(allEntries)) {
        const colonIdx = field.indexOf(':');
        const qIdx = Number(field.substring(0, colonIdx));
        const nick = field.substring(colonIdx + 1);

        if (!mergedAnswers[qIdx]) {
            mergedAnswers[qIdx] = {};
        }
        if (mergedAnswers[qIdx][nick]) {
            continue;
        }

        try {
            mergedAnswers[qIdx][nick] = JSON.parse(value);
        } catch (_e) {
            // Ignore malformed Redis payload.
        }
    }
}

async function mergeTrivialAnswersAndStartTime(roomId, game) {
    const mergedAnswers = { ...(game?.playerAnswers || {}) };
    let redisStartTime = null;

    try {
        const redis = await getRedisClient();
        const answersKey = `game:playeranswers:${roomId}`;
        const startKey = `game:started:${roomId}`;
        const allEntries = await redis.hGetAll(answersKey);

        if (allEntries && Object.keys(allEntries).length > 0) {
            mergeAnswersFromRedisEntries(mergedAnswers, allEntries);
            redis.del(answersKey).catch(() => { });
        }

        const startTs = await redis.get(startKey);
        if (startTs) {
            redisStartTime = Number(startTs);
            redis.del(startKey).catch(() => { });
        }
    } catch (_e) {
        // Ignore Redis merge/start-time failures.
    }

    return { mergedAnswers, redisStartTime };
}

function buildTeamConfigAdapter(state) {
    if (state.teamMode && state.teamConfig) {
        return { ...state.teamConfig, isTeamMode: true };
    }

    return null;
}

async function persistTrivialSession({ io, roomId, pin, ranking, state, mergedAnswers, startedAt }) {
    const sessionId = await saveGameSession({
        pin,
        sessionId: roomId,
        gameType: 'trivial',
        startedAt,
        durationMs: startedAt ? Date.now() - startedAt : null,
        playerCount: ranking.length,
        questionCount: Object.keys(mergedAnswers).length,
        reason: 'manual',
        finalRanking: ranking,
        questionsSnapshot: buildTrivialQuestionsSnapshot(state),
        playerAnswers: mergedAnswers
    });

    if (sessionId) {
        io.to(roomId + ':presenter').emit('results-ready', { sessionId });
    }
}

/**
 * Returns how many wedges (filled tokens) a player has.
 * @param {Array<boolean>} token
 */
function countWedges(token) {
    if (!Array.isArray(token)) return 0;
    return token.filter(Boolean).length;
}

/**
 * Builds ranking array ordered by wedges DESC then pts DESC.
 * In team mode, one entry per team (average member score as pts).
 * In individual mode, one entry per player.
 *
 * @param {Object} state  - TrivialGameState
 * @param {Object} scores - { [nickname]: number } from activeGames.scores
 * @returns {Array<Object>}
 */
function buildTrivialRanking(state, scores) {
    const isTeamMode = !!state.teamMode;  // state.teamMode is set in TrivialSocketHandler

    if (isTeamMode && state.teamConfig?.teams?.length) {
        return _buildTeamRanking(state, scores);
    }
    return _buildIndividualRanking(state, scores);
}

function _buildTeamRanking(state, scores) {
    const entries = state.teamConfig.teams.map(team => {
        const token = state.teamTokens?.[team.name] || [];
        const memberPts = (team.players || []).map(nick => scores[nick] || 0);
        const avgPts = memberPts.length > 0
            ? Math.round(memberPts.reduce((a, b) => a + b, 0) / memberPts.length * 10) / 10
            : 0;
        return { name: team.name, wedges: countWedges(token), pts: avgPts, isTeam: true, color: team.color };
    });
    entries.sort((a, b) => b.wedges - a.wedges || b.pts - a.pts);

    const wedgeFreq = {};
    entries.forEach(e => { wedgeFreq[e.wedges] = (wedgeFreq[e.wedges] || 0) + 1; });
    return entries.map((p, i) => {
        const tied = wedgeFreq[p.wedges] > 1;
        const noun = p.wedges !== 1 ? 'Categorías' : 'Categoría';
        const scoreLabel = tied ? `${p.wedges} ${noun} · ${p.pts} pts` : `${p.wedges} ${noun}`;
        return { name: p.name, pts: p.pts, position: i + 1, isTeam: true, scoreLabel, color: p.color };
    });
}

function _buildIndividualRanking(state, scores) {
    const entries = Object.entries(state.players).map(([nick, p]) => ({
        name: nick,
        wedges: countWedges(p.token || []),
        pts: scores[nick] || 0,
        isTeam: false
    }));
    entries.sort((a, b) => b.wedges - a.wedges || b.pts - a.pts);

    const wedgeFreq = {};
    entries.forEach(e => { wedgeFreq[e.wedges] = (wedgeFreq[e.wedges] || 0) + 1; });
    return entries.map((p, i) => {
        const tied = wedgeFreq[p.wedges] > 1;
        const noun = p.wedges !== 1 ? 'Categorías' : 'Categoría';
        const scoreLabel = tied ? `${p.wedges} ${noun} · ${p.pts} pts` : `${p.wedges} ${noun}`;
        return { name: p.name, pts: p.pts, position: i + 1, isTeam: false, scoreLabel };
    });
}

/**
 * Orchestrates Trivial end-game:
 *  1. Build ranking from Redis trivial state
 *  2. Send player-final-position to each player (existing GameCleanupManager)
 *  3. Emit game-ended to presenter (→ existing game-ended handler → renderPodio)
 *  4. Emit game-ended to players room (→ player-results.js clears localStorage)
 *  5. Cleanup: clear timer, delete trivialState, delete activeGames entry
 *
 * @param {{ roomId: string, io: Object }} params
 */
async function endTrivialGame({ roomId, io }) {
    const state = await trivialGameState.getTrivialState(roomId);
    if (!state) {
        logger.warn('TrivialEndGameService: no trivial state found', { roomId });
        return;
    }

    const game = activeGames.get(roomId);
    const scores = game?.scores || {};

    const ranking = buildTrivialRanking(state, scores);
    const teamConfig = buildTeamConfigAdapter(state);
    logger.info('TrivialEndGameService: ranking computed', {
        roomId,
        entries: ranking.map(r => ({ name: r.name, wedges: r.scoreLabel, pts: r.pts }))
    });

    clearRoomTimer(roomId);

    // Persistir sesión (no-blocking)
    const pin = game?.pin || roomId;
    const { mergedAnswers, redisStartTime } = await mergeTrivialAnswersAndStartTime(roomId, game);
    const trivialStart = redisStartTime || game?.gameStartTime || game?.startTime || null;

    try {
        await persistTrivialSession({
            io,
            roomId,
            pin,
            ranking,
            state,
            mergedAnswers,
            startedAt: trivialStart
        });
    } catch (err) {
        logger.error('TrivialEndGameService: no se pudo persistir sesión', { error: err.message });
    }

    // Individual player position screens (reuses existing GameCleanupManager)
    await sendFinalPositions({ io, roomId, ranking, teamConfig });

    // Presenter podium — triggers existing game-ended handler → renderPodio
    io.to(roomId + ':presenter').emit('game-ended', ranking);

    // Player game-ended confirmation — triggers player-results.js cleanup
    io.to(roomId + ':players').emit('game-ended', ranking);

    // State cleanup
    await trivialGameState.deleteTrivialState(roomId);
    activeGames.delete(roomId);

    logger.info('TrivialEndGameService: cleanup done', { roomId });
}

module.exports = { buildTrivialRanking, endTrivialGame };
