/**
 * @fileoverview Líneas de PDF → bloques Markdown.
 *  - tamaño de cuerpo = tamaño dominante (ponderado por longitud de texto)
 *  - encabezados: tamaños claramente mayores que el cuerpo (niveles 1-3) y,
 *    como red, líneas cortas, aisladas y sin puntuación final
 *  - párrafos: se unen líneas salvo hueco vertical grande, viñeta o fin de
 *    frase a cambio de página; se reparan palabras cortadas con guion
 */

'use strict';

const { median } = require('./pdf-lines');

const BULLET = /^(?:[•●▪◦‣■□➢➤✓\-–*]|(\d{1,3}|[a-z])[.)])\s+(.*)$/;
const SENTENCE_END = /[.!?:»"”)]$/;

function round(n) {
    return Math.round(n * 2) / 2;
}

function bodySize(lines) {
    const weight = new Map();
    for (const l of lines) weight.set(round(l.size), (weight.get(round(l.size)) || 0) + l.text.length);
    let best = 0;
    let bestWeight = -1;
    weight.forEach((w, size) => {
        if (w > bestWeight) [best, bestWeight] = [size, w];
    });
    return best;
}

/** tamaño → nivel de encabezado (0 = cuerpo). */
function headingScale(lines, body) {
    const sizes = [...new Set(lines
        .filter(l => l.text.length <= 150 && round(l.size) >= body * 1.15)
        .map(l => round(l.size)))].sort((a, b) => b - a);
    const levelOf = size => {
        const idx = sizes.indexOf(round(size));
        return idx === -1 ? 0 : Math.min(idx + 1, 3);
    };
    levelOf.sizes = sizes;
    return levelOf;
}

function joinLines(a, b) {
    if (/[A-Za-zÀ-ÿ]-$/.test(a) && /^[a-zà-ÿñ]/.test(b)) return a.slice(0, -1) + b;
    return `${a} ${b}`;
}

function gapBetween(a, b) {
    if (!a || !b || a.page !== b.page) return null;
    return a.y - b.y; // negativo al saltar de columna
}

function isIsolatedShortLine(text, gapBefore, gapAfter, normal) {
    if (gapBefore === null && gapAfter === null) return false; // línea sola en su página
    const big = g => g === null || g > normal * 1.6;
    return text.length <= 70 && !/[.,;:!?]$/.test(text) && /^[A-ZÁÉÍÓÚÑÜ0-9¿¡]/.test(text)
        && big(gapBefore) && big(gapAfter);
}

function normalGap(lines, body) {
    const gaps = [];
    for (let i = 1; i < lines.length; i++) {
        const g = gapBetween(lines[i - 1], lines[i]);
        if (g > 0 && round(lines[i].size) === body) gaps.push(g);
    }
    return median(gaps) || body * 1.2;
}

function lineLevel(state, line, text, gaps) {
    if (text.length > 150) return 0;
    const level = state.levelOf(line.size);
    if (level) return level;
    if (line.cells === 1 && isIsolatedShortLine(text, gaps.before, gaps.after, state.normal)) {
        state.stats.isolatedHeadings = (state.stats.isolatedHeadings || 0) + 1;
        return 4;
    }
    return 0;
}

function addHeading(state, level, text, gapBefore) {
    const last = state.blocks[state.blocks.length - 1];
    const continues = last && last === state.cur && last.type === 'h' && last.level === level
        && gapBefore !== null && gapBefore < state.normal * 1.6;
    if (continues) {
        last.text += ` ${text}`; // encabezado en varias líneas
        return;
    }
    state.cur = { type: 'h', level, text };
    state.blocks.push(state.cur);
}

/** ¿Empieza párrafo nuevo? Hueco grande, o fin de frase al cambiar de página/columna. */
function breaksParagraph(cur, gapBefore, normal) {
    if (gapBefore === null || gapBefore < 0) return SENTENCE_END.test(cur.text);
    return gapBefore > normal * 1.6;
}

function addBodyLine(state, line, text, gapBefore) {
    const cur = state.cur;
    const bullet = line.cells === 1 && BULLET.exec(text);
    if (bullet) {
        state.stats.bullets = (state.stats.bullets || 0) + 1;
        state.cur = { type: 'li', depth: 0, ordered: Boolean(bullet[1]), text: bullet[2] };
    } else if (!cur || cur.type === 'h' || cur.table || line.cells > 1 || breaksParagraph(cur, gapBefore, state.normal)) {
        state.cur = { type: 'p', text, table: line.cells > 1 };
    } else {
        if (/[A-Za-zÀ-ÿ]-$/.test(cur.text) && /^[a-zà-ÿñ]/.test(text)) state.stats.hyphenJoins = (state.stats.hyphenJoins || 0) + 1;
        cur.text = joinLines(cur.text, text); // continuación del párrafo o de la viñeta
        return;
    }
    state.blocks.push(state.cur);
}

/**
 * @param {Array<{ number: number, lines: Array }>} pages
 * @param {Object} [stats] - recibe tamaño de cuerpo, tamaños de encabezado y heurísticas aplicadas
 * @returns {Array<Object>} bloques
 */
function pdfLinesToBlocks(pages, stats = {}) {
    const lines = pages.flatMap(p => p.lines.map(l => ({ ...l, page: p.number })));
    const body = bodySize(lines);
    const state = { blocks: [], cur: null, levelOf: headingScale(lines, body), normal: normalGap(lines, body), stats };
    stats.bodySize = body;
    stats.headingSizes = state.levelOf.sizes;
    stats.lineGap = Math.round(state.normal * 10) / 10;

    lines.forEach((line, i) => {
        const text = line.text.trim();
        const gaps = { before: gapBetween(lines[i - 1], line), after: gapBetween(line, lines[i + 1]) };
        const level = lineLevel(state, line, text, gaps);
        if (level) addHeading(state, level, text, gaps.before);
        else addBodyLine(state, line, text, gaps.before);
    });

    return state.blocks.map(({ table: _table, ...block }) => block);
}

module.exports = { pdfLinesToBlocks };
