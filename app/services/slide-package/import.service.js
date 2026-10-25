/**
 * @fileoverview Importación de paquetes .xiroslide (diapositivas libres de otra instalación de XiRo, de la IA
 * de XiRo o de una IA generalista). Valida el sobre, comprueba cada imagen por su contenido (los SVG, además,
 * sin contenido activo), sustituye las referencias asset:<id> por URLs de /uploads/ y valida cada lienzo con
 * el mismo esquema que al guardar un juego. Las imágenes escritas como data: y las enlazadas a otra web
 * también acaban en /uploads/ (inline-images.js): la CSP solo enseña imágenes del propio servidor.
 * Solo escribe ficheros si queda al menos una diapositiva válida, y los nombra con el hash del contenido:
 * importar dos veces lo mismo no duplica ficheros.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { uploadDir: DEFAULT_UPLOAD_DIR } = require('../../config/multer');
const SlidePackage = require('../../public/js/core/slide-package');
const { normalizeCanvas, collectMediaRefs, VERSION: CANVAS_VERSION } = require('../../public/js/core/slide-canvas-model');
const { parseVideoSource } = require('../../public/js/core/video-source');
const { canvasSchema } = require('../../application/validators/CanvasSlideValidator');
const { validatePackage } = require('../../application/validators/SlidePackageValidator');
const { detectImageType } = require('./image-type');
const { isSafeSvg } = require('./svg-guard');
const { resolveInlineImages } = require('./inline-images');

const INVALID_MESSAGE = 'El archivo no es un paquete de diapositivas válido';
const MAX_PACKAGE_MB = SlidePackage.MAX_PACKAGE_BYTES / 1024 / 1024;

/** Error con status HTTP, código estable y parámetros para el cliente (handleRouteError). */
function packageError(code, status, message, params) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    if (params) err.params = params;
    return err;
}

function tooNewError(version) {
    return packageError('SLIDE_PACKAGE_TOO_NEW', 422, 'El paquete se creó con una versión más reciente de XiRo', {
        version
    });
}

/** Lee y valida el sobre del paquete. */
function parsePackage(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw packageError('SLIDE_PACKAGE_INVALID', 400, INVALID_MESSAGE);
    }
    if (buffer.length > SlidePackage.MAX_PACKAGE_BYTES) {
        throw packageError('SLIDE_PACKAGE_TOO_LARGE', 413, 'El paquete es demasiado grande', { maxMb: MAX_PACKAGE_MB });
    }
    let data;
    try {
        data = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
    } catch (_err) {
        throw packageError('SLIDE_PACKAGE_INVALID', 400, INVALID_MESSAGE);
    }
    if (!data || typeof data !== 'object' || data.format !== SlidePackage.FORMAT) {
        throw packageError('SLIDE_PACKAGE_INVALID', 400, INVALID_MESSAGE);
    }
    if (Number(data.formatVersion) > SlidePackage.FORMAT_VERSION) throw tooNewError(data.formatVersion);
    const { value, error } = validatePackage(data);
    if (error) throw packageError('SLIDE_PACKAGE_INVALID', 400, INVALID_MESSAGE);
    return value;
}

/** Tipo real de la imagen, o el código del aviso si no se puede importar. */
function inspectAsset(buffer) {
    if (buffer.length === 0 || buffer.length > SlidePackage.MAX_ASSET_BYTES) return { problem: 'ASSET_TOO_LARGE' };
    const type = detectImageType(buffer);
    if (!type) return { problem: 'ASSET_UNSUPPORTED' };
    if (type === 'image/svg+xml' && !isSafeSvg(buffer.toString('utf8'))) return { problem: 'SVG_UNSAFE' };
    return { type };
}

/** Nombre en /uploads/ de una imagen: el hash de su contenido, para no duplicar ficheros. */
function uploadName(buffer, type) {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
    return `slide-${hash}.${SlidePackage.MIME_EXTENSIONS[type]}`;
}

/** Imágenes utilizables del paquete (id → { filename, buffer }); avisa de las descartadas. */
function decodeAssets(assets, warnings) {
    const usable = new Map();
    for (const asset of assets) {
        const buffer = Buffer.from(asset.data, 'base64');
        const { problem, type } = inspectAsset(buffer);
        if (problem) {
            warnings.push({ code: problem, params: { id: asset.id } });
            continue;
        }
        usable.set(asset.id, { filename: uploadName(buffer, type), buffer });
    }
    return usable;
}

