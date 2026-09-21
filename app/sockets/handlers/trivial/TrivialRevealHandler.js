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

// ── helpers internos ─────────────────────────────────────────────────────────

async function _readWasCorrect(roomId, game, state) {
    // Team mode: ALL active team members must have answered correctly for roll-again.
    // Uses trivial:roundresults hash — same source used for wedge award logic.
    if (state?.teamMode && state?.currentTrivialMeta) {
        const actorNick = state.currentTrivialMeta.actorNick;
        const roundResults = await _readRoundResults(roomId);
        const teamMembers = Object.entries(state.players)
            .filter(([, p]) => p.teamName === actorNick)
            .map(([nick]) => nick);
        if (!teamMembers.length) return false;
        const allCorrect = teamMembers.every(nick => roundResults[nick] === true);
        logger.debug('trivial _readWasCorrect: team mode', { roomId, actorNick, teamMembers, allCorrect });
        return allCorrect;
    }
    // Individual mode: read Redis key written by ImprovedSubmitAnswerCommand.
    try {
        const client = await getRedisClient();
        const stored = await client.get(`trivial:lastcorrect:${roomId}`);
        const result = stored === '1';
        logger.debug('trivial _readWasCorrect: from Redis', { roomId, stored, result });
        return result;
    } catch (err) {
        logger.error('trivial _readWasCorrect: Redis error, defaulting to false', { roomId, error: err.message });
        return false;
    }
}

/**
 * Reads per-player correctness stored by ImprovedSubmitAnswerCommand.
 * Returns { nick: true/false, ... } for all players who answered.
 */
async function _readRoundResults(roomId) {
    try {
        const client = await getRedisClient();
        const hash = await client.hGetAll(`trivial:roundresults:${roomId}`);
        const results = {};
        for (const [nick, val] of Object.entries(hash || {})) {
            results[nick] = val === '1';
        }
        logger.debug('trivial _readRoundResults', { roomId, results });
        return results;
    } catch (err) {
        logger.error('trivial _readRoundResults: Redis error', { roomId, error: err.message });
        return {};
    }
}

async function _updateWedgeEarnedInRedis(roomId, epoch, nicknames, categoryName) {
    if (epoch === undefined || !categoryName || !Array.isArray(nicknames) || nicknames.length === 0) {
        return;
    }

    const key = `game:playeranswers:${roomId}`;

    try {
        const rc = await getRedisClient();
        await Promise.all(nicknames.map(async nick => {
            const field = `${epoch}:${nick}`;
            const existing = await rc.hGet(key, field);
            if (!existing) {
                return;
            }

            try {
                const entry = JSON.parse(existing);
                entry.wedgeEarned = categoryName;
                await rc.hSet(key, field, JSON.stringify(entry));
            } catch (_) {
                // ignore malformed Redis payload
            }
        }));
    } catch (_) {
        // ignore redis update failure
    }
}

function _updateWedgeEarnedInMemory(game, epoch, nicknames, categoryName) {
    if (epoch === undefined || !categoryName || !Array.isArray(nicknames) || nicknames.length === 0) {
        return;
    }

    for (const nick of nicknames) {
        if (game.playerAnswers?.[epoch]?.[nick]) {
            game.playerAnswers[epoch][nick].wedgeEarned = categoryName;
        }
    }
}

async function _syncWedgeEarned(roomId, game, epoch, nicknames, categoryName) {
    await _updateWedgeEarnedInRedis(roomId, epoch, nicknames, categoryName);
    _updateWedgeEarnedInMemory(game, epoch, nicknames, categoryName);
}

function _buildTeamMap(state) {
    const teamMap = {};
    for (const [nick, player] of Object.entries(state.players)) {
        if (!player.teamName) {
            continue;
        }
        if (!teamMap[player.teamName]) {
            teamMap[player.teamName] = [];
        }
        teamMap[player.teamName].push(nick);
    }
    return teamMap;
}

