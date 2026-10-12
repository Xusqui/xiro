/**
 * @fileoverview «Completa la frase» (fill_blanks): estado compartido en Redis de las
 * pistas, de los huecos resueltos por un equipo y del primer envío del equipo.
 *
 * Todo vive en Redis porque la pista o la comprobación llegan en un evento y la
 * respuesta puede caer en otro worker:
 *   game:fbhints:<sala>:<pregunta>:<dueño>  → hash { hueco: pistas usadas } (dueño:
 *       "player:<nick>" o "team:<equipo>"; en equipos la pista de uno vale para todos)
 *   game:fbteam:<sala>:<pregunta>:<equipo>   → hash { hueco: '{"word","by"}' } (HSETNX)
 *   game:fbsubmit:<sala>:<pregunta>:<equipo> → '{"by","elapsed","words"}' (SET NX): el
 *       primer ENVIAR cierra la pregunta para el equipo con su bonus de tiempo
 * Al puntuar, cada miembro usa las pistas, los huecos y el tiempo del equipo
 * (getFillBlanksScoringContext).
 */

'use strict';

const { activeGames, players, teamConfigs } = require('../../state/globalState');
const sessionStore = require('../../services/SessionStore');
const GameModeFactory = require('../../domain/strategies/GameModeFactory');
const { getRedisClient } = require('../../config/redis');
const { LIMITS } = require('../../domain/services/FillBlanksService');
const logger = require('../../config/logger');

const TTL_SECONDS = 7200;

const keys = {
    hints: (sPin, q, owner) => `game:fbhints:${sPin}:${q}:${owner}`,
    solved: (sPin, q, team) => `game:fbteam:${sPin}:${q}:${team}`,
    submit: (sPin, q, team) => `game:fbsubmit:${sPin}:${q}:${team}`
};

/** Dueño de las pistas: el equipo si juega en equipos, si no el jugador. */
function hintOwner(nickname, team) {
    return team ? `team:${team.name}` : `player:${nickname}`;
}

/** Equipo del jugador si la partida es por equipos; si no, null. */
function findFillBlanksTeam(sPin, nickname, game) {
    const teamConfig = teamConfigs.get(sPin);
    if (!GameModeFactory.determineTeamMode({ teamConfig, game })) return null;
    return (teamConfig?.teams || []).find(t => Array.isArray(t.players) && t.players.includes(nickname)) || null;
}

/**
 * Contexto común de los eventos: sala y jugador (de socket.data, no del payload),
 * partida, pregunta actual y equipo.
 * @returns {Promise<{ok: true, roomId, nickname, game, question, team}|{ok: false, reason: string}>}
 */
async function resolveFillBlanksContext(socket) {
    const room = socket?.data?.roomId || socket?.data?.pin;
    const nickname = socket?.data?.nickname;
    if (!room || !nickname) return { ok: false, reason: 'invalid-payload' };

    const roomId = String(room);
    const game = activeGames.get(roomId) || await sessionStore.load(roomId);
    const question = game?.questions?.[game.currentIndex];
    if (!question || question.question_type !== 'fill_blanks') return { ok: false, reason: 'not-fill-blanks' };
    if (!game.canAnswer) return { ok: false, reason: 'game-closed' };

    return { ok: true, roomId, nickname, game, question, team: findFillBlanksTeam(roomId, nickname, game) };
}

/**
 * Anota una pista más en el hueco. Si ya se gastaron las 3, deshace el incremento.
 * @returns {Promise<{ count: number, granted: boolean }>} pistas usadas tras la llamada
 */
async function recordHint(sPin, questionIndex, owner, blankIndex) {
    const key = keys.hints(sPin, questionIndex, owner);
    const redis = await getRedisClient();
    const [count] = await redis.multi().hIncrBy(key, String(blankIndex), 1).expire(key, TTL_SECONDS).exec();
    if (Number(count) > LIMITS.MAX_HINTS_PER_BLANK) {
        await redis.hIncrBy(key, String(blankIndex), -1);
        return { count: LIMITS.MAX_HINTS_PER_BLANK, granted: false };
    }
    return { count: Number(count), granted: true };
}

/**
 * Pistas usadas por hueco. Si Redis falla devuelve ceros (mejor regalar la palabra
 * entera que perder la respuesta).
 * @returns {Promise<number[]>}
 */
async function getHintCounts(sPin, questionIndex, owner, totalBlanks) {
    const counts = Array.from({ length: totalBlanks }, () => 0);
    try {
        const redis = await getRedisClient();
        const entries = await redis.hGetAll(keys.hints(sPin, questionIndex, owner)) || {};
        Object.entries(entries).forEach(([index, value]) => {
            const i = Number(index);
            if (Number.isInteger(i) && i >= 0 && i < totalBlanks) counts[i] = Math.min(LIMITS.MAX_HINTS_PER_BLANK, Number(value) || 0);
        });
    } catch (error) {
        logger.warn('No se pudieron leer las pistas de Completa la frase', { sPin, questionIndex, owner, error: error.message });
    }
    return counts;
}

