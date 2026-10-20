/**
 * @fileoverview Reconstrucción de líneas de un PDF a partir de los fragmentos
 * posicionados de pdf.js:
 *  - agrupa por línea base y ordena por x, insertando espacios según el hueco
 *  - un hueco muy ancho separa «segmentos» (columnas de tabla)
 *  - detecta páginas a dos columnas y las lee columna a columna
 *  - quita cabeceras/pies que se repiten en muchas páginas y los números de página
 */

'use strict';

const WIDE_GAP = 2.5; // en múltiplos del tamaño de letra
const SPACE_GAP = 0.15;
const PAGE_NUMBER =
    /^(?:p[áa]g(?:ina)?\.?|page|p\.)?\s*[-–]?\s*\d{1,4}\s*[-–]?\s*(?:(?:de|of|\/)\s*\d{1,4})?$|^[ivxlc]{1,7}$/i;

function finishLine(line) {
    const items = line.items.sort((a, b) => a.x - b.x);
    const segments = [];
    let seg = null;
    let prevEnd = -Infinity;
    for (const it of items) {
        const gap = it.x - prevEnd;
        if (!seg || gap > line.size * WIDE_GAP) {
            seg = { x: it.x, text: it.str };
            segments.push(seg);
        } else {
            const needsSpace = gap > line.size * SPACE_GAP && !/\s$/.test(seg.text) && !/^\s/.test(it.str);
            seg.text += (needsSpace ? ' ' : '') + it.str;
        }
        seg.xEnd = it.x + it.width;
        prevEnd = Math.max(prevEnd, seg.xEnd);
    }
    const parts = segments.map(s => s.text.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { y: line.y, size: line.size, x: items[0].x, segments, text: parts.join(' | '), cells: parts.length };
}

/** Agrupa fragmentos (de una página o columna) en líneas de arriba abajo. */
function groupLines(items) {
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const it of sorted) {
        const line = lines[lines.length - 1];
        if (line && Math.abs(line.y - it.y) <= Math.max(line.size, it.size) * 0.4) {
            line.items.push(it);
            line.size = Math.max(line.size, it.size);
        } else {
            lines.push({ y: it.y, size: it.size, items: [it] });
        }
    }
    return lines.map(finishLine).filter(l => l.text);
}

function median(values) {
    const s = [...values].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/** x del canal entre dos columnas, o null si la página no es a dos columnas. */
function findGutter(lines) {
    if (lines.length < 8) return null;
    const mids = lines.filter(l => l.segments.length === 2).map(l => (l.segments[0].xEnd + l.segments[1].x) / 2);
    if (mids.length < lines.length * 0.4) return null;
    const gutter = median(mids);
    const size = median(lines.map(l => l.size));
    const aligned = mids.filter(m => Math.abs(m - gutter) < size * 2).length;
    return aligned >= mids.length * 0.8 ? gutter : null;
}

/** Líneas de una página en orden de lectura (columna izquierda y luego derecha). */
function pageLines(items) {
    const lines = groupLines(items);
    const gutter = findGutter(lines);
    if (gutter === null) return { lines, twoColumns: false };
    const left = items.filter(it => it.x < gutter);
    const right = items.filter(it => it.x >= gutter);
    return { lines: [...groupLines(left), ...groupLines(right)], twoColumns: true };
}

function runningKey(text) {
    return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

/**
 * Línea candidata a cabecera/pie: entre las 2 primeras o últimas de la página
 * y dentro de la franja superior o inferior (15 % de la altura).
 */
function isEdge(page, line, i) {
    const len = page.lines.length;
    const inMargin = !page.height || line.y > page.height * 0.85 || line.y < page.height * 0.15;
    return (i < 2 || i >= len - 2) && inMargin;
}

/** Anota en stats lo quitado (con hasta 3 ejemplos cortos de cabecera/pie para depurar). */
function noteRemoved(stats, kind, text) {
    stats[kind] = (stats[kind] || 0) + 1;
    if (kind !== 'runningLines') return;
    stats.runningSamples = stats.runningSamples || [];
    const sample = text.slice(0, 60);
    if (stats.runningSamples.length < 3 && !stats.runningSamples.includes(sample)) stats.runningSamples.push(sample);
}

/** Quita cabeceras, pies que se repiten y números de página. */
function removeRunningLines(pages, stats) {
    const counts = new Map();
    for (const page of pages) {
        const keys = new Set(page.lines.filter((l, i) => isEdge(page, l, i)).map(l => runningKey(l.text)));
        keys.forEach(k => counts.set(k, (counts.get(k) || 0) + 1));
    }
    const threshold = Math.max(2, Math.ceil(pages.length * 0.5));
    const repeated = key => pages.length >= 3 && (counts.get(key) || 0) >= threshold;

    return pages.map(page => ({
        ...page,
        lines: page.lines.filter((line, i) => {
            if (!isEdge(page, line, i)) return true;
            const kind = PAGE_NUMBER.test(line.text.trim())
                ? 'pageNumbers'
                : repeated(runningKey(line.text))
                    ? 'runningLines'
                    : null;
            if (!kind) return true;
            noteRemoved(stats, kind, line.text);
            return false;
        })
    }));
}

/**
 * @param {Array<{ number: number, items: Array }>} pages
 * @param {Object} [stats] - recibe líneas, páginas a dos columnas y lo quitado (para el log)
 * @returns {Array<{ number: number, lines: Array }>}
 */
function buildPageLines(pages, stats = {}) {
    const built = pages.map(p => {
        const { lines, twoColumns } = pageLines(p.items);
        if (twoColumns) stats.twoColumnPages = (stats.twoColumnPages || 0) + 1;
        return { number: p.number, height: p.height, lines };
    });
    stats.lines = built.reduce((n, p) => n + p.lines.length, 0);
    return removeRunningLines(built, stats);
}

module.exports = { buildPageLines, groupLines, median };