async function _awardTeamWedges(roomId, state, catIdx, categoryName, roundResults) {
    const game = activeGames.get(roomId);
    const epoch = game?.trivialQuestionEpoch;
    const teamMap = _buildTeamMap(state);
    let anyEarned = false;

    for (const [teamName, members] of Object.entries(teamMap)) {
        const allCorrect = members.length > 0 && members.every(nick => roundResults[nick] === true);
        logger.debug('trivial: team wedge check', { roomId, teamName, members, allCorrect });

        if (!allCorrect) {
            continue;
        }

        const token = state.teamTokens[teamName];
        if (!token) {
            continue;
        }

        if (token[catIdx]) {
            logger.debug('trivial: team wedge already owned', { roomId, teamName, catIdx });
            continue;
        }

        token[catIdx] = true;
        members.forEach(nick => {
            if (state.players[nick].token) {
                state.players[nick].token[catIdx] = true;
            }
        });

        logger.info('trivial: wedge awarded to team', { roomId, teamName, catIdx });
        anyEarned = true;
        await _syncWedgeEarned(roomId, game || {}, epoch, members, categoryName);
    }

    return anyEarned;
}

async function _awardIndividualWedges(roomId, state, catIdx, categoryName, roundResults) {
    const game = activeGames.get(roomId);
    const epoch = game?.trivialQuestionEpoch;
    let anyEarned = false;

    for (const [nick, playerData] of Object.entries(state.players)) {
        if (!roundResults[nick]) {
            logger.debug('trivial: player did not answer correctly — no wedge', {
                roomId,
                nick,
                catIdx,
                roundResult: roundResults[nick]
            });
            continue;
        }

        const token = playerData.token;
        if (!token) {
            continue;
        }

        if (token[catIdx]) {
            logger.debug('trivial: wedge already owned', { roomId, nick, catIdx });
            continue;
        }

        token[catIdx] = true;
        logger.info('trivial: wedge awarded', { roomId, nick, catIdx });
        anyEarned = true;
        await _syncWedgeEarned(roomId, game || {}, epoch, [nick], categoryName);
    }

    return anyEarned;
}

/**
 * Awards a wedge for catIdx to every player (or team) who answered correctly this round.
 * Idempotent: skips players who already own that wedge.
 * Returns true if at least one new wedge was awarded.
 */
async function _awardWedgesForPosition(roomId, state, catIdx) {
    const roundResults = await _readRoundResults(roomId);
    const categoryName = state.categories?.[catIdx]?.category_name || null;

    if (state.teamMode) {
        return _awardTeamWedges(roomId, state, catIdx, categoryName, roundResults);
    }

    return _awardIndividualWedges(roomId, state, catIdx, categoryName, roundResults);
}

