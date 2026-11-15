/**
 * Simulación de «Importar archivo» / «Pegar» de XiRo (mismo recorrido que services/slide-package/import.service.js
 * e inline-images.js, con sus módulos copiados en lib/xiro/ para normalizar, validar y leer imágenes) sin escribir nada: dice si el paquete entra, con qué avisos y cómo
 * quedarían las diapositivas. Las imágenes data: se leen como en XiRo; las de otras webs, XiRo las descarga al
 * importar: con `remote` (fetchRemoteImages) se simula esa descarga y sin él se dan por buenas.
 */

import crypto from 'node:crypto';
import * as R from './rules.mjs';
import { detectImageType, isSafeSvg } from './media.mjs';
import { parseVideoSource } from './video.mjs';
import { decodeDataUri, MAX_REMOTE } from './xiro.mjs';

export class PackageError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/** Textos de los avisos, como los enseña el admin de XiRo (admin.canvas.io.warn.*). */
export const WARNING_TEXT = {
    ASSET_UNSUPPORTED: 'se quitaría una imagen que no es PNG, JPEG, GIF, WebP ni SVG',
    ASSET_TOO_LARGE: 'se quitaría una imagen de más de 5 MB (o vacía)',
    ASSET_UNREADABLE: 'se quitaría una imagen data: que no se puede leer',
    IMAGE_DOWNLOAD_FAILED: 'no podría descargar imágenes de otras webs y las quitaría',
    SVG_UNSAFE: 'se quitaría un SVG con scripts o enlaces externos',
    MEDIA_DROPPED: 'se quitarían imágenes o vídeos que no se pueden usar',
    ELEMENTS_DROPPED: 'se quitarían elementos que XiRo no sabe mostrar',
    SLIDE_SKIPPED: 'se saltaría una diapositiva no válida'
};

export function describeWarning(w) {
    const p = w.params || {};
    const extra = p.id ? ` (${p.id})` : p.n ? ` (${p.n})` : '';
    return (WARNING_TEXT[w.code] || w.code) + extra;
}

/** Nombre con el que XiRo guardaría la imagen en /uploads/ (hash del contenido). */
export function uploadNameFor(buffer, type) {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
    return `slide-${hash}.${R.MIME_EXTENSIONS[type]}`;
}

function parsePackage(text) {
    if (text.length === 0) throw new PackageError('SLIDE_PACKAGE_INVALID', 'archivo vacío');
    if (Buffer.byteLength(text, 'utf8') > R.MAX_PACKAGE_BYTES) {
        throw new PackageError('SLIDE_PACKAGE_TOO_LARGE', 'el paquete supera 25 MB');
    }
    let data;
    try {
        data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    } catch (err) {
        throw new PackageError('SLIDE_PACKAGE_INVALID', `no es JSON válido (${err.message})`);
    }
    if (!data || typeof data !== 'object' || data.format !== R.FORMAT) {
        throw new PackageError('SLIDE_PACKAGE_INVALID', `no es un paquete de XiRo ("format" debe ser "${R.FORMAT}")`);
    }
    if (Number(data.formatVersion) > R.FORMAT_VERSION) {
        throw new PackageError('SLIDE_PACKAGE_TOO_NEW', `formatVersion ${data.formatVersion} es más nuevo que el que conoce XiRo`);
    }
    const error = R.envelopeError(data);
    if (error) throw new PackageError('SLIDE_PACKAGE_INVALID', error);
    return { ...data, assets: data.assets || [] };
}

/** Tipo real de una imagen, o el aviso por el que XiRo la quitaría (inspectAsset). */
function inspect(buffer) {
    if (buffer.length === 0 || buffer.length > R.MAX_ASSET_BYTES) return { problem: 'ASSET_TOO_LARGE' };
    const type = detectImageType(buffer);
    if (!type) return { problem: 'ASSET_UNSUPPORTED' };
    if (type === 'image/svg+xml' && !isSafeSvg(buffer.toString('utf8'))) return { problem: 'SVG_UNSAFE' };
    return { type };
}

function decodeAssets(assets, warnings) {
    const usable = new Map();
    for (const asset of assets) {
        const buffer = Buffer.from(asset.data, 'base64');
        const { problem, type } = inspect(buffer);
        if (problem) {
            warnings.push({ code: problem, params: { id: asset.id } });
            continue;
        }
        usable.set(asset.id, { id: asset.id, type, buffer, filename: uploadNameFor(buffer, type) });
    }
    return usable;
}

export { decodeDataUri, MAX_REMOTE };

/** URLs de imagen (fondo y elementos 'image') de todas las diapositivas, sin repetir. */
function imageSources(slides) {
    const found = new Set();
    for (const slide of slides) {
        const canvas = (slide && slide.slide_canvas) || {};
        if (canvas.background && typeof canvas.background.image === 'string') found.add(canvas.background.image);
        for (const el of Array.isArray(canvas.elements) ? canvas.elements : []) {
            if (el && el.type === 'image' && el.props && typeof el.props.src === 'string') found.add(el.props.src);
        }
    }
    return [...found];
}

/** Lo que haría XiRo con una URL de imagen de otra web antes de pedirla (checkRemoteUrl, sin DNS). */
function remoteUrlProblem(raw) {
    let url;
    try {
        url = new URL(raw);
    } catch {
        return 'no es una URL';
    }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || !['', '80', '443'].includes(url.port)) return 'URL no admitida';
    if (/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|\[)/i.test(url.hostname)) return 'dirección interna';
    return null;
}

