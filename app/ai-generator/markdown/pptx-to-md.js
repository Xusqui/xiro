/**
 * @fileoverview PPTX → bloques Markdown. Las diapositivas se recorren en el
 * orden de presentation.xml (p:sldIdLst + relaciones), no en el de los
 * ficheros. Cada una sale como «## Diapositiva N: título» con sus viñetas
 * (a:pPr lvl = profundidad) y sus tablas. Las notas del orador se descartan.
 */

'use strict';

const path = require('path').posix;
const { parseXml, elements, child, findFirst, findAll } = require('./xml-lite');

const TITLE_TYPES = new Set(['title', 'ctrTitle']);

/** Destino de una relación: relativo a ppt/ o absoluto desde la raíz del paquete. */
function resolveTarget(target) {
    return target.startsWith('/') ? target.slice(1) : path.normalize(path.join('ppt', target));
}

/** Rutas de las diapositivas en orden de presentación. */
function slidePaths(zip) {
    const presentation = zip.readText('ppt/presentation.xml');
    const rels = zip.readText('ppt/_rels/presentation.xml.rels');
    if (presentation && rels) {
        const targets = new Map(findAll(parseXml(rels), 'Relationship')
            .map(r => [r.attrs.Id, resolveTarget(r.attrs.Target || '')]));
        const ordered = findAll(parseXml(presentation), 'p:sldId')
            .map(s => targets.get(s.attrs['r:id']))
            .filter(p => p && zip.has(p));
        if (ordered.length > 0) return ordered;
    }
    // Sin relaciones legibles: orden numérico de los ficheros
    return zip.names
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
}

function paragraphText(p) {
    let out = '';
    for (const c of elements(p)) {
        if (c.name === 'a:r' || c.name === 'a:fld') out += findAll(c, 'a:t').map(t => t.children.join('')).join('');
        else if (c.name === 'a:br') out += ' ';
    }
    return out.trim();
}

function isTitleShape(sp) {
    const ph = findFirst(child(sp, 'p:nvSpPr') || sp, 'p:ph');
    return Boolean(ph) && TITLE_TYPES.has(ph.attrs.type);
}

function tableBlock(tbl) {
    const rows = elements(tbl, 'a:tr').map(tr =>
        elements(tr, 'a:tc').map(tc => findAll(tc, 'a:p').map(paragraphText).join(' ')));
    return { type: 'table', rows };
}

function collectShapes(tree, slide) {
    for (const el of elements(tree)) {
        if (el.name === 'p:sp') {
            const paragraphs = findAll(el, 'a:p');
            if (isTitleShape(el) && !slide.title) {
                slide.title = paragraphs.map(paragraphText).filter(Boolean).join(' ');
                continue;
            }
            for (const p of paragraphs) {
                const text = paragraphText(p);
                const pPr = child(p, 'a:pPr');
                if (text) slide.blocks.push({ type: 'li', depth: Number(pPr && pPr.attrs.lvl) || 0, text });
            }
        } else if (el.name === 'p:graphicFrame') {
            const tbl = findFirst(el, 'a:tbl');
            if (tbl) slide.blocks.push(tableBlock(tbl));
        } else if (el.name === 'p:grpSp') {
            collectShapes(el, slide);
        }
    }
}

/**
 * @param {{ readText: Function, has: Function, names: string[] }} zip
 * @returns {Array<Object>} bloques
 */
function pptxToBlocks(zip) {
    const out = [];
    slidePaths(zip).forEach((slidePath, i) => {
        const tree = findFirst(parseXml(zip.readText(slidePath) || ''), 'p:spTree');
        if (!tree) return;
        const slide = { title: '', blocks: [] };
        collectShapes(tree, slide);
        if (!slide.title && slide.blocks.length === 0) return;
        const heading = slide.title ? `Diapositiva ${i + 1}: ${slide.title}` : `Diapositiva ${i + 1}`;
        out.push({ type: 'h', level: 2, text: heading }, ...slide.blocks);
    });
    return out;
}

module.exports = { pptxToBlocks };
