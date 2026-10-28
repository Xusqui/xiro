/**
 * @fileoverview Convierte la lista de bloques intermedia en Markdown compacto.
 * Bloques que producen los conversores:
 *   { type: 'h', level, text } | { type: 'p', text }
 *   { type: 'li', depth, ordered, text } | { type: 'table', rows: string[][] }
 * Sin negritas ni cursivas: no aportan contenido a la IA y gastan tokens.
 */

'use strict';

/** Colapsa espacios y saltos de línea de un fragmento en línea. */
function inline(text) {
    return String(text || '')
        .replace(/[\s\u00a0]+/g, ' ')
        .trim();
}

function cell(text) {
    return inline(text).replace(/\|/g, '\\|');
}

function renderTable(rows) {
    const clean = rows.map(r => r.map(cell)).filter(r => r.some(Boolean));
    if (clean.length === 0) return '';
    const cols = Math.max(...clean.map(r => r.length));

    // Tablas de maquetación (una sola columna o una sola celda) se leen como párrafos
    if (cols === 1)
        return clean
            .map(r => r[0])
            .filter(Boolean)
            .join('\n\n');

    const line = r => `| ${Array.from({ length: cols }, (_, i) => r[i] || '').join(' | ')} |`;
    const separator = `|${'---|'.repeat(cols)}`;
    return [line(clean[0]), separator, ...clean.slice(1).map(line)].join('\n');
}

function renderBlock(block) {
    if (block.type === 'table') return renderTable(block.rows);
    const text = inline(block.text);
    if (!text) return '';
    if (block.type === 'h') {
        const level = Math.min(6, Math.max(1, block.level || 1));
        return `${'#'.repeat(level)} ${text}`;
    }
    if (block.type === 'li') {
        const indent = '  '.repeat(Math.min(6, Math.max(0, block.depth || 0)));
        return `${indent}${block.ordered ? '1.' : '-'} ${text}`;
    }
    return text;
}

/**
 * @param {Array<Object>} blocks
 * @returns {string}
 */
function renderBlocks(blocks) {
    let out = '';
    let prevType = null;
    for (const block of blocks) {
        const md = renderBlock(block);
        if (!md) continue;
        // Los elementos de lista consecutivos van pegados; el resto, separados por línea en blanco
        const sep = !out ? '' : prevType === 'li' && block.type === 'li' ? '\n' : '\n\n';
        out += sep + md;
        prevType = block.type;
    }
    return out;
}

module.exports = { renderBlocks };
