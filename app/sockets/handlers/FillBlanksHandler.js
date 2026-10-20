/**
 * @fileoverview Eventos de «Completa la frase» (fill_blanks) durante la pregunta.
 *
 * - 'fill-blanks-hint' { blankIndex }: destapa una letra del hueco (primera, última,
 *   central). Queda anotada en Redis para puntuar la palabra al 70/40/25 %. En
 *   equipos la pista es del equipo y se reenvía ('fill-blanks-team-hint').
 *   Respuesta: { ok, blankIndex, position, letter, hintCount, factor } | { ok: false, reason }.
 * - 'fill-blanks-check' { blankIndex, word }: solo en equipos. Comprueba la palabra;
 *   si es correcta la bloquea para el equipo y la reenvía ('fill-blanks-team-solved').
 *   Respuesta: { ok: true, correct, blankIndex, word? } | { ok: false, reason }.
 * - 'fill-blanks-sync': lo que ya tiene el jugador o su equipo (pistas, huecos
 *   resueltos, envío del equipo), al pintar la pregunta o tras reconectar.
 *
 * La identidad sale de socket.data, nunca del payload. Las comprobaciones llevan
 * un límite por socket: el reintento es libre, pero no a ráfagas.
 */

'use strict';

const { getQuestionWords, isBlankCorrect, getHintLetter, LIMITS } = require('../../domain/services/FillBlanksService');
const { isValidBlankIndex, isValidWordsPayload } = require('../../application/validators/FillBlanksQuestionValidator');
const FB = require('../../public/js/core/fill-blanks-text.js');
const team = require('../utils/FillBlanksTeam');
const { questionSlot } = require('../utils/QuestionSlot');
const logger = require('../../config/logger');

const CHECK_WINDOW_MS = 2000;
const CHECK_MAX_PER_WINDOW = 8;
const recentChecks = new Map(); // socket.id → timestamps

function replier(callback) {
    return typeof callback === 'function' ? callback : () => {};
}

function isRateLimited(socketId, now = Date.now()) {
    const stamps = (recentChecks.get(socketId) || []).filter(t => now - t < CHECK_WINDOW_MS);
    stamps.push(now);
    recentChecks.set(socketId, stamps);
    if (recentChecks.size > 5000) recentChecks.clear(); // sin fugas en partidas largas
    return stamps.length > CHECK_MAX_PER_WINDOW;
}

/** Letras destapadas en un hueco tras `count` pistas: [{ position, letter }] */
function hintLetters(question, blankIndex, count) {
    const letters = [];
    for (let n = 0; n < count; n++) {
        const hint = getHintLetter(question, blankIndex, n);
        if (hint) letters.push(hint);
    }
    return letters;
}

async function handleFillBlanksHint(socket, data, callback) {
    const reply = replier(callback);
    const blankIndex = Number(data?.blankIndex);
    if (!isValidBlankIndex(blankIndex)) return reply({ ok: false, reason: 'invalid-payload' });

    try {
        const ctx = await team.resolveFillBlanksContext(socket);
        if (!ctx.ok) return reply({ ok: false, reason: ctx.reason });
        const { roomId, nickname, game, question, team: playerTeam } = ctx;
        if (!getQuestionWords(question)[blankIndex]) return reply({ ok: false, reason: 'invalid-blank' });

        if (playerTeam) {
            const solved = await team.getTeamSolved(roomId, questionSlot(game), playerTeam.name);
            if (solved.some(entry => entry.blankIndex === blankIndex))
                return reply({ ok: false, reason: 'already-solved' });
        }

        const owner = team.hintOwner(nickname, playerTeam);
        const { count, granted } = await team.recordHint(roomId, questionSlot(game), owner, blankIndex);
        if (!granted) return reply({ ok: false, reason: 'no-hints-left', hintCount: count });

        const letter = getHintLetter(question, blankIndex, count - 1);
        const hint = {
            blankIndex,
            position: letter.position,
            letter: letter.letter,
            hintCount: count,
            factor: FB.hintFactor(count)
        };
        if (playerTeam) {
            team.emitToTeammates({ io: socket.nsp, roomId, team: playerTeam, nickname }, 'fill-blanks-team-hint', {
                ...hint,
                by: nickname
            });
        }
        return reply({ ok: true, ...hint });
    } catch (error) {
        logger.error('Error al dar pista de Completa la frase', { socketId: socket?.id, error: error.message });
        return reply({ ok: false, reason: 'error' });
    }
}

async function handleFillBlanksCheck(socket, data, callback) {
    const reply = replier(callback);
    const blankIndex = Number(data?.blankIndex);
    const word = typeof data?.word === 'string' ? data.word : '';
    if (!isValidBlankIndex(blankIndex) || !isValidWordsPayload([word]))
        return reply({ ok: false, reason: 'invalid-payload' });
    if (isRateLimited(socket.id)) return reply({ ok: false, reason: 'rate-limited' });

    try {
        const ctx = await team.resolveFillBlanksContext(socket);
        if (!ctx.ok) return reply({ ok: false, reason: ctx.reason });
        const { roomId, nickname, game, question, team: playerTeam } = ctx;
        if (!playerTeam) return reply({ ok: false, reason: 'not-team' });

        if (!isBlankCorrect(question, blankIndex, word)) return reply({ ok: true, correct: false, blankIndex });

        const normalized = FB.normalizeWord(word);
        const isNew = await team.recordTeamSolved(roomId, questionSlot(game), playerTeam.name, blankIndex, {
            word: normalized,
            by: nickname
        });
        if (isNew) {
            team.emitToTeammates({ io: socket.nsp, roomId, team: playerTeam, nickname }, 'fill-blanks-team-solved', {
                blankIndex,
                word: normalized,
                by: nickname
            });
        }
        return reply({ ok: true, correct: true, blankIndex, word: normalized, isNew });
    } catch (error) {
        logger.error('Error al comprobar un hueco de Completa la frase', {
            socketId: socket?.id,
            error: error.message
        });
        return reply({ ok: false, reason: 'error' });
    }
}

async function handleFillBlanksSync(socket, _data, callback) {
    const reply = replier(callback);
    try {
        const ctx = await team.resolveFillBlanksContext(socket);
        if (!ctx.ok) return reply({ ok: false, reason: ctx.reason });
        const { roomId, nickname, game, question, team: playerTeam } = ctx;

        const words = getQuestionWords(question);
        const counts = await team.getHintCounts(
            roomId,
            questionSlot(game),
            team.hintOwner(nickname, playerTeam),
            words.length
        );
        const hints = counts
            .map((count, blankIndex) => ({
                blankIndex,
                hintCount: count,
                factor: FB.hintFactor(count),
                letters: hintLetters(question, blankIndex, count)
            }))
            .filter(h => h.hintCount > 0);

        const solved = playerTeam ? await team.getTeamSolved(roomId, questionSlot(game), playerTeam.name) : [];
        const submitted = playerTeam ? await team.getTeamSubmit(roomId, questionSlot(game), playerTeam.name) : null;
        return reply({
            ok: true,
            team: Boolean(playerTeam),
            maxHints: LIMITS.MAX_HINTS_PER_BLANK,
            hints,
            solved,
            submitted
        });
    } catch (error) {
        logger.error('Error al sincronizar Completa la frase', { socketId: socket?.id, error: error.message });
        return reply({ ok: false, reason: 'error' });
    }
}

module.exports = {
    handleFillBlanksHint,
    handleFillBlanksCheck,
    handleFillBlanksSync,
    hintLetters
};
