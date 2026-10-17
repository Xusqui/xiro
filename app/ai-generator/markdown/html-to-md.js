/**
 * @fileoverview HTML / XHTML → bloques Markdown con un tokenizador tolerante
 * (el HTML real no es XML válido). Se descartan script, style, nav, aside,
 * footer, formularios y comentarios. Encabezados h1-h6, listas anidadas
 * (ul/ol) y tablas (las tablas anidadas se aplanan dentro de su celda).
 */

'use strict';

const { decodeEntities } = require('./xml-lite');
const { HTML_ENTITIES } = require('./html-entities');

const DROP = /<(script|style|noscript|svg|math|template|nav|aside|footer|head|iframe|object|form|select|button)\b[\s\S]*?<\/\1\s*>/gi;
const BLOCK = new Set(['p', 'div', 'section', 'article', 'main', 'header', 'blockquote', 'pre', 'dt', 'dd', 'dl',
    'figcaption', 'figure', 'address', 'hr', 'caption', 'details', 'summary']);
// Ninguna alternativa cruza un '<': coste lineal incluso con etiquetas sin cerrar
const TOKEN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b(?:[^<>"']|"[^"<]*"|'[^'<]*')*>|([^<]+)|</g;

function preprocess(html) {
    let src = String(html).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    const body = src.match(/<body\b[^>]*>([\s\S]*)<\/body\s*>/i);
    if (body) src = body[1];
    let prev;
    do {
        prev = src;
        src = src.replace(DROP, ' ');
    } while (src !== prev);
    return src;
}

function flush(state) {
    if (state.buf.trim()) state.out.push({ ...state.kind, text: state.buf });
    state.buf = '';
    state.kind = { type: 'p' };
}

function append(state, text) {
    const rows = state.table && state.table.rows;
    if (rows && rows.length > 0 && rows[rows.length - 1].length > 0) {
        const row = rows[rows.length - 1];
        row[row.length - 1] += text;
    } else if (!state.table) {
        state.buf += text;
    }
}

function tableTag(state, name, closing) {
    if (name === 'table') {
        if (!closing && state.tableDepth++ === 0) {
            flush(state);
            state.table = { rows: [] };
        } else if (closing && state.tableDepth > 0 && --state.tableDepth === 0) {
            state.out.push({ type: 'table', rows: state.table.rows });
            state.table = null;
        }
        return;
    }
    if (closing || state.tableDepth !== 1) {
        if (state.tableDepth > 1) append(state, ' ');
        return;
    }
    const rows = state.table.rows;
    if (name === 'tr') rows.push([]);
    else {
        if (rows.length === 0) rows.push([]);
        rows[rows.length - 1].push('');
    }
}

function listTag(state, name, closing) {
    flush(state);
    if (name === 'li') {
        if (!closing) {
            const depth = Math.max(0, state.lists.length - 1);
            state.kind = { type: 'li', depth, ordered: state.lists[state.lists.length - 1] === 'ol' };
        }
        return;
    }
    if (closing) state.lists.pop();
    else state.lists.push(name);
}

function handleTag(state, name, closing) {
    if (['table', 'tr', 'td', 'th'].includes(name)) return tableTag(state, name, closing);
    if (state.table) return append(state, ' ');
    if (name === 'br') return append(state, ' ');
    if (/^h[1-6]$/.test(name)) {
        flush(state);
        if (!closing) state.kind = { type: 'h', level: Number(name[1]) };
        return undefined;
    }
    if (name === 'li' || name === 'ul' || name === 'ol') return listTag(state, name, closing);
    if (BLOCK.has(name)) flush(state);
    return undefined;
}

/**
 * @param {string} html
 * @returns {Array<Object>} bloques
 */
function htmlToBlocks(html) {
    const state = { out: [], buf: '', kind: { type: 'p' }, lists: [], table: null, tableDepth: 0 };
    const src = preprocess(html);
    TOKEN.lastIndex = 0;
    let m;
    while ((m = TOKEN.exec(src)) !== null) {
        if (m[3] !== undefined) append(state, decodeEntities(m[3], HTML_ENTITIES));
        else if (m[2]) handleTag(state, m[2].toLowerCase(), m[1] === '/');
        else append(state, '<');
    }
    if (state.table) state.out.push({ type: 'table', rows: state.table.rows });
    flush(state);
    return state.out;
}

/** Decodifica el HTML respetando un charset latino declarado en <meta>. */
function decodeHtmlBuffer(buffer) {
    const head = buffer.subarray(0, 2048).toString('latin1');
    const m = head.match(/charset\s*=\s*["']?\s*(iso-8859-1|iso-8859-15|latin1|windows-1252|cp1252)/i);
    if (!m) return buffer.toString('utf8').replace(/^\ufeff/, '');
    try {
        return new TextDecoder('windows-1252').decode(buffer);
    } catch {
        return buffer.toString('latin1');
    }
}

module.exports = { htmlToBlocks, decodeHtmlBuffer };
