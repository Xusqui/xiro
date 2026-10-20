/**
 * @fileoverview ODT / ODP (OpenDocument) → bloques Markdown desde content.xml.
 * text:h aporta el nivel (text:outline-level); las listas se anidan con
 * text:list; las tablas salen como tablas GFM. En presentaciones cada
 * draw:page es una «Diapositiva N». Notas al pie y anotaciones se descartan.
 */

'use strict';

const { parseXml, elements, findFirst } = require('./xml-lite');

const SKIP = new Set([
    'text:note',
    'office:annotation',
    'text:tracked-changes',
    'presentation:notes',
    'text:sequence-decls',
    'text:table-of-content',
    'text:illustration-index',
    'text:alphabetical-index',
    'text:bibliography'
]);

function inlineText(node) {
    let out = '';
    for (const c of node.children) {
        if (typeof c === 'string') out += c;
        else if (c.name === 'text:s') out += ' '.repeat(Math.min(Number(c.attrs['text:c']) || 1, 4));
        else if (c.name === 'text:tab' || c.name === 'text:line-break') out += ' ';
        else if (!SKIP.has(c.name)) out += inlineText(c);
    }
    return out;
}

function pushList(list, depth, out) {
    for (const item of elements(list)) {
        if (item.name !== 'text:list-item' && item.name !== 'text:list-header') continue;
        for (const el of elements(item)) {
            if (el.name === 'text:list') pushList(el, depth + 1, out);
            else if (el.name === 'text:p' || el.name === 'text:h') {
                out.push({ type: 'li', depth, ordered: false, text: inlineText(el) });
            }
        }
    }
}

function tableBlock(table) {
    const rows = [];
    const collect = node => {
        for (const el of elements(node)) {
            if (el.name === 'table:table-row') {
                rows.push(elements(el, 'table:table-cell').map(inlineText));
            } else if (el.name === 'table:table-header-rows' || el.name === 'table:table-rows') {
                collect(el);
            }
        }
    };
    collect(table);
    return { type: 'table', rows };
}

function convert(node, out) {
    for (const el of elements(node)) {
        if (SKIP.has(el.name)) continue;
        if (el.name === 'text:h') {
            out.push({ type: 'h', level: Number(el.attrs['text:outline-level']) || 1, text: inlineText(el) });
        } else if (el.name === 'text:p') {
            out.push({ type: 'p', text: inlineText(el) });
        } else if (el.name === 'text:list') {
            pushList(el, 0, out);
        } else if (el.name === 'table:table') {
            out.push(tableBlock(el));
        } else {
            convert(el, out); // text:section, draw:frame, draw:text-box, office:text…
        }
    }
    return out;
}

function presentationBlocks(presentation) {
    const out = [];
    elements(presentation, 'draw:page').forEach((page, i) => {
        const content = convert(page, []);
        if (content.length === 0) return;
        out.push({ type: 'h', level: 2, text: `Diapositiva ${i + 1}` });
        out.push(...content.map(b => (b.type === 'p' ? { type: 'li', depth: 0, text: b.text } : b)));
    });
    return out;
}

/**
 * @param {{ readText: (name: string) => string|null }} zip
 * @returns {Array<Object>} bloques
 */
function odfToBlocks(zip) {
    const xml = zip.readText('content.xml');
    if (!xml) throw new Error('El archivo no es un documento OpenDocument válido (falta content.xml)');
    const body = findFirst(parseXml(xml), 'office:body');
    if (!body) return [];
    const presentation = findFirst(body, 'office:presentation');
    if (presentation) return presentationBlocks(presentation);
    return convert(findFirst(body, 'office:text') || body, []);
}

module.exports = { odfToBlocks };
