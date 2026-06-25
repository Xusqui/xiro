/**
 * @fileoverview Servicio de dominio para preguntas tipo word_scramble
 * Generación de letras barajadas y cálculo de puntuación
 *
 * ARQUITECTURA: Domain Service (Clean Architecture)
 * - Funciones puras y testeables
 * - Sin dependencias de infraestructura
 */

const GAME_CONSTANTS = require('../../config/game-constants');
const { SCORING } = GAME_CONSTANTS;

// Alfabeto de letras extra (frecuentes en español)
const ALPHABET = 'ABCDEFGHIJKLMNOPRSTUVWXZ';
const VOWELS = 'AEIOU';

/**
 * Normaliza una palabra: mayúsculas, sin tildes vocálicas, conserva Ñ
 * @param {string} word
 * @returns {string}
 */
function normalizeWord(word) {
    if (!word) return '';
    return word.toUpperCase()
        .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I')
        .replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ü/g, 'U')
        .replace(/[^A-ZÑ]/g, '');
}

/**
 * Baraja un array de forma parcial: solo la mitad de intercambios aleatorios.
 * Deja ~40-50% de elementos cerca de su posición original, haciendo el anagrama
 * más asequible sin ser completamente predecible.
 * @param {Array} arr
 * @returns {Array}
 */
function softShuffleArray(arr) {
    const result = [...arr];
    const swaps = Math.floor(result.length / 2);
    for (let i = 0; i < swaps; i++) {
        const a = Math.floor(Math.random() * result.length);
        const b = Math.floor(Math.random() * result.length);
        [result[a], result[b]] = [result[b], result[a]];
    }
    return result;
}

/**
 * Genera un array de exactamente 10 letras barajadas
 * que contienen todas las letras de la palabra correcta + letras extra aleatorias
 *
 * @param {string} correctWord - Palabra correcta (7-10 letras)
 * @returns {string[]} Array de 10 letras en orden aleatorio
 */
function generateScrambledLetters(correctWord) {
    const normalized = normalizeWord(correctWord);
    const wordLetters = [...normalized];
    const wordLength = wordLetters.length;
    const extraCount = Math.max(0, 10 - wordLength);

    const extraLetters = [];
    const vowelCount = wordLetters.filter(l => VOWELS.includes(l)).length;

    for (let i = 0; i < extraCount; i++) {
        let letter;
        let attempts = 0;
        do {
            // Garantizar al menos una vocal extra si hay pocas
            const pool = (i === 0 && vowelCount < 2) ? VOWELS : ALPHABET;
            letter = pool[Math.floor(Math.random() * pool.length)];
            attempts++;
        } while (attempts < 20 && extraLetters.filter(l => l === letter).length >= 2);
        extraLetters.push(letter);
    }

    return softShuffleArray([...wordLetters, ...extraLetters]);
}

/**
 * Procesa una respuesta de tipo word_scramble y calcula puntuación
 *
 * Puntuación: 20 puntos base (correcta) + bonus de tiempo (hasta 20 pts)
 *
 * @param {Object} params
 * @param {string} params.correctWord - Palabra correcta almacenada
 * @param {string} params.playerAnswer - Respuesta del jugador
 * @param {number} params.gameStartTime - Timestamp inicio pregunta (ms)
 * @param {number} [params.currentTime] - Timestamp actual (ms)
 * @param {number} params.questionTimeLimit - Límite de tiempo (s)
 * @returns {Object} { isCorrect, pointsEarned, isSurvey, details }
 */
function processWordScrambleAnswer({
    correctWord,
    playerAnswer,
    gameStartTime,
    currentTime = Date.now(),
    questionTimeLimit
}) {
    const normalizedCorrect = normalizeWord(correctWord);
    const normalizedAnswer = normalizeWord(playerAnswer || '');
    const isCorrect = normalizedCorrect === normalizedAnswer && normalizedCorrect.length > 0;

    if (!isCorrect) {
        return {
            isCorrect: false,
            pointsEarned: 0,
            isSurvey: false,
            details: { strategy: 'word_scramble', normalizedAnswer, normalizedCorrect }
        };
    }

    const timeElapsed = (currentTime - gameStartTime) / 1000;
    const timeLeft = Math.max(0, (questionTimeLimit || 30) - timeElapsed);
    const timeRatio = (questionTimeLimit || 30) > 0 ? timeLeft / (questionTimeLimit || 30) : 0;
    const timeBonus = Math.round(timeRatio * SCORING.MAX_TIME_BONUS * 100) / 100;
    const pointsEarned = Math.round((SCORING.BASE_POINTS + timeBonus) * 100) / 100;

    return {
        isCorrect: true,
        pointsEarned,
        isSurvey: false,
        details: { strategy: 'word_scramble', timeElapsed, timeBonus }
    };
}

module.exports = {
    generateScrambledLetters,
    processWordScrambleAnswer,
    normalizeWord
};