function _ensureGame(roomId, state) {
    let game = activeGames.get(roomId);
    if (!game) {
        game = {
            pin: roomId, isTrivial: true, questions: [], currentIndex: 0,
            scores: {}, players: Object.keys(state.players), canAnswer: false,
            state: 'in-progress', startTime: Date.now(), answerStats: {},
            revealedQuestions: new Set(), trivialMeta: null, trivialLastCorrect: null,
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

// ── exports ──────────────────────────────────────────────────────────────────

function createHandleNextTurn(io) {
    return async function handleNextTurn(roomId) {
        logger.debug('trivial handleNextTurn: invoked', { roomId });

        // Idempotency guard: prevent double-processing when the presenter
        // sends two rapid next-question events (double-click or two sockets).
        const lockKey = `trivial:nextturn-lock:${roomId}`;
        try {
            const lockClient = await getRedisClient();
            const acquired = await lockClient.set(lockKey, '1', { NX: true, EX: 3 });
            if (!acquired) {
                logger.warn('trivial handleNextTurn: skipped — lock held (double event)', { roomId });
                return;
            }
        } catch (lockErr) {
            logger.warn('trivial handleNextTurn: lock check failed, proceeding', { roomId, error: lockErr.message });
        }
        const state = await trivialState.getTrivialState(roomId);
        if (!state) {
            logger.warn('trivial handleNextTurn: no state in Redis', { roomId });
            return;
        }

        // Game already decided — ignore any stray next-question clicks
        if (state.phase === 'game_over') {
            logger.debug('trivial handleNextTurn: skipped (game_over)', { roomId });
            return;
        }

        const game = _ensureGame(roomId, state);
        const actorNick = trivialState.getCurrentTurnActor(state);
        const wasCorrect = await _readWasCorrect(roomId, game, state);
        logger.debug('trivial handleNextTurn: actor and result', { roomId, actorNick, wasCorrect, hasMeta: !!state.currentTrivialMeta });

        // Award wedges to all players who answered correctly this round.
        // This covers the auto-reveal path (all-answered) where handlePostReveal is never called,
        // because reveal-answer is emitted server→client only (not client→server).
        // _awardWedgesForPosition is idempotent: if handlePostReveal already ran (manual reveal),
        // the wedge is already owned → anyEarned=false → no duplicate trivial-token-update emitted.
        let wedgeEarnedInNextTurn = false;
        if (state.currentTrivialMeta) {
            const { position, catIdx: hqCatIdx } = state.currentTrivialMeta;
            const { N, M } = state.board;
            const { isHQ: isHQPos } = isHQPosition(position, N, M);
            const isWedgePosition = isHQPos || position === 'center';
            logger.debug('trivial handleNextTurn: wedge check', {
                roomId, actorNick, position, hqCatIdx,
                hqCatIdxType: typeof hqCatIdx,
                isHQPos, isWedgePosition,
                rawMeta: JSON.stringify(state.currentTrivialMeta)
            });
            if (isWedgePosition && hqCatIdx !== null && hqCatIdx !== undefined) {
                wedgeEarnedInNextTurn = await _awardWedgesForPosition(roomId, state, hqCatIdx);
                if (wedgeEarnedInNextTurn) {
                    const won = await checkAndEmitWinner({ io, roomId, state });
                    if (won) return; // Stop: do not advance turn after win
                }
            } else {
                logger.debug('trivial handleNextTurn: not a wedge position', { roomId, actorNick, position, hqCatIdx });
            }
        }

        if (!state.consecutiveRolls) state.consecutiveRolls = {};
        const action = nextTurnAction(state, actorNick, wasCorrect);
        logger.info('trivial handleNextTurn: turn action', { roomId, actorNick, wasCorrect, action });

        if (action === 'advance-turn') {
            trivialState.advanceTurn(state);
            logger.debug('trivial handleNextTurn: turn advanced', { roomId, nextActor: trivialState.getCurrentTurnActor(state) });
        } else {
            logger.debug('trivial handleNextTurn: roll-again — same actor keeps turn', { roomId, actorNick });
        }

        state.phase = 'waiting_roll';
        await trivialState.setTrivialState(roomId, state);

        // Emit token-update immediately if wedge was earned this turn (before turn-changed).
        // Idempotent: anyEarned=false if handlePostReveal already ran (manual reveal path).
        if (wedgeEarnedInNextTurn) {
            const tokenPayload = { players: buildPlayers(state), teamTokens: state.teamTokens };
            /* Both roles join roomId (shared) — single emit reaches all */
            io.to(roomId).emit('trivial-token-update', tokenPayload);
            logger.debug('trivial handleNextTurn: trivial-token-update emitted', { roomId, actorNick });
        }

        const rollAgain = action === 'roll-again';
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
    };
}

function createHandlePostReveal(io) {
    return async function handlePostReveal(roomId, _game) {
        logger.debug('trivial handlePostReveal: invoked', { roomId });

        const state = await trivialState.getTrivialState(roomId);
        if (!state?.currentTrivialMeta) {
            logger.debug('trivial handlePostReveal: no currentTrivialMeta — not a trivial question, skipping', { roomId });
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
            wedgeEarned = await _awardWedgesForPosition(roomId, state, hqCatIdx);
        } else {
            logger.debug('trivial handlePostReveal: not a wedge position — no wedge', { roomId, actorNick, position });
        }

        if (wedgeEarned) {
            await trivialState.setTrivialState(roomId, state);
            const tokenPayload = { players: buildPlayers(state), teamTokens: state.teamTokens };
            /* Both roles join roomId (shared) — single emit reaches all */
            io.to(roomId).emit('trivial-token-update', tokenPayload);
            logger.debug('trivial handlePostReveal: trivial-token-update emitted', { roomId, actorNick });

            const won = await checkAndEmitWinner({ io, roomId, state });
            if (won) return;
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
