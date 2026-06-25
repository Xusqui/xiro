'use strict';

/**
 * @fileoverview Trivial — post-winner finalization
 *
 * Called immediately when a winner is detected (from TrivialWinnerDetector).
 * Handles the cleanup pipeline that runs in the background while the presenter
 * is still showing the "¡Tenemos ganador!" overlay:
 *
 *  1. Persist game session to DB (saveGameSession) — THE canonical save for
 *     winner-detected games since the presenter never emits trivial-end-game.
 *  2. Send player-final-position to every connected player socket
 *     (reuses GameCleanupManager.sendFinalPositions — same as standard quiz)
 *  3. Emit game-ended to the PLAYERS room only → triggers player-results.js
 *     localStorage cleanup and session reset
 *  4. Clear game timer, delete trivial state from Redis, remove activeGames entry
 *
 * NOTE: game-ended is intentionally NOT sent to the presenter room here.
 * The presenter flow for trivial ends via the trivial-winner overlay →
 * "Ver Podio" button → renderPodio(), so a redundant game-ended would
 * call renderPodio() a second time before the button is clicked.
 *
 * Public API:
 *   finalizeTrivialGame({ io, roomId, ranking })
 */

const trivialGameState = require('../../services/TrivialGameState');
const { sendFinalPositions } = require('../../utils/GameCleanupManager');
const { clearGameTimer, activeGames } = require('../../../state/globalState');
const { saveGameSession } = require('../../../services/db/game-session.service');
const { getRedisClient } = require('../../../config/redis');
const logger = require('../../../config/logger');

function clearRoomTimer(roomId) {
    try {
        clearGameTimer(roomId);
    } catch (_e) {
        // No active timer for this room.
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

function buildQuestionsSnapshot(state) {
    if (!state) {
        return null;
    }

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

async function mergeAnswersAndStartTime(roomId, game) {
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

async function persistTrivialSession({ io, roomId, pin, ranking, mergedAnswers, startedAt, state }) {
    const sessionId = await saveGameSession({
        pin,
        sessionId: roomId,
        gameType: 'trivial',
        startedAt,
        durationMs: startedAt ? Date.now() - startedAt : null,
        playerCount: ranking.length,
        questionCount: Object.keys(mergedAnswers).length,
        reason: 'completed',
        finalRanking: ranking,
        questionsSnapshot: buildQuestionsSnapshot(state),
        playerAnswers: mergedAnswers
    });

    if (sessionId) {
        io.to(roomId + ':presenter').emit('results-ready', { sessionId });
    }
}

function emitAutoPlayerRedirect(io, roomId) {
    setTimeout(() => {
        io.to(roomId + ':players').emit('game-abandoned', {
            roomId,
            reason: 'concluded',
            message: 'Juego concluido.',
            code: 'GAME_ENDED'
        });
    }, 15000);
}

/**
 * Finalizes a trivial game after winner detection.
 *
 * @param {{ io: Object, roomId: string, ranking: Array, teamConfig: Object|null }} params
 *   ranking   — array built by buildTrivialRanking (has .name, .pts, .position)
 *   teamConfig — pass state.teamConfig (with isTeamMode:true) for team games, null otherwise
 */
async function finalizeTrivialGame({ io, roomId, ranking, teamConfig = null }) {
    clearRoomTimer(roomId);

    // ── Persist session to DB BEFORE state cleanup ────────────────────────
    // The presenter "Ver Podio" button only calls renderPodio() locally and
    // does NOT emit trivial-end-game, so this is the only save opportunity
    // for winner-detected games.
    const game = activeGames.get(roomId);
    const pin = game?.pin || roomId;
    const state = await trivialGameState.getTrivialState(roomId);
    const { mergedAnswers, redisStartTime } = await mergeAnswersAndStartTime(roomId, game);
    const trivialStart = redisStartTime || game?.gameStartTime || game?.startTime || null;

    try {
        await persistTrivialSession({
            io,
            roomId,
            pin,
            ranking,
            mergedAnswers,
            startedAt: trivialStart,
            state
        });
    } catch (err) {
        logger.error('TrivialFinalize: no se pudo persistir sesión', { error: err.message });
    }

    // Send player-final-position to each connected player socket.
    await sendFinalPositions({ io, roomId, ranking, teamConfig });

    // Trigger player-side session cleanup (clears localStorage, resets state).
    // Sent to players room only — presenter gets game-ended via its own path.
    io.to(roomId + ':players').emit('game-ended', ranking);

    // Redirigir jugadores automáticamente tras mostrar su posición final.
    emitAutoPlayerRedirect(io, roomId);

    // Free Redis trivial state and in-memory game entry.
    await trivialGameState.deleteTrivialState(roomId);
    activeGames.delete(roomId);

    logger.info('TrivialFinalize: game finalized', { roomId, players: ranking.length });
}

module.exports = { finalizeTrivialGame };
