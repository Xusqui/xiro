/**
 * @fileoverview Guarda en la base de datos la nube final de una pregunta de «Nube de palabras»
 * al revelarla: palabras visibles agrupadas con su recuento, sin autor ni palabras ocultas.
 * Lo llama el autoguardado de la partida; un fallo aquí se registra y nunca lo rompe.
 * @module sockets/utils/WordCloudPersistence
 */

'use strict';

const logger = require('../../config/logger');
const { buildWordCloudReveal } = require('./WordCloudRevealStats');
const { saveWordCloudResults } = require('../../services/db/word-cloud-results.service');
const { questionSlot } = require('./QuestionSlot');

/**
 * Si la pregunta revelada es una nube, guarda su resultado final bajo el id de la partida.
 * @param {Object} options
 * @param {number|null} options.gameSessionId - Id de la partida en game_sessions
 * @param {string} options.roomId - Sesión
 * @param {Object} options.game - Partida activa (la pregunta en curso es la revelada)
 * @returns {Promise<void>}
 */
async function persistRevealedWordCloud({ gameSessionId, roomId, game }) {
    const question = game?.questions?.[game.currentIndex];
    if (!gameSessionId || question?.question_type !== 'word_cloud') return;
    const questionIndex = questionSlot(game);
    try {
        const { words } = await buildWordCloudReveal(roomId, questionIndex);
        await saveWordCloudResults({ gameSessionId, questionIndex, words });
    } catch (error) {
        logger.error('No se pudo guardar la nube de palabras revelada', { roomId, error: error.message });
    }
}

module.exports = { persistRevealedWordCloud };
