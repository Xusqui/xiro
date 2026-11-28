/**
 * @fileoverview Evento 'word-cloud-hide' { wordKey } de «Nube de palabras»: el presentador oculta
 * a mano una palabra de la pregunta en curso. Solo vale desde la sala `<sesión>:presenter` (presentador,
 * TV y mando) y solo si la pregunta actual es una nube. Tras ocultar se emite ya la nube actualizada.
 * @module sockets/handlers/WordCloudHandler
 */

'use strict';

const logger = require('../../config/logger');
const { questionSlot } = require('../utils/QuestionSlot');

const MAX_WORD_KEY_LENGTH = 100;

/**
 * Indica si el socket pertenece a la sala del presentador de su sesión.
 * @param {Object} socket - Socket de Socket.IO
 * @param {string|undefined} roomId - Sesión del socket
 * @returns {boolean}
 */
function isPresenterSocket(socket, roomId) {
    return Boolean(roomId) && socket.rooms?.has(`${roomId}:presenter`) === true;
}

/**
 * @param {*} data - Payload recibido
 * @returns {boolean} true si trae un `wordKey` de texto, no vacío y de longitud razonable
 */
function isValidPayload(data) {
    const wordKey = data?.wordKey;
    return typeof wordKey === 'string' && wordKey.length > 0 && wordKey.length <= MAX_WORD_KEY_LENGTH;
}

/**
 * Comprueba que la pregunta en curso de la partida sea una nube.
 * @param {Object|undefined} game - Partida activa
 * @returns {'game-not-found'|'not-word-cloud'|null} Motivo de rechazo, o null si vale
 */
function checkCloudQuestion(game) {
    if (!game) return 'game-not-found';
    const question = game.questions?.[game.currentIndex];
    return question?.question_type === 'word_cloud' ? null : 'not-word-cloud';
}

/**
 * Crea los manejadores de la nube de palabras del presentador.
 * @param {Object} deps
 * @param {Object} deps.io - Servidor Socket.IO
 * @param {Map<string, Object>} deps.activeGames - Partidas activas por sesión
 * @param {Function} deps.hideWord - Marca una palabra como oculta (WordCloudRevealStats.hideWord)
 * @param {Function} deps.flushWordCloudUpdate - Emite ya la nube (WordCloudLiveBroadcast)
 * @returns {{handleHideWord: Function}}
 */
function createWordCloudHandlers({ io, activeGames, hideWord, flushWordCloudUpdate }) {
    /**
     * @param {Object} socket - Socket del presentador
     * @param {{wordKey: string}} data - Palabra a ocultar (clave de agrupación)
     * @param {Function} [callback] - Ack opcional `{ok, reason?}`
     * @returns {Promise<void>}
     */
    async function handleHideWord(socket, data, callback) {
        const reply = typeof callback === 'function' ? callback : () => {};
        const roomId = socket.data?.roomId;
        if (!isPresenterSocket(socket, roomId)) return reply({ ok: false, reason: 'not-presenter' });
        if (!isValidPayload(data)) return reply({ ok: false, reason: 'invalid-payload' });

        const game = activeGames.get(roomId);
        const rejection = checkCloudQuestion(game);
        if (rejection) return reply({ ok: false, reason: rejection });

        const questionIndex = questionSlot(game);
        try {
            await hideWord({ sessionId: roomId, questionIndex, wordKey: data.wordKey });
            await flushWordCloudUpdate(io, roomId, questionIndex);
        } catch (error) {
            logger.error('Nube de palabras: no se pudo ocultar la palabra', { roomId, error: error.message });
            return reply({ ok: false, reason: 'error' });
        }
        return reply({ ok: true });
    }

    return { handleHideWord };
}

/**
 * Engancha el evento del presentador al manejador.
 * @param {Object} socket - Socket de Socket.IO
 * @param {{handleHideWord: Function}} handlers - Manejadores de la nube
 * @returns {void}
 */
function registerWordCloudEvents(socket, handlers) {
    socket.on('word-cloud-hide', (data, callback) => handlers.handleHideWord(socket, data, callback));
}

module.exports = { createWordCloudHandlers, registerWordCloudEvents };
