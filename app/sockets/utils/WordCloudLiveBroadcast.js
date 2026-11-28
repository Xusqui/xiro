/**
 * @fileoverview Nube de palabras en directo para el presentador, la TV y el mando (sala
 * `<sesión>:presenter`). Cada palabra aceptada pide una actualización, pero las ráfagas se juntan
 * en un solo envío por intervalo: con muchos jugadores escribiendo a la vez no se emite un mensaje
 * por palabra. Cada worker junta las suyas y todos leen el mismo recuento de Redis, así que lo
 * que llega a las pantallas converge aunque varios workers emitan.
 * Evento: 'word-cloud-update' { questionIndex, words: [{key, text, count}], total }.
 * También lo reciben los jugadores que ya enviaron sus palabras (sala de esa pregunta): quien aún
 * no ha enviado no ve la nube, para que lo que escriben otros no le influya.
 */

'use strict';

const logger = require('../../config/logger');
const { buildWordCloudReveal } = require('./WordCloudRevealStats');
const { questionSlot } = require('./QuestionSlot');

const DEFAULT_INTERVAL_MS = 400;

/**
 * Sala de los jugadores que ya enviaron sus palabras en una pregunta. Lleva el índice: al pasar
 * a otra pregunta no se emite a la anterior y nadie ve una nube que no es la suya.
 * @param {string} sessionId
 * @param {string|number} questionIndex
 * @returns {string}
 */
function wordCloudViewersRoom(sessionId, questionIndex) {
    return `${sessionId}:wc:${questionIndex}`;
}

/**
 * @param {Object} options
 * @param {Object} options.io - Socket.IO
 * @param {function(string, string|number): Promise<{words: Array, total: number}>} [options.buildReveal]
 * @param {number} [options.intervalMs=400] - Tiempo en que se juntan las palabras antes de emitir
 * @returns {{schedule: function(string, string|number): void, flush: function(string, string|number): Promise<void>}}
 */
function createWordCloudBroadcaster({ io, buildReveal = buildWordCloudReveal, intervalMs = DEFAULT_INTERVAL_MS }) {
    const pending = new Map();

    async function emitNow(sessionId, questionIndex) {
        try {
            const cloud = await buildReveal(sessionId, questionIndex);
            io.to(`${sessionId}:presenter`)
                .to(wordCloudViewersRoom(sessionId, questionIndex))
                .emit('word-cloud-update', { questionIndex, ...cloud });
        } catch (error) {
            logger.warn('No se pudo emitir la nube de palabras', { roomId: sessionId, error: error.message });
        }
    }

    function schedule(sessionId, questionIndex) {
        const key = `${sessionId}:${questionIndex}`;
        if (pending.has(key)) return;
        const timer = setTimeout(() => {
            pending.delete(key);
            emitNow(sessionId, questionIndex);
        }, intervalMs);
        pending.set(key, timer);
    }

    async function flush(sessionId, questionIndex) {
        const key = `${sessionId}:${questionIndex}`;
        clearTimeout(pending.get(key));
        pending.delete(key);
        await emitNow(sessionId, questionIndex);
    }

    return { schedule, flush };
}

const broadcasters = new WeakMap();

function broadcasterFor(io) {
    if (!broadcasters.has(io)) broadcasters.set(io, createWordCloudBroadcaster({ io }));
    return broadcasters.get(io);
}

/** Pide una actualización de la nube de la pregunta (se junta con las demás del intervalo). */
function scheduleWordCloudUpdate(io, sessionId, questionIndex) {
    broadcasterFor(io).schedule(sessionId, questionIndex);
}

/** Emite ya la nube de la pregunta (p. ej. tras ocultar una palabra). */
function flushWordCloudUpdate(io, sessionId, questionIndex) {
    return broadcasterFor(io).flush(sessionId, questionIndex);
}

/**
 * Repinta la nube en curso (p. ej. cuando el presentador reconecta con la pregunta abierta).
 * Solo si la pregunta actual es una nube y sigue abierta; ya cerrada, el reveal lleva la nube final.
 * @param {Object} io - Socket.IO
 * @param {string} sessionId
 * @param {Object|undefined} game - Partida activa
 * @returns {Promise<void>}
 */
async function flushActiveWordCloud(io, sessionId, game) {
    const question = game?.questions?.[game.currentIndex];
    if (question?.question_type !== 'word_cloud' || !game.canAnswer) return;
    await flushWordCloudUpdate(io, sessionId, questionSlot(game));
}

module.exports = {
    createWordCloudBroadcaster,
    scheduleWordCloudUpdate,
    flushWordCloudUpdate,
    flushActiveWordCloud,
    wordCloudViewersRoom
};
