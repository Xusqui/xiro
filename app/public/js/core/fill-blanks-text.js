/**
 * @fileoverview Núcleo compartido de «Completa la frase» (fill_blanks): reglas del
 * texto con huecos, normalización de palabras, pistas y HTML de la frase con casillas.
 *
 * El editor escribe la frase con las palabras entre corchetes:
 *   "La infección por [Helicobacter] [pylori] causa úlceras [duodenales]"
 * En la base de datos la frase se guarda con marcadores y las palabras aparte
 * (options, una por hueco), para que el enunciado nunca lleve la solución:
 *   "La infección por {{1}} {{2}} causa úlceras {{3}}"   ·   HELICOBACTER, PYLORI, DUODENALES
 * El JSON de exportación/importación usa otra vez los corchetes.
 *
 * Lo comparten el servidor (FillBlanksService, validación, PDF), el admin (editor,
 * import/export), el jugador, el presentador, standalone y tv.html.
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 * Expone window.XiroFillBlanks y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    // Reglas acordadas: 1-3 huecos, palabras de 4-14 letras, solo letras A-Z más Ñ y Ç
    let LIMITS = {
        MIN_BLANKS: 1,
        MAX_BLANKS: 3,
        MIN_WORD_LENGTH: 4,
        MAX_WORD_LENGTH: 14,
        MAX_HINTS_PER_BLANK: 3,
        // Valor de la palabra según las pistas usadas: 0 → 100 %, 1 → 70 %, 2 → 40 %, 3 → 25 %
        HINT_FACTORS: [1, 0.7, 0.4, 0.25]
    };

    let BRACKET_GROUP = /\[([^[\]]*)\]/g;
    let MARKER = /\{\{(\d+)\}\}/g;
    let VALID_WORD = /^[A-ZÑÇ]+$/;
    // Marcas diacríticas combinantes tras NFD (tildes, diéresis, cedilla…). Con
    // fromCharCode para que se vean en el código: como literales serían invisibles.
    let COMBINING_MARKS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
    let TILDE = String.fromCharCode(0x303);
    let CEDILLA = String.fromCharCode(0x327);

    function escapeText(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function replaceAll(text, search, replacement) {
        return text.split(search).join(replacement);
    }

    /**
     * Normaliza una palabra para compararla: mayúsculas, sin tildes ni diéresis
     * (ÉPOCA → EPOCA, Ü → U) pero conservando la Ñ y la Ç. No quita otros
     * caracteres: así isValidWord puede rechazar dígitos, guiones o espacios.
     * @param {string} word
     * @returns {string}
     */
    function normalizeWord(word) {
        if (word === null || word === undefined) return '';
        let text = String(word).trim();
        if (typeof text.normalize === 'function') {
            // NFD separa la tilde de la Ñ y la cedilla de la Ç: se recomponen antes
            // de quitar el resto de marcas
            text = text.normalize('NFD');
            text = replaceAll(text, 'N' + TILDE, 'Ñ');
            text = replaceAll(text, 'n' + TILDE, 'ñ');
            text = replaceAll(text, 'C' + CEDILLA, 'Ç');
            text = replaceAll(text, 'c' + CEDILLA, 'ç');
            text = text.replace(COMBINING_MARKS, '');
        }
        return text.toUpperCase();
    }

    /** Código de error de una palabra ya normalizada, o null si cumple las reglas */
    function wordError(normalized) {
        if (!VALID_WORD.test(normalized)) return 'word_chars';
        if (normalized.length < LIMITS.MIN_WORD_LENGTH) return 'word_short';
        if (normalized.length > LIMITS.MAX_WORD_LENGTH) return 'word_long';
        return null;
    }

    function isValidWord(word) {
        return wordError(normalizeWord(word)) === null;
    }

    /**
     * Analiza la frase del editor (con corchetes).
     * @param {string} editorText
     * @returns {{ text: string, words: string[], errors: Array<{code: string, index?: number, word?: string}> }}
     *   text: frase con marcadores {{n}} · words: palabras normalizadas · errors: vacío si es válida.
     *   Códigos: no_blanks, too_many_blanks, unbalanced, marker_literal, word_chars, word_short, word_long
     */
    function parseEditorText(editorText) {
        let source = String(editorText === null || editorText === undefined ? '' : editorText);
        let words = [];
        let errors = [];
        let index = 0;
        let text = source.replace(BRACKET_GROUP, function (_match, inner) {
            let normalized = normalizeWord(inner);
            let code = wordError(normalized);
            if (code) errors.push({ code: code, index: index, word: inner.trim() });
            words.push(normalized);
            index++;
            return '{{' + index + '}}';
        });

        if (text.indexOf('[') !== -1 || text.indexOf(']') !== -1) {
            errors.push({ code: 'unbalanced' });
        }
        // Un {{n}} escrito a mano se confundiría con un hueco al guardar
        if (new RegExp(MARKER.source).test(source)) {
            errors.push({ code: 'marker_literal' });
        }
        if (words.length < LIMITS.MIN_BLANKS) {
            errors.push({ code: 'no_blanks' });
        } else if (words.length > LIMITS.MAX_BLANKS) {
            errors.push({ code: 'too_many_blanks' });
        }

        return { text: text.replace(/\s+/g, ' ').trim(), words: words, errors: errors };
    }

    /** Frase con marcadores + palabras → frase del editor con corchetes */
    function toEditorText(markerText, words) {
        let list = words || [];
        return String(markerText || '').replace(MARKER, function (match, n) {
            let word = list[Number(n) - 1];
            return word === undefined || word === null ? match : '[' + word + ']';
        });
    }

    /**
     * Divide la frase con marcadores en trozos de texto y huecos.
     * @param {string} markerText
     * @returns {Array<{type: 'text', value: string}|{type: 'blank', index: number}>} index desde 0
     */
    function splitSegments(markerText) {
        let segments = [];
        let text = String(markerText || '');
        let re = new RegExp(MARKER.source, 'g');
        let last = 0;
        let match = re.exec(text);
        while (match) {
            if (match.index > last) segments.push({ type: 'text', value: text.slice(last, match.index) });
            segments.push({ type: 'blank', index: Number(match[1]) - 1 });
            last = match.index + match[0].length;
            match = re.exec(text);
        }
        if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
        return segments;
    }

    function countBlanks(markerText) {
        let found = String(markerText || '').match(MARKER);
        return found ? found.length : 0;
    }

    function hasMarkers(text) {
        return countBlanks(text) > 0;
    }

    /**
     * Posiciones que destapa cada pista, en orden: primera letra, última y una
     * central (para PYLORI, la O). Con 4 letras: 0, 3, 2.
     * @param {number} length
     * @returns {number[]}
     */
    function hintPositions(length) {
        let len = Number(length) || 0;
        if (len < 3) return len === 2 ? [0, 1] : (len === 1 ? [0] : []);
        return [0, len - 1, Math.floor(len / 2)];
    }

    /** Fracción del valor de la palabra tras `count` pistas (0 → 1, 3 → 0.25) */
    function hintFactor(count) {
        let n = Math.max(0, Math.min(LIMITS.MAX_HINTS_PER_BLANK, Number(count) || 0));
        return LIMITS.HINT_FACTORS[n];
    }

    function orderIndex(opt) {
        if (!opt) return 0;
        let value = opt.order_index !== undefined && opt.order_index !== null ? opt.order_index : opt.orderIndex;
        return Number(value) || 0;
    }

    /** Palabras normalizadas de las opciones de una pregunta, por order_index */
    function wordsFromOptions(options) {
        let list = (options || []).slice().sort(function (a, b) {
            return orderIndex(a) - orderIndex(b);
        });
        let words = [];
        for (let i = 0; i < list.length; i++) {
            let opt = list[i] || {};
            let text = opt.option_text !== undefined ? opt.option_text : (opt.optionText !== undefined ? opt.optionText : opt.text);
            words.push(normalizeWord(text));
        }
        return words;
    }

    /**
     * Letras que se ven en un hueco: las de pista en su posición y las escritas en las
     * posiciones libres, en orden ('' donde no hay letra). Lo usan jugador y standalone.
     * @param {number} length
     * @param {Object} fixed - { posición: letra } (pistas)
     * @param {string} typed - letras escritas
     * @returns {string[]} una entrada por posición
     */
    function mergeLetters(length, fixed, typed) {
        let map = fixed || {};
        let queue = String(typed || '').split('');
        let letters = [];
        for (let pos = 0; pos < (Number(length) || 0); pos++) {
            letters.push(map[pos] ? map[pos] : (queue.length ? queue.shift() : ''));
        }
        return letters;
    }

    /**
     * Lo escrito sin la letra que ocupaba `position` en la fusión actual: al destapar una
     * pista en una posición donde el jugador ya había tecleado, esa letra se retira en vez
     * de desplazarse a la siguiente casilla.
     * @param {number} length
     * @param {Object} fixed - { posición: letra } (pistas ya destapadas, sin la nueva)
     * @param {string} typed
     * @param {number} position
     * @returns {string}
     */
    function dropTypedAt(length, fixed, typed, position) {
        let map = fixed || {};
        let chars = String(typed || '').split('');
        let k = 0;
        for (let pos = 0; pos < (Number(length) || 0) && k < chars.length; pos++) {
            if (map[pos]) continue;
            if (pos === position) {
                chars.splice(k, 1);
                break;
            }
            k++;
        }
        return chars.join('');
    }

    /**
     * HTML de la frase con casillas (escapa todo el texto que inserta: es un helper seguro) (.fb-sentence > .fb-text | .fb-blank > .fb-cell).
     * @param {string} markerText - Frase con {{n}}
     * @param {number[]} lengths - Letras de cada hueco
     * @param {Object} [opts]
     * @param {string[]} [opts.letters] - Letras ya escritas por hueco ('' = vacío)
     * @param {string[]} [opts.states] - Clase extra de cada hueco (fb-blank--ok…)
     * @param {string} [opts.sizeClass] - Clase de tamaño (fb-sentence--stage, --tv…)
     * @returns {string}
     */
    function sanitizeSentenceHtml(markerText, lengths, opts) {
        let options = opts || {};
        let segments = splitSegments(markerText);
        let html = '<span class="fb-sentence' + (options.sizeClass ? ' ' + options.sizeClass : '') + '">';
        for (let s = 0; s < segments.length; s++) {
            let seg = segments[s];
            if (seg.type === 'text') {
                html += '<span class="fb-text">' + escapeText(seg.value) + '</span>';
                continue;
            }
            let len = Number((lengths || [])[seg.index]) || 0;
            let letters = (options.letters || [])[seg.index] || '';
            let state = (options.states || [])[seg.index] || '';
            html += '<span class="fb-blank' + (state ? ' ' + state : '') + '" data-blank="' + seg.index + '" data-len="' + len + '" role="group" aria-label="' + (seg.index + 1) + '">';
            for (let j = 0; j < len; j++) {
                let letter = letters.charAt(j);
                html += '<span class="fb-cell' + (letter ? ' fb-cell--filled' : '') + '" data-pos="' + j + '">' + escapeText(letter) + '</span>';
            }
            html += '</span>';
        }
        return html + '</span>';
    }

    let api = {
        LIMITS: LIMITS,
        escapeText: escapeText,
        normalizeWord: normalizeWord,
        wordError: wordError,
        isValidWord: isValidWord,
        parseEditorText: parseEditorText,
        toEditorText: toEditorText,
        splitSegments: splitSegments,
        countBlanks: countBlanks,
        hasMarkers: hasMarkers,
        hintPositions: hintPositions,
        hintFactor: hintFactor,
        wordsFromOptions: wordsFromOptions,
        mergeLetters: mergeLetters,
        dropTypedAt: dropTypedAt,
        sanitizeSentenceHtml: sanitizeSentenceHtml
    };

    root.XiroFillBlanks = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
