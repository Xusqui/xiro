'use strict';

/**
 * @fileoverview Cálculo aproximado del tamaño de letra que cabe en una caja de texto del lienzo, sin
 * navegador. Usa el ancho medio por carácter de cada fuente (medido en Chrome con las fuentes de
 * css/slide-canvas.css) y el mismo modelo que el render: relleno de 16 px e interlineado de 1,2.
 * DM Sans (la fuente de casi todos los textos) usa el ancho medido de cada carácter; las demás, la media de
 * su fuente. Es conservador (+2 % en DM Sans, +6 % en las demás); si aun así no cabe, el ajuste 'shrink'
 * del render reduce la letra.
 */

const PADDING = 16;
const LINE_HEIGHT = 1.2;
const SAFETY = { sans: 1.02, other: 1.06 };
// [minúsculas y signos, mayúsculas y cifras] × tamaño, en normal y en negrita
const WIDTHS = {
    sans: [[0.462, 0.561], [0.486, 0.585]],
    serif: [[0.476, 0.616], [0.489, 0.629]],
    display: [[0.335, 0.348], [0.335, 0.348]],
    mono: [[0.6, 0.6], [0.6, 0.6]],
    rounded: [[0.451, 0.593], [0.467, 0.608]],
    condensed: [[0.365, 0.437], [0.412, 0.485]],
    elegant: [[0.447, 0.578], [0.46, 0.602]],
    hand: [[0.338, 0.459], [0.343, 0.465]]
};

// DM Sans: ancho de cada carácter (centésimas del tamaño) medido en Chrome, en normal y en negrita
const SANS_CHARS = " abcdefghijklmnopqrstuvwxyzáéíóúüñABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ0123456789.,:;¿?¡!-()«»\"'%·/&+…—“”";
const SANS_WIDTHS = {
    400: '27 54 63 57 63 57 34 56 58 24 24 50 22 89 57 59 63 63 37 50 39 57 53 76 50 56 46 54 57 22 59 57 57 57 66 60 72 69 57 54 76 68 23 50 58 53 84 69 77 58 77 59 58 56 66 67 97 60 58 54 66 57 23 77 66 69 68 31 58 59 61 61 63 53 61 63 20 18 20 23 52 52 25 25 54 37 37 45 45 29 16 79 20 39 73 55 57 87 37 37',
    700: '24 59 65 61 65 60 37 60 62 27 27 58 27 94 62 61 65 65 41 53 43 62 57 82 57 60 49 59 60 27 61 62 62 62 71 64 74 71 58 56 78 71 27 54 65 56 89 73 78 61 78 63 60 60 68 71 102 67 64 58 71 58 27 78 68 73 70 36 58 60 65 62 63 54 63 63 25 25 25 28 54 54 31 31 58 41 41 51 51 37 20 90 25 43 78 58 69 92 45 45'
};
const SANS_TABLES = {};
for (const weight of Object.keys(SANS_WIDTHS)) {
    const values = SANS_WIDTHS[weight].split(' ').map(Number);
    SANS_TABLES[weight] = new Map([...SANS_CHARS].map((ch, i) => [ch, values[i] / 100]));
}

/** Ancho estimado de un texto de una línea, en px. */
function textWidth(text, { font = 'sans', bold = false, size }) {
    const [lower, upper] = (WIDTHS[font] || WIDTHS.sans)[bold ? 1 : 0];
    const table = font === 'sans' || !WIDTHS[font] ? SANS_TABLES[bold ? 700 : 400] : null;
    let units = 0;
    for (const ch of String(text)) {
        const known = table && table.get(ch);
        units += known !== undefined && known !== null ? known : /[A-ZÁÉÍÓÚÜÑ0-9]/.test(ch) ? upper : lower;
    }
    return units * size * (table ? SAFETY.sans : SAFETY.other);
}

/** Líneas que ocupa el texto en una caja de ancho útil `width`, partiendo por palabras como el navegador. */
function countLines(text, { font, bold, size, width }) {
    const space = textWidth(' ', { font, bold, size });
    let lines = 0;
    for (const paragraph of String(text).split('\n')) {
        let current = 0;
        lines++;
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const w = textWidth(word, { font, bold, size });
            if (current > 0 && current + space + w > width) {
                lines++;
                current = 0;
            }
            // Una palabra más ancha que la caja se parte en varias líneas
            if (w > width) {
                lines += Math.ceil(w / width) - 1;
                current = w % width;
            } else current += (current > 0 ? space : 0) + w;
        }
    }
    return lines;
}

