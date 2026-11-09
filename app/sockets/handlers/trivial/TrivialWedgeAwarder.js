/**
 * @fileoverview Trivial - reparto de cuñas al terminar una pregunta en casilla de cuña (HQ o centro).
 * Lee qué jugadores acertaron (Redis, compartido entre workers), otorga la cuña a cada jugador
 * o equipo y marca `wedgeEarned` en sus respuestas guardadas para el informe.
 */

'use strict';

const logger = require('../../../config/logger');
const { activeGames } = require('../../../state/globalState');
const { getRedisClient } = require('../../../config/redis');
/**
 * Indica si el actor del turno acertó. En equipos deben acertar todos sus miembros activos.
 * @param {string} roomId - Sala
 * @param {Object} game - Partida activa (sin uso; se mantiene la firma)
 * @param {Object} state - Estado Trivial
 * @returns {Promise<boolean>} false también si Redis falla
 */
async function readWasCorrect(roomId, game, state) {
    // Team mode: ALL active team members must have answered correctly for roll-again.
    // Uses trivial:roundresults hash — same source used for wedge award logic.
    if (state?.teamMode && state?.currentTrivialMeta) {
        const actorNick = state.currentTrivialMeta.actorNick;
        const roundResults = await readRoundResults(roomId);
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
async function readRoundResults(roomId) {
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
        await Promise.all(
            nicknames.map(async nick => {
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
            })
        );
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
async function awardWedgesForPosition(roomId, state, catIdx) {
    const roundResults = await readRoundResults(roomId);
    const categoryName = state.categories?.[catIdx]?.category_name || null;

    if (state.teamMode) {
        return _awardTeamWedges(roomId, state, catIdx, categoryName, roundResults);
    }

    return _awardIndividualWedges(roomId, state, catIdx, categoryName, roundResults);
}

module.exports = { readWasCorrect, awardWedgesForPosition };
