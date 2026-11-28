/**
 * @fileoverview Envío de «Nube de palabras»: un solo mensaje con todas las palabras que el jugador
 * rellenó (de 1 al máximo de la pregunta), que además le da por terminado. Camino propio, fuera de
 * la cadena de puntuación: no hay puntos, rachas, "ya respondió" ni cerrojo de respuesta. El cupo
 * y las repetidas los decide Redis de forma atómica palabra a palabra (WordCloudSubmissions); las
 * aceptadas se suman al recuento que ven las pantallas (WordCloudRevealStats). Quien ha enviado
 * se une a la nube en directo de la pregunta y recibe la actual en la respuesta. Si con esto ya
 * han terminado todos, la pregunta se cierra sin esperar al tiempo.
 * @module application/commands/submit-answer/wordCloudSubmit
 */

'use strict';

const logger = require('../../../config/logger');
const { processWordCloudAnswer, validateWordCloudAnswer } = require('../../../domain/services/WordCloudAnswerService');
const { submitWord, isFinished, markFinished } = require('../../../sockets/utils/WordCloudSubmissions');
const { recordWord, buildWordCloudReveal } = require('../../../sockets/utils/WordCloudRevealStats');
const { questionSlot } = require('../../../sockets/utils/QuestionSlot');
const { isBannedWord } = require('../../../domain/services/WordCloudBannedWords');
const { scheduleWordCloudUpdate, wordCloudViewersRoom } = require('../../../sockets/utils/WordCloudLiveBroadcast');
const { closeWhenQuotaExhausted } = require('../../../sockets/utils/WordCloudEarlyClose');

const DEFAULT_MAX_WORDS = 1;
const REJECTIONS = Object.freeze({ duplicate: 'duplicate-word', 'quota-full': 'quota-full' });

class WordCloudUnavailableError extends Error {}

/**
 * Procesa una palabra del lote: forma, prohibidas y cupo (Redis). No lanza por rechazos normales.
 * @returns {Promise<{accepted: boolean, text: string, reason?: string}>}
 * @throws {WordCloudUnavailableError} Si falla Redis
 */
async function processOneWord({ rawWord, question, room, maxWords }) {
    const { word, wordKey } = processWordCloudAnswer({ word: rawWord });
    const shape = validateWordCloudAnswer({ question, word: rawWord, gameCanAnswer: true });
    if (!shape.valid) return { accepted: false, text: word || String(rawWord), reason: shape.reason };
    // Antes de pedir cupo: una palabra prohibida no gasta intentos ni llega a la nube
    if (isBannedWord(wordKey)) return { accepted: false, text: word, reason: 'word-not-allowed' };
    let outcome;
    try {
        outcome = await submitWord({ ...room, wordKey, maxWords });
    } catch (error) {
        logger.error('Nube de palabras: no se pudo comprobar el cupo', { roomId: room.sessionId, error: error.message });
        throw new WordCloudUnavailableError(error.message);
    }
    if (outcome.status !== 'accepted') return { accepted: false, text: word, reason: REJECTIONS[outcome.status] };
    await recordWord({ sessionId: room.sessionId, questionIndex: room.questionIndex, wordKey, text: word });
    return { accepted: true, text: word };
}

async function alreadyFinished(room) {
    try {
        return await isFinished(room);
    } catch (error) {
        logger.error('Nube de palabras: no se pudo comprobar si el jugador terminó', { roomId: room.sessionId, error: error.message });
        return false;
    }
}

// La nube actual viaja en la respuesta; si no se puede leer, el jugador la recibirá con las siguientes
async function currentCloud(room) {
    try {
        return await buildWordCloudReveal(room.sessionId, room.questionIndex);
    } catch (error) {
        logger.warn('Nube de palabras: no se pudo leer la nube actual', { roomId: room.sessionId, error: error.message });
        return undefined;
    }
}

async function runBatch({ words, question, room, maxWords }) {
    const results = [];
    for (const rawWord of words) {
        results.push(await processOneWord({ rawWord, question, room, maxWords }));
    }
    return results;
}

/**
 * Registra las palabras de un jugador y le da por terminado.
 * @param {Object} input
 * @param {Object} input.payload - `{ answerType: 'word_cloud', words: string[] }` ya validado
 * @param {Object} input.game - Partida en memoria
 * @param {Object} [input.socket] - Socket del jugador: se une a la sala de la nube en directo
 * @param {string} input.nickname - Jugador (identidad del servidor)
 * @param {string} input.sPin - Sesión
 * @param {Object} input.flags - Banderas de la pregunta (currentQuestion)
 * @param {Object} input.io - Servidor Socket.IO
 * @param {Function} [input.clearGameTimer] - Para el cronómetro si la pregunta se cierra antes de tiempo
 * @returns {Promise<{success: boolean, late?: boolean, reason?: string, wordCloud?: {status: 'finished',
 *   accepted: string[], rejected: Array<{word: string, reason: string}>, cloud?: Object}}>}
 */
async function submitWordCloudAnswer({ payload, game, socket, nickname, sPin, flags, io, clearGameTimer }) {
    if (game?.ended) return { success: true, late: true };
    if (game?.reviewMode) return { success: false, reason: 'review-mode' };

    const question = flags.currentQuestion;
    const maxWords = question.max_words || DEFAULT_MAX_WORDS;
    const questionIndex = questionSlot(game);
    const room = { sessionId: sPin, questionIndex, nickname };
    // Las palabras son definitivas: tras enviar no se admiten más
    if (await alreadyFinished(room)) return { success: false, reason: 'already-finished' };

    let results;
    try {
        results = await runBatch({ words: payload.words, question, room, maxWords });
    } catch (error) {
        if (error instanceof WordCloudUnavailableError) return { success: false, reason: 'wordcloud-unavailable' };
        throw error;
    }
    const accepted = results.filter(result => result.accepted);
    if (accepted.length === 0) return { success: false, reason: results[0].reason };

    await markFinished(room);
    socket?.join(wordCloudViewersRoom(sPin, questionIndex));
    scheduleWordCloudUpdate(io, sPin, questionIndex);
    // Quien termina puede ser el último: si todos terminaron, se cierra sin esperar al tiempo
    await closeWhenQuotaExhausted({ io, game, sPin, questionIndex, maxWords, clearGameTimer });
    const rejected = results.filter(result => !result.accepted).map(result => ({ word: result.text, reason: result.reason }));
    const cloud = await currentCloud(room);
    return {
        success: true,
        wordCloud: { status: 'finished', accepted: accepted.map(result => result.text), rejected, ...(cloud ? { cloud } : {}) }
    };
}

module.exports = { submitWordCloudAnswer };
