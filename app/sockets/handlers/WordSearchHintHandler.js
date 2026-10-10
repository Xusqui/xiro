/**
 * @fileoverview Evento 'word-search-hint': el jugador pide dónde empieza una palabra.
 *
 * La identidad sale de socket.data (no del payload) y la casilla, de la rejilla del
 * servidor: las posiciones nunca se envían enteras al móvil. La pista queda anotada
 * en Redis para puntuar esa palabra a mitad (WordSearchHints). En equipos la pista
 * es del equipo: vale la mitad para todos y se envía a los compañeros
 * ('word-search-team-hint').
 * Respuesta por callback: { ok: true, wordIndex, row, col } | { ok: false, reason }.
 */

'use strict';

const { getWordStart } = require('../../domain/services/WordSearchService');
const { hintOwner, recordWordSearchHint } = require('../utils/WordSearchHints');
const { resolveWordSearchContext, emitToTeammates } = require('../utils/WordSearchTeam');
const logger = require('../../config/logger');

/**
 * @param {Object} socket
 * @param {{ wordIndex: number }} data
 * @param {Function} [callback]
 */
async function handleWordSearchHint(socket, data, callback) {
    const reply = typeof callback === 'function' ? callback : () => {};
    const wordIndex = Number(data?.wordIndex);
    if (!Number.isInteger(wordIndex)) {
        return reply({ ok: false, reason: 'invalid-payload' });
    }

    try {
        const ctx = await resolveWordSearchContext(socket);
        if (!ctx.ok) return reply({ ok: false, reason: ctx.reason });
        const { roomId, nickname, game, question, team } = ctx;

        const start = getWordStart(question, wordIndex);
        if (!start) {
            return reply({ ok: false, reason: 'invalid-word' });
        }

        const isNew = await recordWordSearchHint(roomId, game.currentIndex, hintOwner(nickname, team), wordIndex);
        const hint = { wordIndex, row: start.row, col: start.col };
        if (team && isNew) {
            emitToTeammates({ io: socket.nsp, roomId, team, nickname }, 'word-search-team-hint', { ...hint, by: nickname });
        }
        return reply({ ok: true, ...hint });
    } catch (error) {
        logger.error('Error al dar pista de sopa de letras', { socketId: socket?.id, error: error.message });
        return reply({ ok: false, reason: 'error' });
    }
}

module.exports = {
    handleWordSearchHint
};