/**
 * Anota un hueco resuelto por el equipo (la primera palabra válida se queda).
 * @returns {Promise<boolean>} true si nadie del equipo lo había resuelto antes
 */
async function recordTeamSolved(sPin, questionIndex, teamName, blankIndex, entry) {
    const key = keys.solved(sPin, questionIndex, teamName);
    const redis = await getRedisClient();
    const [added] = await redis.multi()
        .hSetNX(key, String(blankIndex), JSON.stringify(entry))
        .expire(key, TTL_SECONDS)
        .exec();
    return added === true || Number(added) > 0;
}

/** Huecos resueltos por el equipo: [{ blankIndex, word, by }]. Si Redis falla, []. */
async function getTeamSolved(sPin, questionIndex, teamName) {
    try {
        const redis = await getRedisClient();
        const entries = await redis.hGetAll(keys.solved(sPin, questionIndex, teamName)) || {};
        return Object.entries(entries).map(([index, json]) => {
            try {
                return { blankIndex: Number(index), ...JSON.parse(json) };
            } catch {
                return null;
            }
        }).filter(entry => entry && Number.isInteger(entry.blankIndex));
    } catch (error) {
        logger.warn('No se pudieron leer los huecos del equipo', { sPin, questionIndex, teamName, error: error.message });
        return [];
    }
}

/**
 * El primer ENVIAR del equipo se queda con el tiempo: los compañeros puntúan con
 * el mismo bonus. Devuelve si este envío fue el primero y el registro vigente.
 * @returns {Promise<{ isFirst: boolean, record: {by, elapsed, words}|null }>}
 */
async function claimTeamSubmit(sPin, questionIndex, teamName, record) {
    const key = keys.submit(sPin, questionIndex, teamName);
    try {
        const redis = await getRedisClient();
        const set = await redis.set(key, JSON.stringify(record), { NX: true, EX: TTL_SECONDS });
        if (set) return { isFirst: true, record };
        const existing = await redis.get(key);
        return { isFirst: false, record: existing ? JSON.parse(existing) : record };
    } catch (error) {
        logger.warn('No se pudo registrar el envío del equipo', { sPin, questionIndex, teamName, error: error.message });
        return { isFirst: false, record };
    }
}

/** Registro del envío del equipo (o null si nadie ha enviado todavía). */
async function getTeamSubmit(sPin, questionIndex, teamName) {
    try {
        const redis = await getRedisClient();
        const existing = await redis.get(keys.submit(sPin, questionIndex, teamName));
        return existing ? JSON.parse(existing) : null;
    } catch {
        return null;
    }
}

/**
 * Envía `event` a los compañeros conectados de `nickname` (no a él).
 * @param {{ io: Object, roomId: string, team: Object, nickname: string }} target
 */
function emitToTeammates({ io, roomId, team, nickname }, event, payload) {
    for (const player of players.values()) {
        if (player.roomId !== roomId || player.nickname === nickname || !player.socketId) continue;
        if (!team.players.includes(player.nickname)) continue;
        if (player.status === 'disconnected' || player.status === 'presenter_disconnected') continue;
        io.to(player.socketId).emit(event, payload);
    }
}

/**
 * Pistas, huecos compartidos y tiempo con los que se puntúa la respuesta de `nickname`.
 * En equipos reclama además el primer envío (claimTeamSubmit): si este jugador es el
 * primero, `teamToNotify` indica a quién avisar para que envíen lo mismo.
 * @param {{ sPin, questionIndex, nickname, game, totalBlanks, elapsed, words }} params
 * @returns {Promise<{ hintCounts: number[], sharedSolved: number[], timeElapsedOverride?: number, team: Object|null, teamToNotify: Object|null }>}
 */
async function getFillBlanksScoringContext({ sPin, questionIndex, nickname, game, totalBlanks, elapsed, words }) {
    const team = findFillBlanksTeam(sPin, nickname, game);
    const hintCounts = await getHintCounts(sPin, questionIndex, hintOwner(nickname, team), totalBlanks);
    if (!team) return { hintCounts, sharedSolved: [], team: null, teamToNotify: null };

    const solved = await getTeamSolved(sPin, questionIndex, team.name);
    const { isFirst, record } = await claimTeamSubmit(sPin, questionIndex, team.name, { by: nickname, elapsed, words: words || [] });
    return {
        hintCounts,
        sharedSolved: solved.map(entry => entry.blankIndex),
        timeElapsedOverride: Number.isFinite(record?.elapsed) ? record.elapsed : undefined,
        team,
        teamToNotify: isFirst ? team : null
    };
}

module.exports = {
    hintOwner,
    findFillBlanksTeam,
    resolveFillBlanksContext,
    recordHint,
    getHintCounts,
    recordTeamSolved,
    getTeamSolved,
    claimTeamSubmit,
    getTeamSubmit,
    emitToTeammates,
    getFillBlanksScoringContext
};
