/**
 * @fileoverview Troceo del Markdown por secciones para la generación por lotes.
 * En vez de enviar el documento entero (truncado) en cada lote, cada lote
 * recibe un trozo distinto: menos tokens por petición y preguntas repartidas
 * por todo el documento. Cada trozo lleva delante la ruta de encabezados de
 * su sección para que la IA no pierda el contexto.
 */

'use strict';

const HEADING = /^(#{1,6})\s+(.*)$/;

/** Secciones { path: string[] (líneas de encabezado de los ancestros), text } */
function parseSections(markdown) {
    const sections = [];
    const path = [];
    let current = { path: [], lines: [] };
    for (const line of markdown.split('\n')) {
        const h = line.match(HEADING);
        if (h) {
            if (current.lines.some(l => l.trim())) sections.push(current);
            const level = h[1].length;
            while (path.length && path[path.length - 1].level >= level) path.pop();
            current = { path: path.map(p => p.line), lines: [line] };
            path.push({ level, line });
        } else {
            current.lines.push(line);
        }
    }
    if (current.lines.some(l => l.trim())) sections.push(current);
    return sections.map(s => ({ path: s.path, text: s.lines.join('\n').trim() }));
}

/** Unidades de troceo: párrafos y, si no caben, frases o cortes duros (con su separador). */
function units(text, max) {
    const out = [];
    for (const para of text.split(/\n{2,}/)) {
        const pieces = para.length <= max ? [para] : para.match(/[^.!?]+[.!?]*\s*/g) || [para];
        pieces.forEach((piece, i) => {
            const parts = piece.length <= max ? [piece] : piece.match(new RegExp(`[\\s\\S]{1,${max}}`, 'g'));
            parts.forEach((part, j) => out.push({ text: part, sep: i === 0 && j === 0 ? '\n\n' : '' }));
        });
    }
    return out;
}

/** Parte un texto largo por párrafos (y, si hace falta, por frases) sin pasar de max. */
function splitLong(text, max) {
    const pieces = [];
    let buf = '';
    for (const u of units(text, max)) {
        // Un encabezado nunca se queda solo: viaja con su primer contenido
        if (buf && !HEADING.test(buf.trim()) && buf.length + u.text.length + 2 > max) {
            pieces.push(buf.trim());
            buf = '';
        }
        buf += (buf ? u.sep : '') + u.text;
    }
    if (buf.trim()) pieces.push(buf.trim());
    return pieces;
}

function withContext(path, text) {
    const missing = path.filter(line => !text.startsWith(line));
    return missing.length ? `${missing.join('\n')}\n\n${text}` : text;
}

/**
 * @param {string} markdown
 * @param {number} maxChars - tamaño objetivo de cada trozo (0 = sin trocear)
 * @returns {string[]} trozos en orden de documento
 */
function splitSections(markdown, maxChars) {
    const text = String(markdown || '').trim();
    if (!maxChars || maxChars <= 0 || text.length <= maxChars * 1.3) return [text];

    const chunks = [];
    let buf = null;
    const flush = () => {
        if (buf) chunks.push(withContext(buf.path, buf.text));
        buf = null;
    };
    for (const section of parseSections(text)) {
        const firstLine = section.text.split('\n')[0];
        // Las continuaciones de una sección larga repiten también su propio encabezado
        const continuationPath = HEADING.test(firstLine) ? section.path.concat(firstLine) : section.path;
        splitLong(section.text, maxChars).forEach((piece, i) => {
            // Secciones pequeñas consecutivas se agrupan en un mismo trozo
            if (buf && buf.text.length + piece.length + 2 <= maxChars) {
                buf.text += `\n\n${piece}`;
            } else {
                flush();
                buf = { path: i === 0 ? section.path : continuationPath, text: piece };
            }
        });
    }
    flush();
    return chunks;
}

/**
 * Plan de reparto: con más trozos que lotes, los lotes se espacian por todo el
 * documento; con más lotes que trozos, se recorren en ciclo.
 * @param {string} markdown
 * @param {{ maxChars: number, totalBatches: number }} options
 * @returns {{ chunks: string[], next: () => string, lastIndex: number }}
 *          lastIndex: posición del último trozo entregado (para el log)
 */
function createChunkPlan(markdown, { maxChars, totalBatches }) {
    const chunks = splitSections(markdown, maxChars);
    const batches = Math.max(1, totalBatches || 1);
    let index = 0;
    return {
        chunks,
        lastIndex: -1,
        next() {
            const i = index++;
            const pick = chunks.length > batches ? Math.floor((i * chunks.length) / batches) : i;
            this.lastIndex = pick % chunks.length;
            return chunks[this.lastIndex];
        }
    };
}

module.exports = { splitSections, createChunkPlan };
