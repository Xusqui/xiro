/**
 * @fileoverview DOCX → bloques Markdown leyendo directamente el OOXML.
 * Encabezados: outlineLvl del párrafo o de su estilo (siguiendo basedOn) y,
 * como red, nombres de estilo «Heading N» / «Título N». Listas: numPr +
 * numbering.xml. Se descartan cabeceras/pies (partes aparte), notas al pie,
 * revisiones borradas y códigos de campo.
 */

'use strict';

const { parseXml, elements, child, findFirst, findAll } = require('./xml-lite');

const SKIP = new Set(['w:pPr', 'w:rPr', 'w:del', 'w:delText', 'w:instrText', 'w:fldData', 'mc:Fallback', 'w:footnoteReference', 'w:endnoteReference']);
const BREAKS = new Set(['w:tab', 'w:br', 'w:cr', 'w:ptab']);
const CONTAINERS = new Set(['w:sdt', 'w:sdtContent', 'w:customXml', 'w:ins', 'w:smartTag']);
const TOC_STYLE = /^(?:toc|tdc)\s?\d$/i;
const STYLE_NAME_LEVEL = /^(?:heading|t[íi]tulo|encabezado|titre|überschrift|titolo)\s*(\d)$/i;

function val(node) {
    return node ? (node.attrs['w:val'] || '') : '';
}

function styleLevel(styleNode) {
    const outline = findFirst(styleNode, 'w:outlineLvl');
    if (outline) {
        const n = parseInt(val(outline), 10);
        if (n >= 0 && n < 9) return n + 1;
    }
    const name = val(child(styleNode, 'w:name'));
    const m = name.match(STYLE_NAME_LEVEL);
    if (m) return Number(m[1]);
    return /^(title|t[íi]tulo)$/i.test(name) ? 1 : 0;
}

/** styleId → nivel de encabezado (0 = no es encabezado), resolviendo herencia. */
function readStyles(xml) {
    const raw = new Map();
    if (xml) {
        for (const s of findAll(parseXml(xml), 'w:style')) {
            raw.set(s.attrs['w:styleId'], { level: styleLevel(s), basedOn: val(child(s, 'w:basedOn')) });
        }
    }
    const resolve = (id, seen = new Set()) => {
        const s = raw.get(id);
        if (!s || seen.has(id)) return 0;
        seen.add(id);
        return s.level || resolve(s.basedOn, seen);
    };
    return id => resolve(id);
}

/** numId → (ilvl → ordenada?) a partir de numbering.xml. */
function readNumbering(xml) {
    const abstract = new Map();
    const nums = new Map();
    if (xml) {
        const root = parseXml(xml);
        for (const a of findAll(root, 'w:abstractNum')) {
            const levels = new Map();
            for (const lvl of elements(a, 'w:lvl')) {
                levels.set(lvl.attrs['w:ilvl'], val(child(lvl, 'w:numFmt')) !== 'bullet');
            }
            abstract.set(a.attrs['w:abstractNumId'], levels);
        }
        for (const n of findAll(root, 'w:num')) {
            nums.set(n.attrs['w:numId'], abstract.get(val(child(n, 'w:abstractNumId'))));
        }
    }
    return (numId, ilvl) => Boolean(nums.get(numId) && nums.get(numId).get(ilvl));
}

function runText(node) {
    let out = '';
    for (const c of node.children) {
        if (typeof c === 'string') continue;
        if (c.name === 'w:t') out += c.children.join('');
        else if (BREAKS.has(c.name)) out += ' ';
        else if (c.name === 'w:noBreakHyphen') out += '-';
        else if (c.name === 'w:p') out += ` ${runText(c)} `; // cuadros de texto
        else if (!SKIP.has(c.name)) out += runText(c);
    }
    return out;
}

function isBold(rPr) {
    const b = rPr && child(rPr, 'w:b');
    return Boolean(b) && !['0', 'false', 'off'].includes(val(b));
}

/** Párrafo corto con todo el texto en negrita y sin puntuación final. */
function looksLikeHeading(p, text) {
    if (text.length < 3 || text.length > 90 || /[.,;:]$/.test(text)) return false;
    const runs = findAll(p, 'w:r').filter(r => runText(r).trim());
    return runs.length > 0 && runs.every(r => isBold(child(r, 'w:rPr')));
}

/** Nivel de encabezado del párrafo (outlineLvl directo o del estilo); 0 si no lo es. */
function headingLevel(pPr, ctx) {
    if (!pPr) return 0;
    const outline = child(pPr, 'w:outlineLvl');
    const level = outline ? parseInt(val(outline), 10) + 1 : ctx.styleLevel(val(child(pPr, 'w:pStyle')));
    return level > 0 && level < 10 ? Math.min(level, 6) : 0;
}

/** Bloque de lista si el párrafo tiene numeración activa. */
function listBlock(pPr, ctx, text) {
    const numPr = pPr && child(pPr, 'w:numPr');
    if (!numPr) return null;
    const numId = val(child(numPr, 'w:numId'));
    const ilvl = val(child(numPr, 'w:ilvl')) || '0';
    if (!numId || numId === '0') return null;
    return { type: 'li', depth: Number(ilvl) || 0, ordered: ctx.isOrdered(numId, ilvl), text };
}

function paragraphBlock(p, ctx) {
    const text = runText(p).trim();
    if (!text) return null;
    const pPr = child(p, 'w:pPr');
    if (pPr && TOC_STYLE.test(val(child(pPr, 'w:pStyle')))) return null; // entradas del índice
    const level = headingLevel(pPr, ctx);
    if (level) return { type: 'h', level, text };
    const item = listBlock(pPr, ctx, text);
    if (item) return item;
    if (looksLikeHeading(p, text)) return { type: 'h', level: 3, text };
    return { type: 'p', text };
}

function tableBlock(tbl) {
    const rows = elements(tbl, 'w:tr').map(tr =>
        elements(tr, 'w:tc').map(tc => findAll(tc, 'w:p').map(runText).join(' ')));
    return { type: 'table', rows };
}

function isTableOfContents(sdt) {
    const gallery = findFirst(child(sdt, 'w:sdtPr') || sdt, 'w:docPartGallery');
    return /table of contents/i.test(val(gallery));
}

function convertBody(node, ctx, out) {
    for (const el of elements(node)) {
        if (el.name === 'w:p') {
            const block = paragraphBlock(el, ctx);
            if (block) out.push(block);
        } else if (el.name === 'w:tbl') {
            out.push(tableBlock(el));
        } else if (el.name === 'w:sdt' && isTableOfContents(el)) {
            continue;
        } else if (CONTAINERS.has(el.name)) {
            convertBody(el, ctx, out);
        }
    }
    return out;
}

/**
 * @param {{ readText: (name: string) => string|null }} zip
 * @returns {Array<Object>} bloques
 */
function docxToBlocks(zip) {
    const documentXml = zip.readText('word/document.xml');
    if (!documentXml) throw new Error('El archivo no es un documento Word válido (falta word/document.xml)');
    const body = findFirst(parseXml(documentXml), 'w:body');
    if (!body) return [];
    const ctx = {
        styleLevel: readStyles(zip.readText('word/styles.xml')),
        isOrdered: readNumbering(zip.readText('word/numbering.xml'))
    };
    return convertBody(body, ctx, []);
}

module.exports = { docxToBlocks };
