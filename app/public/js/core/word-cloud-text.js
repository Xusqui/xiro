/**
 * @fileoverview Reglas de texto de «Nube de palabras» (word_cloud), compartidas por servidor y
 * clientes: límites y limpieza de lo que escribe el jugador. El agrupado de palabras parecidas
 * (sin tildes ni signos) vive en el servidor: domain/services/WordCloudAnswerService.js.
 * Para webOS 3.5 (tv.html): nada de =>, plantillas, ?., ?? ni spread (lo vigila ESLint).
 * Expone window.XiroWordCloudText y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    const MAX_WORD_LENGTH = 20;
    const MIN_WORDS = 1;
    const MAX_WORDS = 5;
    const DEFAULT_MAX_WORDS = 1;

    /**
     * Texto sin espacios sobrantes (los de dentro se reducen a uno).
     * @param {*} raw
     * @returns {string} Cadena vacía si no es texto.
     */
    function cleanWord(raw) {
        if (typeof raw !== 'string') return '';
        return raw.replace(/\s+/g, ' ').trim();
    }

    /**
     * @param {*} raw
     * @returns {boolean} Si, ya limpio, tiene entre 1 y 20 caracteres.
     */
    function isValidWord(raw) {
        const word = cleanWord(raw);
        return word.length > 0 && word.length <= MAX_WORD_LENGTH;
    }

    const api = Object.freeze({
        MAX_WORD_LENGTH: MAX_WORD_LENGTH,
        MIN_WORDS: MIN_WORDS,
        MAX_WORDS: MAX_WORDS,
        DEFAULT_MAX_WORDS: DEFAULT_MAX_WORDS,
        cleanWord: cleanWord,
        isValidWord: isValidWord
    });

    root.XiroWordCloudText = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
