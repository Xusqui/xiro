'use strict';

/**
 * @fileoverview Imágenes de las diapositivas con IA. La IA solo nombra la imagen en "image" (spec.js): una
 * adjunta ("img1"…), una URL que venía en la petición o una búsqueda de foto libre en Wikimedia Commons
 * (commons.js). Aquí se consigue cada una, se comprueba como en una importación (tipo real por el contenido,
 * SVG sin contenido activo, 5 MB) y se mide su proporción (image-size.js) para maquetarla sin deformarla.
 * Si una no se consigue, la diapositiva pasa al diseño equivalente sin imagen.
 */

const fs = require('fs');
const path = require('path');
const { detectImageType } = require('../../services/slide-package/image-type');
const { isSafeSvg } = require('../../services/slide-package/svg-guard');
const { imageSize } = require('../../services/slide-package/image-size');
const { fetchImage: fetchRemoteImage } = require('../../services/slide-package/remote-image');
const { MAX_ASSET_BYTES } = require('../../public/js/core/slide-package');
const { searchPhoto } = require('./commons');

const MAX_ATTACHED = 4;
const UPLOAD_URL_RE = /^\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]{0,200})$/;

/** { mime, ratio } de una imagen que se puede usar, o null (tipo no admitido, SVG con contenido activo, demasiado grande). */
function inspectImage(buffer, maxBytes = MAX_ASSET_BYTES) {
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > maxBytes) return null;
    const mime = detectImageType(buffer);
    if (!mime || (mime === 'image/svg+xml' && !isSafeSvg(buffer.toString('utf8')))) return null;
    const size = imageSize(buffer, mime);
    const ratio = size ? Math.min(20, Math.max(0.05, Math.round((size.width / size.height) * 10000) / 10000)) : null;
    return { mime, ratio };
}

/**
 * Imágenes que adjuntó el usuario (subidas antes con POST /api/upload), leídas de /uploads/. Las que no
 * existen o no son imágenes válidas se ignoran. El tamaño no se limita: se quedan en /uploads/ como están.
 * @param {Array<{url: string, name?: string}>} list
 * @param {Object} o
 * @param {string} o.uploadDir
 * @param {Function} [o.readFile] - Como fs.promises.readFile (inyectable en tests)
 * @returns {Promise<Array<{ref: string, url: string, name: string, mime: string, ratio: number|null}>>}
 */
async function loadAttachedImages(list, { uploadDir, readFile = fs.promises.readFile }) {
    const out = [];
    for (const item of (Array.isArray(list) ? list : []).slice(0, MAX_ATTACHED)) {
        const match = UPLOAD_URL_RE.exec(item && item.url);
        if (!match) continue;
        let info = null;
        try {
            info = inspectImage(await readFile(path.join(uploadDir, match[1])), Infinity);
        } catch (_err) {
            info = null;
        }
        if (info) out.push({ ref: `img${out.length + 1}`, url: item.url, name: String(item.name || match[1]).slice(0, 80), ...info });
    }
    return out;
}

/** Diseño equivalente sin imagen, o null si no queda nada que enseñar. */
function withoutImage(slide) {
    const rest = { ...slide };
    delete rest.image;
    if (slide.layout === 'split') {
        const { items, text, ...header } = rest;
        return items ? { ...header, layout: 'bullets', items } : { ...header, layout: 'text', text };
    }
    if (slide.layout === 'image') {
        const title = rest.title || rest.caption;
        return title ? { layout: 'statement', title, text: rest.title ? rest.caption || '' : '' } : null;
    }
    return rest;
}

/** La imagen pedida, conseguida y comprobada: { src } (adjunta) o { buffer }, con mime, ratio y crédito; o null. */
async function fetchOne(ref, { attached, fetchImage, findPhoto, signal }) {
    if (ref.kind === 'attached') {
        const found = attached.find(a => a.ref === ref.ref);
        return found ? { src: found.url, mime: found.mime, ratio: found.ratio } : null;
    }
    if (ref.kind === 'url') {
        const buffer = await fetchImage(ref.url, { signal });
        const info = inspectImage(buffer);
        return info ? { buffer, ...info } : null;
    }
    const photo = await findPhoto(ref.query, { signal });
    const info = photo && inspectImage(photo.buffer);
    return info ? { buffer: photo.buffer, credit: photo.credit, ...info } : null;
}

/**
 * Consigue la imagen de cada diapositiva que la pide (todas a la vez; la misma imagen, una sola vez).
 * @param {Object[]} slides - Diapositivas saneadas (spec.js)
 * @param {Object} [o]
 * @param {Array} [o.attached] - loadAttachedImages()
 * @param {Function} [o.fetchImage] - url → Promise<Buffer> (inyectable en tests)
 * @param {Function} [o.findPhoto] - query → Promise<{buffer, credit}|null> (inyectable en tests)
 * @param {AbortSignal} [o.signal]
 * @returns {Promise<{slides: Object[], missing: number}>} missing: imágenes que no se pudieron conseguir
 */
async function resolveSlideImages(slides, { attached = [], fetchImage = fetchRemoteImage, findPhoto = searchPhoto, signal } = {}) {
    const cache = new Map();
    const get = ref => {
        const key = `${ref.kind}:${ref.ref || ref.url || ref.query}`;
        if (!cache.has(key)) cache.set(key, fetchOne(ref, { attached, fetchImage, findPhoto, signal }).catch(() => null));
        return cache.get(key);
    };
    const images = await Promise.all(slides.map(slide => (slide.image ? get(slide.image) : null)));
    let missing = 0;
    const out = [];
    slides.forEach((slide, i) => {
        if (!slide.image || images[i]) {
            out.push(slide.image ? { ...slide, image: images[i] } : slide);
            return;
        }
        missing++;
        const fallback = withoutImage(slide);
        if (fallback) out.push(fallback);
    });
    return { slides: out, missing };
}

module.exports = { loadAttachedImages, resolveSlideImages, inspectImage, MAX_ATTACHED };
