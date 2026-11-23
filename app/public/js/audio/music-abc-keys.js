/**
 * @fileoverview ABC y la canción de XiRo: nombres de tonalidades (con su armadura) y de acordes, lectura
 * del campo K: (los modos que no son mayor ni menor se aproximan al relativo con la misma armadura) y
 * de los símbolos de acorde entre comillas. Datos puros, sin DOM.
 *
 * Export dual (Jest/Node con require; navegador en self.XiroMusic.abcKeys).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.abcKeys = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const LETTERS = 'CDEFGAB';
    const LETTER_PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    // Nombres con la armadura más corta: Si♭ mayor (2 bemoles) pero Do♯ menor (4 sostenidos)
    const NAMES = {
        major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
        minor: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
    };
    const CHORD_SUFFIX = {
        maj: '', min: 'm', maj7: 'maj7', min7: 'm7', dom7: '7', sus2: 'sus2', sus4: 'sus4',
        add9: 'add9', six: '6', dim: 'dim', aug: 'aug', m7b5: 'm7b5'
    };
    // Sufijo escrito -> calidad. Las extensiones (9, m9, maj9) se aproximan a la séptima que las contiene.
    const SUFFIX_QUALITY = {
        '': 'maj', maj: 'maj', M: 'maj', m: 'min', min: 'min', '-': 'min',
        maj7: 'maj7', M7: 'maj7', maj9: 'maj7', m7: 'min7', min7: 'min7', '-7': 'min7', m9: 'min7',
        7: 'dom7', dom7: 'dom7', 9: 'dom7', sus2: 'sus2', sus4: 'sus4', sus: 'sus4', add9: 'add9',
        6: 'six', maj6: 'six', dim: 'dim', o: 'dim', aug: 'aug', '+': 'aug', m7b5: 'm7b5', 'ø': 'm7b5'
    };
    // Modo escrito -> [semitonos de la tónica al relativo mayor, ¿suena a mayor?]
    const MODES = {
        '': [0, true], maj: [0, true], major: [0, true], ion: [0, true], lyd: [7, true], mix: [5, true],
        m: [3, false], min: [3, false], minor: [3, false], aeo: [3, false], dor: [10, false], phr: [8, false], loc: [1, false]
    };
    const FIFTHS_BY_PITCH_CLASS = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
    const PLAIN_MODES = ['', 'maj', 'major', 'ion', 'ionian', 'm', 'min', 'minor', 'aeo', 'aeolian'];
    const KEY_PATTERN = /^([A-G])([#b]?)\s*([A-Za-z]*)\b/;
    const CHORD_PATTERN = /^([A-G])([#b]?)([^/]*)(?:\/[A-G][#b]?)?$/;

    const pitchClassOf = (letter, accidental) => (LETTER_PITCH_CLASS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + 12) % 12;

    /**
     * Nombre de una tonalidad en ABC («Am», «Bb», «F#m»).
     * @param {number} tonic 0-11 (Do = 0)
     * @param {string} mode 'major' | 'minor'
     * @returns {string}
     */
    function keyText(tonic, mode) {
        return NAMES[mode][tonic] + (mode === 'minor' ? 'm' : '');
    }

    /**
     * Lee el campo K: de ABC. Los modos distintos de mayor y menor se aproximan al mayor o menor con la
     * misma armadura (la escala se conserva; el centro tonal puede cambiar).
     * @param {string} text Valor de K: («Am», «D dor», «F#m»…)
     * @returns {?{tonic: number, mode: string, relativeMajor: number, fifths: number, approximated: boolean}} null si no se entiende
     */
    function parseKey(text) {
        const match = KEY_PATTERN.exec(String(text).trim());
        if (!match) return null;
        const word = match[3].toLowerCase();
        const spec = MODES[word] || MODES[word.slice(0, 3)];
        if (!spec) return null;
        const [offset, major] = spec;
        const relativeMajor = (pitchClassOf(match[1], match[2]) + offset) % 12;
        return {
            tonic: major ? relativeMajor : (relativeMajor + 9) % 12,
            mode: major ? 'major' : 'minor',
            relativeMajor,
            fifths: relativeMajor === 6 && match[2] === 'b' ? -6 : FIFTHS_BY_PITCH_CLASS[relativeMajor],
            approximated: !PLAIN_MODES.includes(word)
        };
    }

    /**
     * Símbolo de acorde de ABC a raíz y calidad de XiRo.
     * @param {string} symbol Texto entre comillas («Am7», «G7», «C/E»)
     * @returns {?{root: number, quality: string}} null si no se reconoce
     */
    function parseChord(symbol) {
        const match = CHORD_PATTERN.exec(String(symbol).trim());
        const quality = match ? SUFFIX_QUALITY[match[3]] : null;
        return quality ? { root: pitchClassOf(match[1], match[2]), quality } : null;
    }

    /**
     * Símbolo de acorde con los nombres de la tonalidad (bemoles o sostenidos según el modo).
     * @param {number} root 0-11
     * @param {string} quality Clave de QUALITIES
     * @param {string} mode 'major' | 'minor'
     * @returns {string}
     */
    function chordText(root, quality, mode) {
        return NAMES[mode][root] + CHORD_SUFFIX[quality];
    }

    /** Índice (0 = Do … 6 = Si) de la letra con que se escribe la tónica y la de su relativo mayor. */
    function letterIndexes(tonic, mode) {
        const tonicLetter = LETTERS.indexOf(NAMES[mode][tonic][0]);
        return { tonicLetter, relativeMajorLetter: (tonicLetter + (mode === 'minor' ? 2 : 0)) % 7 };
    }

    return { LETTERS, keyText, parseKey, parseChord, chordText, letterIndexes };
});
