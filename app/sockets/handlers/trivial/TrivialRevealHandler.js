/**
 * @fileoverview Trivial - lógica de post-reveal y siguiente turno
 *
 * handleNextTurn – tras "next-question" del presentador:
 *   · Lee si el actor acertó (Redis cross-worker)
 *   · Aplica TrivialRollMechanic → 'roll-again' | 'advance-turn'
 *   · Emite trivial-turn-changed (con rollAgain=true si repite)
 *
 * handlePostReveal – tras "reveal-answer":
 *   · Otorga cuñas en casillas HQ
 *   · Comprueba ganador
 */

'use strict';

const logger = require('../../../config/logger');
const trivialState = require('../../services/TrivialGameState');
const { isHQPosition } = require('../../services/TrivialBoardGraph');
const { activeGames } = require('../../../state/globalState');
const { getRedisClient } = require('../../../config/redis');
const { nextTurnAction } = require('./TrivialRollMechanic');
const { buildPlayers } = require('./TrivialMoveHandler');
const { checkAndEmitWinner } = require('./TrivialWinnerDetector');
const { readWasCorrect, awardWedgesForPosition } = require('./TrivialWedgeAwarder');

// ── helpers internos ─────────────────────────────────────────────────────────

function _ensureGame(roomId, state) {
    let game = activeGames.get(roomId);
    if (!game) {
        game = {
            pin: roomId,
            isTrivial: true,
            questions: [],
            currentIndex: 0,
            scores: {},
            players: Object.keys(state.players),
            canAnswer: false,
            state: 'in-progress',
            startTime: Date.now(),
            answerStats: {},
            revealedQuestions: new Set(),
            trivialMeta: null,
            trivialLastCorrect: null,
            answeredCurrent: new Set(),
            teamMode: !!state?.teamMode
        };
        activeGames.set(roomId, game);
    }
    // Garantizar streak config (puede faltar si este worker no hizo trivial-start)
    if (game.use_random_points === undefined && state.randomPointsConfig) {
        Object.assign(game, state.randomPointsConfig);
    }
    if (game.use_streaks === undefined && state.streakConfig) {
        Object.assign(game, state.streakConfig);
    }
    // Backfill teamMode si el game fue creado antes del fix o por otro worker sin teamMode
    if (game.teamMode === undefined && state?.teamMode !== undefined) {
        game.teamMode = !!state.teamMode;
    }
    return game;
}

// Idempotencia: evita procesar dos veces si el presentador manda dos next-question seguidos
// (doble clic o dos sockets). Si Redis falla se sigue adelante.
async function _acquireNextTurnLock(roomId) {
    const lockKey = `trivial:nextturn-lock:${roomId}`;
    try {
        const lockClient = await getRedisClient();
        const acquired = await lockClient.set(lockKey, '1', { NX: true, EX: 3 });
        if (!acquired) {
            logger.warn('trivial handleNextTurn: skipped — lock held (double event)', { roomId });
            return false;
        }
    } catch (lockErr) {
        logger.warn('trivial handleNextTurn: lock check failed, proceeding', { roomId, error: lockErr.message });
    }
    return true;
}

async function _loadPlayableState(roomId) {
    const state = await trivialState.getTrivialState(roomId);
    if (!state) {
        logger.warn('trivial handleNextTurn: no state in Redis', { roomId });
        return null;
    }
    // Game already decided — ignore any stray next-question clicks
    if (state.phase === 'game_over') {
        logger.debug('trivial handleNextTurn: skipped (game_over)', { roomId });
        return null;
    }
    return state;
}

/**
 * Award wedges to all players who answered correctly this round.
 * This covers the auto-reveal path (all-answered) where handlePostReveal is never called,
 * because reveal-answer is emitted server→client only (not client→server).
 * awardWedgesForPosition is idempotent: if handlePostReveal already ran (manual reveal),
 * the wedge is already owned → anyEarned=false → no duplicate trivial-token-update emitted.
 * @returns {Promise<{wedgeEarned: boolean, won: boolean}>}
 */
async function _awardWedgesOnNextTurn(io, roomId, state, actorNick) {
    if (!state.currentTrivialMeta) return { wedgeEarned: false, won: false };

    const { position, catIdx: hqCatIdx } = state.currentTrivialMeta;
    const { N, M } = state.board;
    const { isHQ: isHQPos } = isHQPosition(position, N, M);
    const isWedgePosition = isHQPos || position === 'center';
    logger.debug('trivial handleNextTurn: wedge check', {
        roomId,
        actorNick,
        position,
        hqCatIdx,
        hqCatIdxType: typeof hqCatIdx,
        isHQPos,
        isWedgePosition,
        rawMeta: JSON.stringify(state.currentTrivialMeta)
    });
    if (!isWedgePosition || hqCatIdx === null || hqCatIdx === undefined) {
        logger.debug('trivial handleNextTurn: not a wedge position', { roomId, actorNick, position, hqCatIdx });
        return { wedgeEarned: false, won: false };
    }

    const wedgeEarned = await awardWedgesForPosition(roomId, state, hqCatIdx);
    const won = wedgeEarned ? await checkAndEmitWinner({ io, roomId, state }) : false;
    return { wedgeEarned, won };
}

