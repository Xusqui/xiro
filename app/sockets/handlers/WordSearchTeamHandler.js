/**
 * @fileoverview Sopa de letras en equipos.
 *
 * - 'word-search-found' { r1, c1, r2, c2 }: un miembro ha encontrado una palabra.
 *   El servidor vuelve a leer las letras en su rejilla; si forman una palabra la
 *   anota para el equipo y la envía a los compañeros ('word-search-team-found').
 *   Respuesta: { ok: true, wordIndex, isNew } | { ok: false, reason }.
 * - 'word-search-sync': al pintar la pregunta (o tras reconectar) devuelve lo que
 *   ya tiene el equipo o el jugador: { ok, team, found: [...], hints: [...] }.
 *
 * La identidad sale de socket.data, nunca del payload.
 */

'use strict';

const { matchSelection, getWordStart } = require('../../domain/services/WordSearchService');
const { hintOwner, getWordSearchHints } = require('../utils/WordSearchHints');
const {
    resolveWordSearchContext,
    recordTeamFound,
    getTeamFound,
    emitToTeammates
} = require('../utils/WordSearchTeam');
const logger = require('../../config/logger');

function replier(callback) {
    return typeof callback === 'function' ? callback : () => {};
}

function pickSelection(data) {
    return { r1: data?.r1, c1: data?.c1, r2: data?.r2, c2: data?.c2 };
}

async function handleWordSearchFound(socket, data, callback) {
    const reply = replier(callback);
    try {
        const ctx = await resolveWordSearchContext(socket);
        if (!ctx.ok) return reply({ ok: false, reason: ctx.reason });
        const { roomId, nickname, game, question, team } = ctx;
        if (!team) return reply({ ok: false, reason: 'not-team' });

        const selection = pickSelection(data);
        const wordIndex = matchSelection(question, selection);
        if (wordIndex === -1) return reply({ ok: false, reason: 'invalid-word' });

        const isNew = await recordTeamFound(roomId, game.currentIndex, team.name, wordIndex, { ...selection, by: nickname });
        if (isNew) {
            emitToTeammates({ io: socket.nsp, roomId, team, nickname }, 'word-search-team-found', { wordIndex, ...selection, by: nickname });
        }
        return reply({ ok: true, wordIndex, isNew });
    } catch (error) {
        logger.error('Error al compartir palabra de sopa de letras', { socketId: socket?.id, error: error.message });
        return reply({ ok: false, reason: 'error' });
    }
}

async function handleWordSearchSync(socket, _data, callback) {
    const reply = replier(callback);
    try {
        const ctx = await resolveWordSearchContext(socket);
        if (!ctx.ok) return reply({ ok: false, reason: ctx.reason });
        const { roomId, nickname, game, question, team } = ctx;

        const hintIndexes = await getWordSearchHints(roomId, game.currentIndex, hintOwner(nickname, team));
        const hints = hintIndexes
            .map(wordIndex => ({ wordIndex, start: getWordStart(question, wordIndex) }))
            .filter(h => h.start)
            .map(h => ({ wordIndex: h.wordIndex, row: h.start.row, col: h.start.col }));
        const found = team
            ? (await getTeamFound(roomId, game.currentIndex, team.name))
                .map(({ index, r1, c1, r2, c2, by }) => ({ wordIndex: index, r1, c1, r2, c2, by }))
            : [];

        return reply({ ok: true, team: Boolean(team), found, hints });
    } catch (error) {
        logger.error('Error al sincronizar sopa de letras', { socketId: socket?.id, error: error.message });
        return reply({ ok: false, reason: 'error' });
    }
}

module.exports = {
    handleWordSearchFound,
    handleWordSearchSync
};