/** Alto de caja (px, entero) para el texto con ese tamaño y ancho de caja. */
function boxHeight(text, { font, bold, size, w }) {
    const lines = countLines(text, { font, bold, size, width: w - 2 * PADDING });
    return Math.ceil(lines * LINE_HEIGHT * size + 2 * PADDING);
}

/**
 * Mayor tamaño (de max a min, de 2 en 2) con el que el texto cabe en la caja sin pasar de maxLines ni partir
 * ninguna palabra.
 * @param {string} text
 * @param {{font?: string, bold?: boolean, w: number, h?: number, max: number, min: number, maxLines?: number}} o
 * @returns {number}
 */
function fitSize(text, o) {
    const width = o.w - 2 * PADDING;
    const words = String(text).split(/\s+/).filter(Boolean);
    for (let size = o.max; size > o.min; size -= 2) {
        const lines = countLines(text, { font: o.font, bold: o.bold, size, width });
        const fitsLines = !o.maxLines || lines <= o.maxLines;
        const fitsHeight = !o.h || lines * LINE_HEIGHT * size + 2 * PADDING <= o.h;
        // Una palabra más ancha que la caja se partiría por la mitad: hay que bajar la letra
        const fitsWords = words.every(word => textWidth(word, { font: o.font, bold: o.bold, size }) <= width);
        if (fitsLines && fitsHeight && fitsWords) return size;
    }
    return o.min;
}

/**
 * La mejor partición de las palabras en k líneas (k = 2 o 3): la línea más larga lo más corta posible, y si
 * se puede, con un 6 % de holgura para que el navegador no vuelva a partir una línea que roza el ancho.
 */
function splitWords(words, k, measure, width) {
    let best = null;
    const consider = parts => {
        const widths = parts.map(measure);
        const longest = Math.max(...widths);
        if (longest > width) return;
        const roomy = longest <= width * 0.94;
        if (!best || (roomy && !best.roomy) || (roomy === best.roomy && longest < best.longest)) {
            best = { longest, roomy, text: parts.join('\n') };
        }
    };
    for (let i = 1; i < words.length; i++) {
        if (k === 2) consider([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
        for (let j = i + 1; k === 3 && j < words.length; j++) {
            consider([words.slice(0, i).join(' '), words.slice(i, j).join(' '), words.slice(j).join(' ')]);
        }
    }
    return best && best.text;
}

/**
 * Parte el texto con \n en líneas de ancho parecido, sin una palabra sola al final, si ocupa 2 o 3 líneas.
 * Con eager (por defecto) también reparte en dos una línea que llena más del 90 % del ancho: la estimación
 * es aproximada y el navegador podría partirla dejando una palabra sola. Los textos con saltos propios,
 * de menos de 3 palabras o de más de 3 líneas se dejan como están.
 * @param {string} text
 * @param {{font?: string, bold?: boolean, size: number, w: number, eager?: boolean}} o - w: ancho de la caja
 * @returns {string}
 */
function balance(text, { font, bold, size, w, eager = true }) {
    const value = String(text);
    const width = w - 2 * PADDING;
    const words = value.split(' ');
    if (value.includes('\n') || words.length < 3 || words.length > 14) return value;
    const measure = part => textWidth(part, { font, bold, size });
    let lines = countLines(value, { font, bold, size, width });
    if (eager && lines === 1 && measure(value) > width * 0.9) lines = 2;
    if (lines < 2 || lines > 3) return value;
    return splitWords(words, lines, measure, width) || (lines === 2 && splitWords(words, 3, measure, width)) || value;
}

/**
 * Tamaño y texto equilibrado que caben en la caja: el tamaño se calcula, se equilibran las líneas y, si el
 * texto partido necesita algo menos de letra, se vuelve a ajustar.
 * @param {string} text
 * @param {Object} o - Opciones de fitSize más eager
 * @returns {{text: string, size: number}}
 */
function fitBalanced(text, o) {
    const first = fitSize(text, o);
    const value = balance(text, { ...o, size: first });
    return { text: value, size: value === text ? first : fitSize(value, o) };
}

module.exports = { PADDING, LINE_HEIGHT, textWidth, countLines, boxHeight, fitSize, balance, fitBalanced };
