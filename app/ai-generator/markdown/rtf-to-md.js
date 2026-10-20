/**
 * @fileoverview RTF → texto por párrafos. Intérprete propio de palabras de
 * control: \par y \line cortan párrafo, \'hh se decodifica en cp1252, \uN
 * (con su carácter de respaldo \ucN) en Unicode. Se ignoran los destinos que
 * no son texto del cuerpo (tablas de fuentes y colores, imágenes, cabeceras,
 * pies, metadatos y todo grupo marcado con \*).
 */

'use strict';

const SKIP_DESTINATIONS = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'object',
    'objdata',
    'fldinst',
    'themedata',
    'colorschememapping',
    'datastore',
    'latentstyles',
    'listtable',
    'listoverridetable',
    'rsidtbl',
    'generator',
    'xmlnstbl',
    'mmathPr',
    'header',
    'headerl',
    'headerr',
    'headerf',
    'footer',
    'footerl',
    'footerr',
    'footerf',
    'footnote',
    'annotation',
    'bkmkstart',
    'bkmkend',
    'pgdsctbl',
    'revtbl',
    'filetbl'
]);
const CHAR_WORDS = {
    par: '\n',
    line: '\n',
    sect: '\n',
    page: '\n',
    row: '\n',
    cell: ' | ',
    tab: ' ',
    emdash: '—',
    endash: '–',
    bullet: '•',
    lquote: '‘',
    rquote: '’',
    ldblquote: '“',
    rdblquote: '”',
    emspace: ' ',
    enspace: ' ',
    qmspace: ' '
};
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';

function cp1252(code) {
    return code >= 0x80 && code <= 0x9f ? CP1252[code - 0x80] : String.fromCharCode(code);
}

function controlWord(state, word, param) {
    const group = state.group;
    if (SKIP_DESTINATIONS.has(word)) {
        group.skip = true;
    } else if (word === 'uc') {
        group.uc = param;
    } else if (word === 'u') {
        if (!group.skip) state.out += String.fromCharCode(param < 0 ? param + 65536 : param);
        state.pendingSkip = group.uc;
    } else if (!group.skip && CHAR_WORDS[word]) {
        state.out += CHAR_WORDS[word];
    }
}

function readControl(src, i, state) {
    const next = src[i + 1];
    if (next === '\\' || next === '{' || next === '}') {
        if (!state.group.skip) state.out += next;
        return i + 2;
    }
    if (next === '\'') {
        if (state.pendingSkip > 0) state.pendingSkip--;
        else if (!state.group.skip) state.out += cp1252(parseInt(src.substr(i + 2, 2), 16));
        return i + 4;
    }
    if (next === '*') {
        state.group.skip = true;
        return i + 2;
    }
    const m = /^([a-zA-Z]{1,32})(-?\d{1,10})? ?/.exec(src.slice(i + 1, i + 50));
    if (!m) {
        if (next === '~') state.out += ' ';
        return i + 2;
    }
    controlWord(state, m[1], m[2] !== undefined ? Number(m[2]) : 1);
    return i + 1 + m[0].length;
}

/**
 * @param {string} src - RTF decodificado como latin1
 * @returns {string} texto con un párrafo por línea
 */
function rtfToText(src) {
    const state = { out: '', group: { skip: false, uc: 1 }, stack: [], pendingSkip: 0 };
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        if (ch === '\\') {
            i = readControl(src, i, state);
            continue;
        }
        if (ch === '{') {
            state.stack.push(state.group);
            state.group = { ...state.group };
        } else if (ch === '}') {
            state.group = state.stack.pop() || state.group;
        } else if (ch !== '\r' && ch !== '\n') {
            if (state.pendingSkip > 0) state.pendingSkip--;
            else if (!state.group.skip) state.out += ch;
        }
        i++;
    }
    return state.out;
}

/**
 * @param {Buffer} buffer
 * @returns {Array<Object>} bloques (un párrafo por línea de texto)
 */
function rtfToBlocks(buffer) {
    return rtfToText(buffer.toString('latin1'))
        .split('\n')
        .map(line => line.replace(/(\s*\|\s*)+$/, '').trim())
        .filter(Boolean)
        .map(text => ({ type: 'p', text }));
}

module.exports = { rtfToBlocks, rtfToText };
