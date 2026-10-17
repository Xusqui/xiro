/**
 * @fileoverview EPUB → bloques Markdown: container.xml → paquete OPF → spine
 * (orden de lectura) → cada capítulo XHTML pasa por html-to-md. Se omiten el
 * documento de navegación y la tabla de contenidos NCX.
 */

'use strict';

const path = require('path').posix;
const { parseXml, findFirst, findAll } = require('./xml-lite');
const { htmlToBlocks } = require('./html-to-md');

function safeDecode(href) {
    try {
        return decodeURIComponent(href);
    } catch {
        return href;
    }
}

function spinePaths(zip) {
    const container = zip.readText('META-INF/container.xml');
    const rootfile = container && findFirst(parseXml(container), 'rootfile');
    const opfPath = rootfile && rootfile.attrs['full-path'];
    const opfXml = opfPath && zip.readText(opfPath);
    if (!opfXml) throw new Error('El archivo no es un EPUB válido (falta el paquete OPF)');

    const opf = parseXml(opfXml);
    const base = path.dirname(opfPath);
    const manifest = new Map();
    for (const item of findAll(opf, 'item')) {
        if (/\bnav\b/.test(item.attrs.properties || '') || /ncx/.test(item.attrs['media-type'] || '')) continue;
        const href = safeDecode((item.attrs.href || '').split('#')[0]);
        manifest.set(item.attrs.id, path.normalize(path.join(base, href)));
    }
    return findAll(opf, 'itemref')
        .map(ref => manifest.get(ref.attrs.idref))
        .filter(p => p && zip.has(p));
}

/**
 * @param {{ readText: Function, has: Function }} zip
 * @returns {Array<Object>} bloques
 */
function epubToBlocks(zip) {
    const out = [];
    for (const chapter of spinePaths(zip)) {
        out.push(...htmlToBlocks(zip.readText(chapter) || ''));
    }
    return out;
}

module.exports = { epubToBlocks };
