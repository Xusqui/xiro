/**
 * @fileoverview Sopa de letras en equipos: lo que encuentra un miembro y las
 * pistas que pide valen para todo el equipo.
 *
 * - Palabras del equipo en Redis (compartido entre workers):
 *   game:wsteam:<sala>:<pregunta>:<equipo> → hash { índice: '{"r1","c1","r2","c2","by"}' }
 *   La primera selección que forma la palabra se queda (HSETNX).
 * - Avisos a los compañeros por su socketId (Map players, como TeamManager).
 * - Al puntuar, cada miembro cuenta las palabras y las pistas del equipo
 *   (getWordSearchScoringContext).
 */

'use strict';

const { activeGames, players, teamConfigs } = require('../../state/globalState');
const sessionStore = require('../../services/SessionStore');
const GameModeFactory = require('../../domain/strategies/GameModeFactory');
const { getRedisClient } = require('../../config/redis');
const { hintOwner, getWordSearchHints } = require('./WordSearchHints');
const logger = require('../../config/logger');

const FOUND_TTL_SECONDS = 7200;

function foundKey(sPin, questionIndex, teamName) {
    return `game:wsteam:${sPin}:${questionIndex}:${teamName}`;
}

/** Equipo del jugador si la partida es por equipos; si no, null. */
function findWordSearchTeam(sPin, nickname, game) {
    const teamConfig = teamConfigs.get(sPin);
    if (!GameModeFactory.determineTeamMode({ teamConfig, game })) return null;
    return (teamConfig?.teams || []).find(t => Array.isArray(t.players) && t.players.includes(nickname)) || null;
}

/**
 * Contexto común de los eventos de la sopa: sala y jugador (de socket.data, no
 * del payload), partida, pregunta actual y equipo.
 * @returns {Promise<{ok: true, roomId, nickname, game, question, team}|{ok: false, reason: string}>}
 */
async function resolveWordSearchContext(socket) {
    // JoinGameCommand guarda roomId; ReconnectionService, pin (mismo sessionId)
    const room = socket?.data?.roomId || socket?.data?.pin;
    const nickname = socket?.data?.nickname;
    if (!room || !nickname) return { ok: false, reason: 'invalid-payload' };

    const roomId = String(room);
    const game = activeGames.get(roomId) || await sessionStore.load(roomId);
    const question = game?.questions?.[game.currentIndex];
    if (!question || question.question_type !== 'word_search') return { ok: false, reason: 'not-word-search' };
    if (!game.canAnswer) return { ok: false, reason: 'game-closed' };

    return { ok: true, roomId, nickname, game, question, team: findWordSearchTeam(roomId, nickname, game) };
}

/**
 * Anota una palabra encontrada por el equipo.
 * @returns {Promise<boolean>} true si nadie del equipo la había encontrado antes
 */
async function recordTeamFound(sPin, questionIndex, teamName, wordIndex, selection) {
    const key = foundKey(sPin, questionIndex, teamName);
    const redis = await getRedisClient();
    const [added] = await redis.multi()
        .hSetNX(key, String(wordIndex), JSON.stringify(selection))
        .expire(key, FOUND_TTL_SECONDS)
        .exec();
    return added === true || Number(added) > 0;
}

/**
 * Palabras encontradas por el equipo: [{ index, r1, c1, r2, c2, by }].
 * Si Redis falla devuelve [] (cada uno puntúa lo suyo).
 */
async function getTeamFound(sPin, questionIndex, teamName) {
    try {
        const redis = await getRedisClient();
        const entries = await redis.hGetAll(foundKey(sPin, questionIndex, teamName)) || {};
        return Object.entries(entries).map(([index, json]) => {
            try {
                return { index: Number(index), ...JSON.parse(json) };
            } catch {
                return null;
            }
        }).filter(entry => entry && Number.isInteger(entry.index));
    } catch (error) {
        logger.warn('No se pudieron leer las palabras del equipo', { sPin, questionIndex, teamName, error: error.message });
        return [];
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
 * Pistas y palabras compartidas con las que se puntúa la respuesta de `nickname`.
 * @returns {Promise<{hintedWords: number[], sharedFound: number[]}>}
 */
async function getWordSearchScoringContext(sPin, questionIndex, nickname, game) {
    const team = findWordSearchTeam(sPin, nickname, game);
    const hintedWords = await getWordSearchHints(sPin, questionIndex, hintOwner(nickname, team));
    const sharedFound = team ? (await getTeamFound(sPin, questionIndex, team.name)).map(f => f.index) : [];
    return { hintedWords, sharedFound };
}

module.exports = {
    findWordSearchTeam,
    resolveWordSearchContext,
    recordTeamFound,
    getTeamFound,
    emitToTeammates,
    getWordSearchScoringContext
};
