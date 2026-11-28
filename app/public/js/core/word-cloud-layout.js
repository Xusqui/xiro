/* eslint-disable no-var -- ES5 a propósito: tv.html debe funcionar en WebOS 3.5 */
/**
 * @fileoverview Colocación en espiral de la «Nube de palabras» (presentador y TV). La palabra más
 * votada va al centro y las demás se colocan una a una sobre una espiral que se abre desde ahí, en
 * el primer hueco libre. Función pura y determinista: las mismas palabras dan siempre la misma
 * nube, así que una palabra nueva no baraja las que ya estaban más votadas.
 *
 * El ancho de cada palabra se estima por su longitud (no se mide en el DOM): así el cálculo es
 * idéntico en el servidor de tests, en el presentador y en el navegador de la TV.
 *
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 * Expone window.XiroWordCloudLayout y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    var DEFAULT_MIN_FONT = 14;
    var DEFAULT_MAX_FONT = 96;
    var CHAR_WIDTH = 0.6;
    var UPPER_WIDTH = 0.78;
    var WIDE_WIDTH = 0.9;
    var NARROW_WIDTH = 0.34;
    var FULL_WIDTH = 1;
    var WIDE_CHARS = 'mwMW';
    var NARROW_CHARS = "iljtf.,:;'!| ";
    var LINE_HEIGHT = 1.15;
    var GAP = 6;
    var SHRINK_STEP = 0.9;
    var ANGLE_STEP = 0.1;
    var RADIUS_PER_RADIAN = 2.2;
    var MAX_WORDS = 80;
    // Cuántas tipografías y colores define css/word-cloud.css (--f0..--f4, --c0..--c9)
    var COLOR_COUNT = 10;
    // Ancho y alto relativos de cada tipografía respecto a la base (DM Sans), medidos en el navegador
    // con texto real; la 4 (Caveat) se pinta a 1.22em y sus trazos se salen de la línea
    var FACE_WIDTHS = [1, 0.84, 0.97, 1.68, 0.85];
    var FACE_HEIGHTS = [1, 1, 1, 1, 1.28];
    // De cada 100 palabras, cuántas van giradas 90° (la más votada nunca)
    var VERTICAL_PERCENT = 28;

    function isPositiveNumber(value) {
        return typeof value === 'number' && isFinite(value) && value > 0;
    }

    function cleanWords(words) {
        var clean = [];
        for (var i = 0; i < (words || []).length; i++) {
            var word = words[i];
            if (word && String(word.text || '').trim() && isPositiveNumber(word.count)) clean.push(word);
        }
        return clean;
    }

    // Más votos primero; en empate manda el orden recibido (Array.sort no es estable en webOS 3.5)
    function sortByVotes(words) {
        return words
            .map(function (word, index) {
                return { word: word, index: index };
            })
            .sort(function (a, b) {
                return b.word.count - a.word.count || a.index - b.index;
            })
            .map(function (entry) {
                return entry.word;
            });
    }

    function fontFor(count, topCount, area) {
        var size = Math.round(area.maxFont * Math.sqrt(count / topCount));
        return Math.max(area.minFont, Math.min(area.maxFont, size));
    }

    // Kanji, kana, hangul y formas de ancho completo: cada carácter mide 1 em en cualquier tipografía
    function isFullWidth(code) {
        return (
            (code >= 0x1100 && code <= 0x11ff) ||
            (code >= 0x2e80 && code <= 0xa4cf) ||
            (code >= 0xac00 && code <= 0xd7a3) ||
            (code >= 0xf900 && code <= 0xfaff) ||
            (code >= 0xfe30 && code <= 0xfe6f) ||
            (code >= 0xff00 && code <= 0xff60) ||
            (code >= 0xffe0 && code <= 0xffe6)
        );
    }

    // Ancho de una letra en em, a peso 900: las mayúsculas y la m/w son anchas, i/l/t/j/f y la puntuación, estrechas
    function charWidth(ch) {
        if (isFullWidth(ch.charCodeAt(0))) return FULL_WIDTH;
        if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) return UPPER_WIDTH;
        if (WIDE_CHARS.indexOf(ch) !== -1) return WIDE_WIDTH;
        if (NARROW_CHARS.indexOf(ch) !== -1) return NARROW_WIDTH;
        return CHAR_WIDTH;
    }

    // Hash de la clave con una sal: mismo resultado en cualquier motor (solo enteros de 32 bits)
    function hashKey(key, salt) {
        var text = String(key) + '|' + salt;
        var h = 5381;
        for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
        h ^= h << 13;
        h ^= h >>> 17;
        h ^= h << 5;
        return h >>> 0;
    }

    // Aspecto de una palabra: sale solo de su clave, así no cambia al cambiar sus votos o su puesto
    function styleFor(key, isTop) {
        return {
            face: hashKey(key, 'f') % FACE_WIDTHS.length,
            color: hashKey(key, 'c') % COLOR_COUNT,
            vertical: !isTop && hashKey(key, 'o') % 100 < VERTICAL_PERCENT
        };
    }

    function boxFor(word, fontSize, style) {
        var text = String(word.text);
        var em = 0;
        for (var i = 0; i < text.length; i++) em += charWidth(text.charAt(i));
        var w = Math.ceil(em * FACE_WIDTHS[style.face] * fontSize);
        var h = Math.ceil(fontSize * LINE_HEIGHT * FACE_HEIGHTS[style.face]);
        // Girada 90°, la caja intercambia ancho y alto
        return style.vertical ? { w: h, h: w } : { w: w, h: h };
    }

    function fitsCanvas(x, y, box, area) {
        return x - box.w / 2 >= 0 && x + box.w / 2 <= area.width && y - box.h / 2 >= 0 && y + box.h / 2 <= area.height;
    }

    function collides(x, y, box, placed) {
        for (var i = 0; i < placed.length; i++) {
            var other = placed[i];
            if (Math.abs(x - other.x) * 2 < box.w + other.w + GAP && Math.abs(y - other.y) * 2 < box.h + other.h + GAP)
                return true;
        }
        return false;
    }

    // Primer punto libre de la espiral; null si la espiral sale del lienzo sin hallar hueco
    function findSpot(box, placed, area) {
        var reach = Math.sqrt(area.width * area.width + area.height * area.height) / 2;
        var aspect = area.width / area.height;
        for (var angle = 0; angle * RADIUS_PER_RADIAN <= reach; angle += ANGLE_STEP) {
            var radius = angle * RADIUS_PER_RADIAN;
            var x = area.width / 2 + radius * Math.cos(angle) * aspect;
            var y = area.height / 2 + radius * Math.sin(angle);
            if (fitsCanvas(x, y, box, area) && !collides(x, y, box, placed)) return { x: x, y: y };
        }
        return null;
    }

    // Encoge la palabra hasta que cabe; si ni con el tamaño mínimo cabe, se descarta
    function placeWord(word, fontSize, placed, area, style) {
        for (var size = fontSize; ; size = Math.max(area.minFont, Math.floor(size * SHRINK_STEP))) {
            var box = boxFor(word, size, style);
            var spot = findSpot(box, placed, area);
            if (spot)
                return {
                    key: word.key,
                    text: word.text,
                    count: word.count,
                    face: style.face,
                    color: style.color,
                    vertical: style.vertical,
                    fontSize: size,
                    x: spot.x,
                    y: spot.y,
                    w: box.w,
                    h: box.h
                };
            if (size <= area.minFont) return null;
        }
    }

    function normalizeArea(area) {
        var options = area || {};
        if (!isPositiveNumber(options.width) || !isPositiveNumber(options.height)) return null;
        return {
            width: options.width,
            height: options.height,
            minFont: isPositiveNumber(options.minFont) ? options.minFont : DEFAULT_MIN_FONT,
            maxFont: isPositiveNumber(options.maxFont) ? options.maxFont : DEFAULT_MAX_FONT
        };
    }

    /**
     * Coloca las palabras de la nube sobre el lienzo.
     * @param {Array<{key: string, text: string, count: number}>} words - Palabras agrupadas
     * @param {{width: number, height: number, minFont?: number, maxFont?: number}} areaOptions - Lienzo en px
     * @returns {Array<{key: string, text: string, count: number, face: number, color: number, vertical: boolean, fontSize: number, x: number, y: number, w: number, h: number}>}
     *   Cajas por su centro (x, y), de más a menos votada; las que no caben se omiten. `face` (0-4) y
     *   `color` (0-9) eligen tipografía y color; `vertical` gira la palabra 90° (su caja ya va girada).
     */
    function compute(words, areaOptions) {
        var area = normalizeArea(areaOptions);
        var sorted = sortByVotes(cleanWords(words)).slice(0, MAX_WORDS);
        if (!area || !sorted.length) return [];
        var placed = [];
        for (var i = 0; i < sorted.length; i++) {
            var style = styleFor(sorted[i].key, i === 0);
            var item = placeWord(sorted[i], fontFor(sorted[i].count, sorted[0].count, area), placed, area, style);
            if (item) placed.push(item);
        }
        return placed;
    }

    var api = { compute: compute, MAX_WORDS: MAX_WORDS };
    root.XiroWordCloudLayout = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