function _applyTurnAction(roomId, state, actorNick, wasCorrect) {
    if (!state.consecutiveRolls) state.consecutiveRolls = {};
    const action = nextTurnAction(state, actorNick, wasCorrect);
    logger.info('trivial handleNextTurn: turn action', { roomId, actorNick, wasCorrect, action });

    if (action === 'advance-turn') {
        trivialState.advanceTurn(state);
        logger.debug('trivial handleNextTurn: turn advanced', {
            roomId,
            nextActor: trivialState.getCurrentTurnActor(state)
        });
    } else {
        logger.debug('trivial handleNextTurn: roll-again — same actor keeps turn', { roomId, actorNick });
    }
    return action;
}

function _emitTurnChanged(io, roomId, state, rollAgain) {
    const payload = {
        currentTurn: trivialState.getCurrentTurnActor(state),
        phase: 'waiting_roll',
        players: buildPlayers(state),
        teamTokens: state.teamTokens,
        rollAgain
    };
    /* Both roles join roomId (shared) — single emit reaches all */
    io.to(roomId).emit('trivial-turn-changed', payload);
    logger.debug('trivial handleNextTurn: trivial-turn-changed emitted', {
        roomId,
        currentTurn: payload.currentTurn,
        rollAgain
    });
}

// ── exports ──────────────────────────────────────────────────────────────────

function createHandleNextTurn(io) {
    return async function handleNextTurn(roomId) {
        logger.debug('trivial handleNextTurn: invoked', { roomId });

        if (!(await _acquireNextTurnLock(roomId))) return;
        const state = await _loadPlayableState(roomId);
        if (!state) return;

        const game = _ensureGame(roomId, state);
        const actorNick = trivialState.getCurrentTurnActor(state);
        const wasCorrect = await readWasCorrect(roomId, game, state);
        logger.debug('trivial handleNextTurn: actor and result', {
            roomId,
            actorNick,
            wasCorrect,
            hasMeta: !!state.currentTrivialMeta
        });

        const { wedgeEarned, won } = await _awardWedgesOnNextTurn(io, roomId, state, actorNick);
        if (won) return; // Stop: do not advance turn after win

        const action = _applyTurnAction(roomId, state, actorNick, wasCorrect);
        state.phase = 'waiting_roll';
        await trivialState.setTrivialState(roomId, state);

        // Emit token-update immediately if wedge was earned this turn (before turn-changed).
        // Idempotent: anyEarned=false if handlePostReveal already ran (manual reveal path).
        if (wedgeEarned) {
            const tokenPayload = { players: buildPlayers(state), teamTokens: state.teamTokens };
            /* Both roles join roomId (shared) — single emit reaches all */
            io.to(roomId).emit('trivial-token-update', tokenPayload);
            logger.debug('trivial handleNextTurn: trivial-token-update emitted', { roomId, actorNick });
        }

        _emitTurnChanged(io, roomId, state, action === 'roll-again');
    };
}

function createHandlePostReveal(io) {
    return async function handlePostReveal(roomId, _game) {
        logger.debug('trivial handlePostReveal: invoked', { roomId });

        const state = await trivialState.getTrivialState(roomId);
        if (!state?.currentTrivialMeta) {
            logger.debug('trivial handlePostReveal: no currentTrivialMeta — not a trivial question, skipping', {
                roomId
            });
            return;
        }

        const { position, actorNick, catIdx: hqCatIdx } = state.currentTrivialMeta;
        logger.debug('trivial handlePostReveal: meta read', { roomId, actorNick, position, hqCatIdx });

        const { N, M } = state.board;
        const { isHQ: isHQPos } = isHQPosition(position, N, M);
        const isWedgePosition = isHQPos || position === 'center';
        logger.debug('trivial handlePostReveal: position analysis', {
            roomId,
            position,
            isHQPos,
            isCenter: position === 'center',
            hqCatIdx
        });

        let wedgeEarned = false;
        if (isWedgePosition && hqCatIdx !== null) {
            wedgeEarned = await awardWedgesForPosition(roomId, state, hqCatIdx);
        } else {
            logger.debug('trivial handlePostReveal: not a wedge position — no wedge', { roomId, actorNick, position });
        }

        if (wedgeEarned) {
            await trivialState.setTrivialState(roomId, state);
            const tokenPayload = { players: buildPlayers(state), teamTokens: state.teamTokens };
            /* Both roles join roomId (shared) — single emit reaches all */
            io.to(roomId).emit('trivial-token-update', tokenPayload);
            logger.debug('trivial handlePostReveal: trivial-token-update emitted', { roomId, actorNick });

            await checkAndEmitWinner({ io, roomId, state });
        }
    };
}

/**
 * Fabrica los dos handlers con las dependencias de cierre.
 * @param {Object} deps - { io }
 */
module.exports = function createRevealHandlers({ io }) {
    return {
        handleNextTurn: createHandleNextTurn(io),
        handlePostReveal: createHandlePostReveal(io)
    };
};
