/**
 * @fileoverview Conversión transparente de cualquier documento subido a Markdown
 * antes de entregarlo a la IA. Implementación propia sin dependencias nuevas:
 * zlib nativo para los ZIP ofimáticos y pdf.js (pdf-parse, ya instalado) solo
 * para decodificar las fuentes del PDF.
 *
 * Formatos: PDF, DOCX, ODT, ODP, PPTX, EPUB, RTF, HTML, Markdown y texto.
 */

'use strict';

const { openZip, isZip } = require('./zip-reader');
const { renderBlocks } = require('./md-render');
const { normalizeMarkdown } = require('./md-normalize');
const { docxToBlocks } = require('./docx-to-md');
const { odfToBlocks } = require('./odf-to-md');
const { pptxToBlocks } = require('./pptx-to-md');
const { epubToBlocks } = require('./epub-to-md');
const { htmlToBlocks, decodeHtmlBuffer } = require('./html-to-md');
const { rtfToBlocks } = require('./rtf-to-md');
const { extractPdfPages } = require('./pdf-extract');
const { buildPageLines } = require('./pdf-lines');
const { pdfLinesToBlocks } = require('./pdf-blocks');

const OLE_MAGIC = 'd0cf11e0a1b11ae1';
const LEGACY_FORMATS = new Set(['pdf', 'docx', 'txt']);

/** Error que no merece reintento con el extractor antiguo. */
function definitive(message) {
    const err = new Error(message);
    err.definitive = true;
    return err;
}

function zipFormat(zip) {
    if (zip.has('word/document.xml')) return 'docx';
    if (zip.has('ppt/presentation.xml')) return 'pptx';
    const mimetype = (zip.readText('mimetype') || '').trim();
    if (mimetype === 'application/epub+zip') return 'epub';
    if (/opendocument\.(text|presentation)/.test(mimetype)) return 'odf';
    if (zip.has('xl/workbook.xml') || /spreadsheet/.test(mimetype)) {
        throw definitive('Las hojas de cálculo no están soportadas. Use PDF, DOCX, ODT, PPTX, EPUB, RTF, HTML o TXT.');
    }
    throw definitive('Tipo de archivo comprimido no reconocido. Use PDF, DOCX, ODT, PPTX, EPUB, RTF, HTML o TXT.');
}

const ZIP_CONVERTERS = { docx: docxToBlocks, pptx: pptxToBlocks, epub: epubToBlocks, odf: odfToBlocks };

/** Texto plano: UTF-8 y, si no es UTF-8 válido, Windows-1252 (ficheros antiguos de Windows). */
function decodeText(buffer) {
    const utf8 = buffer.toString('utf8').replace(/^\ufeff/, '');
    if (!utf8.includes('�')) return utf8;
    try {
        return new TextDecoder('windows-1252').decode(buffer);
    } catch {
        return buffer.toString('latin1');
    }
}

function looksBinary(buffer) {
    const sample = buffer.subarray(0, 4096);
    let zeros = 0;
    for (const byte of sample) if (byte === 0) zeros++;
    return zeros > sample.length * 0.01;
}

function textFormat(buffer, ext) {
    const head = buffer.subarray(0, 512).toString('latin1').trimStart().toLowerCase();
    if (head.startsWith('{\\rtf')) return 'rtf';
    if (['html', 'htm', 'xhtml'].includes(ext) || /^(<\?xml[^>]*>\s*)?<(!doctype html|html)/.test(head)) return 'html';
    if (['md', 'markdown'].includes(ext)) return 'md';
    if (looksBinary(buffer)) throw definitive(`Tipo de archivo no soportado: .${ext || '?'}`);
    return 'txt';
}

function detectFormat(buffer, ext) {
    if (buffer.subarray(0, 8).toString('hex') === OLE_MAGIC) {
        throw definitive('El formato .doc antiguo no está soportado. Ábrelo en Word y guárdalo como .docx.');
    }
    if (buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) return 'pdf';
    if (isZip(buffer)) return 'zip';
    return textFormat(buffer, ext);
}

/** Bloques del documento (null en md/txt, que pasan como texto). Anota en stats lo propio del formato. */
async function toBlocks(buffer, format, stats) {
    if (format === 'zip') {
        const zip = openZip(buffer);
        stats.format = zipFormat(zip);
        const blocks = ZIP_CONVERTERS[stats.format](zip);
        stats.zip = zip.stats();
        return blocks;
    }
    if (format === 'pdf') {
        const pages = await extractPdfPages(buffer);
        stats.pdf = { pages: pages.length, fragments: pages.reduce((n, p) => n + p.items.length, 0) };
        return pdfLinesToBlocks(buildPageLines(pages, stats.pdf), stats.pdf);
    }
    if (format === 'rtf') return rtfToBlocks(buffer);
    if (format === 'html') return htmlToBlocks(decodeHtmlBuffer(buffer));
    return null;
}

function countBlocks(blocks) {
    const counts = { h: 0, p: 0, li: 0, table: 0 };
    for (const b of blocks) counts[b.type] = (counts[b.type] || 0) + 1;
    return counts;
}

/**
 * Convierte un fichero subido (multer memoryStorage) a Markdown limpio.
 * stats (para el log, sin contenido del documento): bytes, format, ms,
 * rawChars (antes de la limpieza final), mdChars, blocks, normalize y,
 * según el formato, zip o pdf.
 * @param {{ buffer: Buffer, originalname?: string }} file
 * @returns {Promise<{ markdown: string, format: string, stats: Object }>}
 */
async function convertToMarkdown(file) {
    const started = Date.now();
    const { buffer, originalname } = file || {};
    if (!buffer || buffer.length === 0) throw definitive('El archivo está vacío');
    const ext = (originalname || '').split('.').pop().toLowerCase();

    const detected = detectFormat(buffer, ext);
    const stats = { bytes: buffer.length, format: detected };
    const blocks = await toBlocks(buffer, detected, stats);
    const raw = blocks ? renderBlocks(blocks) : decodeText(buffer);
    if (blocks) stats.blocks = countBlocks(blocks);

    stats.normalize = {};
    const markdown = normalizeMarkdown(raw, { stats: stats.normalize });
    Object.assign(stats, { rawChars: raw.length, mdChars: markdown.length, ms: Date.now() - started });
    return { markdown, format: stats.format, stats };
}

/**
 * Igual que convertToMarkdown, pero si el conversor propio falla en un PDF,
 * DOCX o TXT se recurre al extractor de texto plano anterior.
 * @param {{ buffer: Buffer, mimetype?: string, originalname?: string }} file
 * @param {{ legacyExtract: Function, onFallback?: Function }} deps
 * @returns {Promise<{ markdown: string, format: string, fallback: boolean, stats: Object }>}
 */
async function documentToMarkdown(file, { legacyExtract, onFallback }) {
    const started = Date.now();
    try {
        return { ...(await convertToMarkdown(file)), fallback: false };
    } catch (err) {
        const ext = ((file && file.originalname) || '').split('.').pop().toLowerCase();
        if (err.definitive || !LEGACY_FORMATS.has(ext)) throw err;
        if (onFallback) onFallback(err);
        try {
            const markdown = await legacyExtract(file);
            const stats = {
                bytes: file.buffer.length,
                format: ext,
                mdChars: markdown.length,
                ms: Date.now() - started
            };
            return { markdown, format: ext, fallback: true, stats };
        } catch {
            throw err;
        }
    }
}

module.exports = { convertToMarkdown, documentToMarkdown };