/**
 * URL local de una imagen: las del paquete (asset:<id>) y las data: o de otra web ya descargadas pasan a
 * /uploads/; una de /uploads/ solo se conserva si es de confianza (las que el usuario adjunta a la IA de XiRo).
 * El resto se descarta.
 */
function imageUrlFor(url, media) {
    const id = SlidePackage.assetIdOf(url);
    if (id) return media.assets.has(id) ? `/uploads/${media.assets.get(id).filename}` : null;
    if (media.inline.has(url)) return `/uploads/${media.inline.get(url).filename}`;
    return media.trusted.has(url) ? url : null;
}

/** Los vídeos de /uploads/ de otra instalación no existen aquí; tampoco se aceptan URLs no compatibles. */
function videoUrlFor(url) {
    return SlidePackage.isLocalUpload(url) || !parseVideoSource(url) ? null : url;
}

/** Falla si algún lienzo es de una versión más reciente de XiRo (antes de descargar nada). */
function checkCanvasVersions(slides) {
    slides.forEach(({ slide_canvas: canvas }) => {
        if (canvas && Number(canvas.version) > CANVAS_VERSION) throw tooNewError(canvas.version);
    });
}

/** Lienzo listo para usar en esta instalación, o null si no es válido. */
function rewriteCanvas(rawCanvas, media, warnings) {
    const mapped = SlidePackage.mapCanvasMedia(rawCanvas, {
        image: url => imageUrlFor(url, media),
        video: videoUrlFor
    });
    if (mapped.dropped) warnings.push({ code: 'MEDIA_DROPPED', params: { n: mapped.dropped } });
    const before = mapped.canvas.elements.length;
    const canvas = normalizeCanvas(mapped.canvas);
    if (!canvas) return null;
    if (canvas.elements.length < before) {
        warnings.push({ code: 'ELEMENTS_DROPPED', params: { n: before - canvas.elements.length } });
    }
    const { error } = canvasSchema.validate(canvas);
    return error ? null : canvas;
}

/** Escribe las imágenes que usan las diapositivas importadas; si el fichero ya existe (mismo hash), se reutiliza. */
async function writeUsedAssets({ slides, files, uploadDir, writeFile }) {
    const used = new Set();
    slides.forEach(slide => collectMediaRefs(slide.slide_canvas).images.forEach(url => used.add(url)));
    const written = new Set();
    for (const { filename, buffer } of files) {
        if (written.has(filename) || !used.has(`/uploads/${filename}`)) continue;
        written.add(filename);
        try {
            await writeFile(path.join(uploadDir, filename), buffer, { flag: 'wx' });
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
        }
    }
}

/**
 * Importa un paquete .xiroslide.
 * @param {Buffer} buffer - Contenido del fichero
 * @param {Object} [options]
 * @param {string} [options.uploadDir] - Carpeta de destino (por defecto public/uploads)
 * @param {Function} [options.writeFile] - Igual que fs.promises.writeFile (inyectable en tests)
 * @param {Function} [options.fetchImage] - url → Promise<Buffer> para las imágenes de otra web (inyectable en tests)
 * @param {string[]} [options.trustedUploads] - URLs de /uploads/ que se conservan (imágenes adjuntas a la IA)
 * @returns {Promise<{slides: Array<{slide_type: string, slide_canvas: Object}>, warnings: Array<{code: string, params: Object}>}>}
 */
async function importSlidePackage(buffer, options = {}) {
    const uploadDir = options.uploadDir || DEFAULT_UPLOAD_DIR;
    const writeFile = options.writeFile || fs.promises.writeFile;
    const pkg = parsePackage(buffer);
    checkCanvasVersions(pkg.slides);
    const warnings = [];
    const media = {
        assets: decodeAssets(pkg.assets, warnings),
        inline: await resolveInlineImages(pkg.slides, { warnings, inspect: inspectAsset, fileFor: uploadName, fetchImage: options.fetchImage }),
        trusted: new Set(options.trustedUploads || [])
    };
    const slides = [];
    pkg.slides.forEach((slide, index) => {
        const canvas = rewriteCanvas(slide.slide_canvas, media, warnings);
        if (canvas) slides.push({ slide_type: 'canvas', slide_canvas: canvas });
        else warnings.push({ code: 'SLIDE_SKIPPED', params: { n: index + 1 } });
    });
    if (!slides.length) {
        throw packageError('SLIDE_PACKAGE_EMPTY', 400, 'El paquete no contiene ninguna diapositiva válida');
    }
    const files = [...media.assets.values(), ...media.inline.values()];
    await writeUsedAssets({ slides, files, uploadDir, writeFile });
    return { slides, warnings };
}

module.exports = { importSlidePackage };
