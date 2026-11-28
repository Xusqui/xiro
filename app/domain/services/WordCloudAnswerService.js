/**
 * @fileoverview «Nube de palabras» (word_cloud): encuesta sin respuesta correcta en la que cada
 * jugador envía palabras cortas. Aquí viven el agrupado de palabras parecidas y la validación de
 * cada envío. No puntúa ni toca la racha. El cupo por jugador y los repetidos se deciden aparte,
 * de forma atómica en Redis, porque necesitan el estado de todos los workers.
 *
 * @module domain/services/WordCloudAnswerService
 */

'use strict';

const { MAX_WORD_LENGTH, MAX_WORDS, cleanWord } = require('../../public/js/core/word-cloud-text');

const WORD_CLOUD = 'word_cloud';

/** Quita las tildes de un texto en minúsculas. */
function stripAccents(text) {
    return text.normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Clave de agrupado: «Madrid», «madrid » y «MADRID!» son la misma palabra; «Málaga» y «malaga»
 * también. La Ñ es otra letra, así que «año» y «ano» no se mezclan.
 * @param {*} raw - Lo que escribió el jugador
 * @returns {string} Clave, o cadena vacía si no hay letras ni números.
 */
function wordKey(raw) {
    const folded = cleanWord(raw)
        .toLowerCase()
        .normalize('NFC')
        .split('ñ')
        .map(stripAccents)
        .join('ñ');
    return folded.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

/**
 * Valida un envío (una palabra por mensaje).
 * @param {Object} params
 * @param {Object} params.question - Pregunta word_cloud
 * @param {*} params.word - Palabra enviada
 * @param {boolean} params.gameCanAnswer - Si el juego admite respuestas
 * @param {boolean} [params.allowWhenClosed] - Respuesta tardía permitida (última pregunta)
 * @returns {{ valid: boolean, reason: string|null }}
 */
function validateWordCloudAnswer({ question, word, gameCanAnswer, allowWhenClosed = false }) {
    if (!question) return { valid: false, reason: 'question-missing' };
    if (!gameCanAnswer && !allowWhenClosed) return { valid: false, reason: 'game-closed' };
    if (typeof word !== 'string') return { valid: false, reason: 'invalid-payload' };
    const clean = cleanWord(word);
    if (wordKey(clean) === '') return { valid: false, reason: 'invalid-word' };
    if (clean.length > MAX_WORD_LENGTH) return { valid: false, reason: 'word-too-long' };
    return { valid: true, reason: null };
}

/**
 * Valida el envío completo del jugador (todas sus palabras en un mensaje): que la pregunta exista,
 * se admitan respuestas y llegue de 1 a MAX_WORDS textos. El contenido de cada palabra se valida
 * aparte (validateWordCloudAnswer), para que una mala no tire las demás.
 * @param {Object} params
 * @param {Object} params.question - Pregunta word_cloud
 * @param {*} params.words - Lista de palabras enviadas
 * @param {boolean} params.gameCanAnswer - Si el juego admite respuestas
 * @param {boolean} [params.allowWhenClosed] - Respuesta tardía permitida (última pregunta)
 * @returns {{ valid: boolean, reason: string|null }}
 */
function validateWordCloudBatch({ question, words, gameCanAnswer, allowWhenClosed = false }) {
    if (!question) return { valid: false, reason: 'question-missing' };
    if (!gameCanAnswer && !allowWhenClosed) return { valid: false, reason: 'game-closed' };
    const shapeOk = Array.isArray(words) && words.length >= 1 && words.length <= MAX_WORDS && words.every(word => typeof word === 'string');
    return shapeOk ? { valid: true, reason: null } : { valid: false, reason: 'invalid-payload' };
}

/**
 * Resultado de la respuesta: sin puntos y marcado como encuesta, sin autor en el detalle.
 * @param {{ word: string }} params
 * @returns {{ isCorrect: false, pointsEarned: 0, isSurvey: true, word: string, wordKey: string, details: Object }}
 */
function processWordCloudAnswer({ word }) {
    const clean = cleanWord(word);
    const key = wordKey(clean);
    return {
        isCorrect: false,
        pointsEarned: 0,
        isSurvey: true,
        word: clean,
        wordKey: key,
        details: { strategy: WORD_CLOUD, word: clean, wordKey: key }
    };
}

module.exports = { wordKey, validateWordCloudAnswer, validateWordCloudBatch, processWordCloudAnswer };