/**
 * Descarga las imágenes de otras webs del paquete, como haría XiRo al importarlo (las 12 primeras, 10 s y 5 MB
 * cada una). Lo que no se puede descargar queda como null.
 * @param {string} text - Contenido del .xiroslide
 * @returns {Promise<Map<string, Buffer|null>>}
 */
export async function fetchRemoteImages(text) {
    let data;
    try {
        data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    } catch {
        return new Map();
    }
    const urls = imageSources(Array.isArray(data && data.slides) ? data.slides : []).filter(src => /^https?:\/\//i.test(src)).slice(0, MAX_REMOTE);
    const pairs = await Promise.all(
        urls.map(async url => {
            if (remoteUrlProblem(url)) return [url, null];
            try {
                const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { Accept: 'image/*' } });
                if (!res.ok || Number(res.headers.get('content-length')) > R.MAX_ASSET_BYTES) return [url, null];
                const buffer = Buffer.from(await res.arrayBuffer());
                return [url, buffer.length > R.MAX_ASSET_BYTES ? null : buffer];
            } catch {
                return [url, null];
            }
        })
    );
    return new Map(pairs);
}

/**
 * Imágenes data: y de otras webs, como resolveInlineImages de XiRo: Map(src → entrada de /uploads/), y también
 * en `usable` (ids data1, url1…) para listarlas y para la vista previa. Sin `remote`, las de otras webs se
 * conservan (entrada { keep: true }), como si se hubieran podido descargar.
 */
function resolveInline(slides, { warnings, remote, usable }) {
    const inline = new Map();
    const add = (src, buffer, kind) => {
        const { problem, type } = buffer ? inspect(buffer) : { problem: 'ASSET_UNREADABLE' };
        if (problem) {
            warnings.push({ code: problem, params: { id: 'inline' } });
            return;
        }
        const entry = { id: `${kind}${inline.size + 1}`, type, buffer, filename: uploadNameFor(buffer, type) };
        inline.set(src, entry);
        usable.set(entry.id, entry);
    };
    const sources = imageSources(slides);
    sources.filter(src => /^data:/i.test(src)).forEach(src => add(src, decodeDataUri(src), 'data'));
    const urls = sources.filter(src => /^https?:\/\//i.test(src));
    if (!remote) {
        urls.forEach(url => inline.set(url, { keep: true }));
        return inline;
    }
    let failed = Math.max(0, urls.length - MAX_REMOTE);
    urls.slice(0, MAX_REMOTE).forEach(url => {
        const buffer = remote.get(url);
        if (buffer) add(url, buffer, 'url');
        else failed++;
    });
    if (failed) warnings.push({ code: 'IMAGE_DOWNLOAD_FAILED', params: { n: failed } });
    return inline;
}

function rewriteCanvas(rawCanvas, media, warnings) {
    const { usable, inline } = media;
    const mapped = R.mapCanvasMedia(rawCanvas, {
        image: url => {
            const id = R.assetIdOf(url);
            if (id) return usable.has(id) ? `/uploads/${usable.get(id).filename}` : null;
            const entry = inline.get(url);
            if (!entry) return null;
            return entry.keep ? url : `/uploads/${entry.filename}`;
        },
        video: url => (R.isLocalUpload(url) || !parseVideoSource(url) ? null : url)
    });
    if (mapped.dropped) warnings.push({ code: 'MEDIA_DROPPED', params: { n: mapped.dropped } });
    const before = mapped.canvas.elements.length;
    const canvas = R.normalizeCanvas(mapped.canvas);
    if (!canvas) return { canvas: null, errors: ['el lienzo no es un objeto'] };
    if (canvas.elements.length < before) {
        warnings.push({ code: 'ELEMENTS_DROPPED', params: { n: before - canvas.elements.length } });
    }
    const errors = R.canvasSchemaErrors(canvas);
    return { canvas: errors.length ? null : canvas, errors };
}

/**
 * Lo que haría XiRo con el paquete. Lanza PackageError si lo rechazaría entero.
 * @param {string} text - Contenido del .xiroslide
 * @param {Object} [options]
 * @param {Map<string, Buffer|null>} [options.remote] - Imágenes de otras webs ya descargadas (fetchRemoteImages)
 * @returns {{slides: Object[], warnings: Object[], skipped: Object[], usable: Map, pkg: Object}}
 */
export function simulateImport(text, { remote } = {}) {
    const pkg = parsePackage(text);
    for (const slide of pkg.slides) {
        const raw = slide.slide_canvas;
        if (raw && Number(raw.version) > R.CANVAS_VERSION) throw new PackageError('SLIDE_PACKAGE_TOO_NEW', `versión de lienzo ${raw.version} demasiado nueva`);
    }
    const warnings = [];
    const usable = decodeAssets(pkg.assets, warnings);
    const inline = resolveInline(pkg.slides, { warnings, remote, usable });
    const slides = [];
    const skipped = [];
    pkg.slides.forEach((slide, index) => {
        const { canvas, errors } = rewriteCanvas(slide.slide_canvas, { usable, inline }, warnings);
        if (canvas) slides.push(canvas);
        else {
            warnings.push({ code: 'SLIDE_SKIPPED', params: { n: index + 1 } });
            skipped.push({ n: index + 1, errors });
        }
    });
    if (!slides.length) throw new PackageError('SLIDE_PACKAGE_EMPTY', 'el paquete no contiene ninguna diapositiva válida');
    return { slides, warnings, skipped, usable, pkg };
}
