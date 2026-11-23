/**
 * @fileoverview Ayudas para leer un ABC: separar la primera pieza en cabecera y música, el patrón que
 * recorre los símbolos del cuerpo, longitudes de nota, tempo, compás y armadura. Datos puros, sin DOM.
 *
 * Export dual (Jest/Node con require; navegador en self.XiroMusic.abcText).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.abcText = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const EPS = 1e-6;
    const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const SHARPS = 'FCGDAEB';
    const FLATS = 'BEADGCF';
    const TUPLET_Q = { 2: 3, 3: 2, 4: 3, 5: 2, 6: 2, 7: 2, 8: 3, 9: 2 };
    // Una sola expresión recorre el cuerpo: cada alternativa es un tipo de símbolo
    const TOKEN = new RegExp([
        '"(?<chord>[^"]*)"', '(?<skip>![^!]*!|\\+[^+]*\\+|\\{[^}]*\\})', '\\[(?<field>[A-Za-z]):(?<fieldValue>[^\\]]*)\\]',
        '(?<bar>\\[\\||[|:]+\\]?|\\[\\d)', '\\((?<tuplet>\\d(?::\\d*){0,2})', '\\[(?<group>[^\\]]*)\\](?<groupLen>\\d*/*\\d*)',
        '(?<acc>[\\^_=]*)(?<letter>[A-Ga-g])(?<octave>[,\']*)(?<len>\\d*/*\\d*)(?<mods>[<>-]*)',
        '(?<rest>[zZx])(?<restLen>\\d*/*\\d*)'
    ].join('|'), 'g');

    function codedError(code) {
        const error = new Error(code);
        error.code = code;
        return error;
    }

    /** Duración como múltiplo de la unidad: «3», «/», «//», «3/2», «/4». */
    function multiplier(text) {
        const match = /^(\d*)(\/*)(\d*)$/.exec(text || '');
        if (!match) return 1;
        const numerator = match[1] ? Number(match[1]) : 1;
        if (!match[2]) return numerator;
        return match[3] ? numerator / Number(match[3]) : numerator / 2 ** match[2].length;
    }

    const fraction = (text) => {
        const match = /^\s*(\d+)\s*\/\s*(\d+)/.exec(text);
        return match ? Number(match[1]) / Number(match[2]) : null;
    };

    /** Negras por minuto de un campo Q: «1/4=120», «120», «"Allegro" 1/2=60». */
    function tempoOf(value) {
        const text = String(value || '').replace(/"[^"]*"/g, ' ');
        const match = /(?:(\d+\s*\/\s*\d+)\s*=\s*)?(\d+(?:\.\d+)?)\s*$/.exec(text);
        if (!match) return null;
        return Number(match[2]) * (match[1] ? fraction(match[1]) * 4 : 1);
    }

    /** Duración del compás en redondas (4/4 = 1) o null si no se entiende; sin M: se supone 4/4. */
    function barLengthOf(value) {
        if (!value || /^(C\|?|none)$/i.test(value.trim())) return 1;
        return fraction(value);
    }

    /** Primera pieza: sus campos de cabecera y las líneas de música (sin comentarios). */
    function splitTune(text) {
        const lines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.split('%')[0]);
        const fields = {};
        const body = [];
        let inBody = false;
        let started = false;
        for (const line of lines) {
            if (/^\s*$/.test(line)) {
                if (inBody) break;
                continue;
            }
            if (/^X:/.test(line) && started) break;
            started = true;
            const field = /^([A-Za-z]):\s*(.*)$/.exec(line);
            if (!inBody && field) {
                fields[field[1]] = fields[field[1]] === undefined ? field[2].trim() : fields[field[1]];
                inBody = field[1] === 'K';
            } else if (inBody) {
                body.push(line);
            }
        }
        return { fields, body, hasKey: fields.K !== undefined };
    }

    function keySignatureShift(fifths, letter) {
        if (fifths > 0 && SHARPS.indexOf(letter) < fifths) return 1;
        if (fifths < 0 && FLATS.indexOf(letter) < -fifths) return -1;
        return 0;
    }

    function accidentalValue(text) {
        if (!text) return null;
        return text === '=' ? 0 : (text.match(/\^/g) || []).length - (text.match(/_/g) || []).length;
    }

    return {
        EPS, SEMITONE, TUPLET_Q, TOKEN, codedError, multiplier, fraction, tempoOf, barLengthOf, splitTune,
        keySignatureShift, accidentalValue
    };
});
