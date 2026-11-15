'use strict';

/**
 * @fileoverview Imágenes de un paquete .xiroslide que no vienen en `assets`:
 * - escritas en el propio lienzo como URI data:, por ejemplo un SVG dibujado por una IA generalista, que no
 *   sabe codificar en base64 (data:image/svg+xml;utf8,<svg…>, data:image/svg+xml,%3Csvg… o …;base64,…);
 * - enlazadas a otra web (http/https). Se descargan con remote-image.js porque la CSP de XiRo solo enseña
 *   imágenes del propio servidor; así además no dependen de esa web durante la partida.
 * Cada una pasa las mismas comprobaciones que un asset del paquete y acaba en /uploads/ con el hash de su
 * contenido. Las que no se pueden usar se quitan después, con su aviso.
 */

const { fetchImage: fetchRemoteImage } = require('./remote-image');
const { detectImageType } = require('./image-type');

const DATA_URI_RE = /^data:([^,]*),([\s\S]*)$/i;
const BASE64_RE = /^[A-Za-z0-9+/_-]*={0,2}$/;
const MAX_REMOTE = 12;
const CONCURRENCY = 4;

/** Añade xmlns (y xmlns:xlink si usa xlink:) a la etiqueta <svg> que no lo tenga: sin él, el navegador no lo pinta. */
function withSvgNamespace(text) {
    return text.replace(/<svg\b([^>]*)>/i, (tag, attrs) => {
        let extra = '';
        if (!/\sxmlns\s*=/i.test(attrs)) extra += ' xmlns="http://www.w3.org/2000/svg"';
        if (/\bxlink:/i.test(text) && !/\sxmlns:xlink\s*=/i.test(attrs)) extra += ' xmlns:xlink="http://www.w3.org/1999/xlink"';
        return extra ? `<svg${extra}${attrs}>` : tag;
    });
}

/** Una secuencia %XX%XX… decodificada como UTF-8; si no es UTF-8 válido, tal cual. */
function decodePercent(sequence) {
    try {
        return decodeURIComponent(sequence);
    } catch (_err) {
        return sequence;
    }
}

/**
 * Contenido de una URI data:, o null si no se puede leer.
 * @param {string} src
 * @returns {Buffer|null}
 */
function decodeDataUri(src) {
    const m = DATA_URI_RE.exec(src);
    if (!m) return null;
    let buffer;
    if (m[1].toLowerCase().split(';').some(param => param.trim() === 'base64')) {
        const body = m[2].replace(/\s+/g, '');
        if (!BASE64_RE.test(body)) return null;
        buffer = Buffer.from(body, 'base64');
    } else {
        // Se decodifican los %XX válidos aunque el SVG venga sin codificar: las IA suelen escribir el # de los colores
        // como %23 (como haría el navegador); un % suelto, como en 100%, se deja
        buffer = Buffer.from(m[2].replace(/(?:%[0-9a-f]{2})+/gi, decodePercent), 'utf8');
    }
    return detectImageType(buffer) === 'image/svg+xml' ? Buffer.from(withSvgNamespace(buffer.toString('utf8')), 'utf8') : buffer;
}

/** URLs de imagen (fondo y elementos 'image') de todas las diapositivas, sin repetir. */
function imageSources(slides) {
    const found = new Set();
    slides.forEach(slide => {
        const canvas = (slide && slide.slide_canvas) || {};
        if (canvas.background && typeof canvas.background.image === 'string') found.add(canvas.background.image);
        (Array.isArray(canvas.elements) ? canvas.elements : []).forEach(el => {
            if (el && el.type === 'image' && el.props && typeof el.props.src === 'string') found.add(el.props.src);
        });
    });
    return [...found];
}

/** Ejecuta fn con cada elemento, como mucho `limit` a la vez. */
async function eachLimited(items, limit, fn) {
    let next = 0;
    const worker = async () => {
        while (next < items.length) await fn(items[next++]);
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Imágenes data: y http(s) de las diapositivas, listas para guardar.
 * @param {Array} slides - Diapositivas del paquete
 * @param {Object} o
 * @param {Array} o.warnings - Donde se añaden los avisos
 * @param {Function} o.inspect - buffer → { type } o { problem } (inspectAsset de import.service.js)
 * @param {Function} o.fileFor - (buffer, type) → nombre del fichero en /uploads/
 * @param {Function} [o.fetchImage] - url → Promise<Buffer>; por defecto, remote-image.js
 * @returns {Promise<Map<string, {filename: string, buffer: Buffer}>>} Por URL original
 */
async function resolveInlineImages(slides, { warnings, inspect, fileFor, fetchImage = fetchRemoteImage }) {
    const usable = new Map();
    const add = (src, buffer) => {
        const { problem, type } = buffer ? inspect(buffer) : { problem: 'ASSET_UNREADABLE' };
        if (problem) warnings.push({ code: problem, params: { id: 'inline' } });
        else usable.set(src, { filename: fileFor(buffer, type), buffer });
    };
    const sources = imageSources(slides);
    sources.filter(src => /^data:/i.test(src)).forEach(src => add(src, decodeDataUri(src)));
    const remote = sources.filter(src => /^https?:\/\//i.test(src));
    let failed = Math.max(0, remote.length - MAX_REMOTE);
    await eachLimited(remote.slice(0, MAX_REMOTE), CONCURRENCY, async url => {
        let buffer;
        try {
            buffer = await fetchImage(url);
        } catch (_err) {
            failed++;
            return;
        }
        add(url, buffer);
    });
    if (failed) warnings.push({ code: 'IMAGE_DOWNLOAD_FAILED', params: { n: failed } });
    return usable;
}

module.exports = { resolveInlineImages, decodeDataUri, MAX_REMOTE };
