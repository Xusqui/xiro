/**
 * @fileoverview Imagen o audio de una pregunta a partir de una ruta o una URL, sin subir el fichero
 * (POST /api/upload/from-ref). Así la misma imagen sirve para muchas preguntas (p. ej. el mapa de
 * provincias en 52 preguntas de «Toca la imagen»).
 * - Ruta de /uploads (o URL completa de este servidor): se usa tal cual si el fichero existe y es
 *   del tipo y tamaño que admite el sitio. No se copia.
 * - URL de otra web: se descarga una vez con remote-image (solo IP públicas, plazo y tamaño máximo)
 *   y se guarda con el hash del contenido como nombre, porque la CSP solo enseña imágenes del
 *   propio servidor. Pegar la misma URL otra vez reutiliza el fichero.
 * El tipo sale siempre de los bytes. SVG no se admite: puede llevar scripts.
 * Los errores llevan `code` REF_* (y `params` en REF_TOO_LARGE) para que el editor los traduzca.
 * @module services/media-ref
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { fetchRemote: defaultFetchRemote } = require('./slide-package/remote-image');
const { detectImageType } = require('./slide-package/image-type');
const { detectAudioType } = require('./audio-type');
const { storeHashedBuffer, IMAGE_EXTENSIONS } = require('./image-store');
const {
    uploadDir: DEFAULT_UPLOAD_DIR,
    isSafeUploadFilename,
    MAX_QUESTION_IMAGE_BYTES,
    MAX_GAME_COVER_IMAGE_BYTES
} = require('../config/multer');

const MB = 1024 * 1024;
// Los mismos límites que la subida de cada sitio (config/multer.js)
const KIND_LIMITS = Object.freeze({
    media: { image: 5 * MB, audio: 10 * MB },
    image: { image: 5 * MB },
    small: { image: MAX_QUESTION_IMAGE_BYTES },
    cover: { image: MAX_GAME_COVER_IMAGE_BYTES }
});
const MEDIA_REF_KINDS = Object.keys(KIND_LIMITS);

const AUDIO_EXTENSIONS = Object.freeze({ 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' });
const LOCAL_PATH_RE = /^\/uploads\/([^/?#\\]+)$/;
const REMOTE_PREFIX = 'url';
const REMOTE_CODES = Object.freeze({
    IMAGE_URL_INVALID: 'REF_INVALID',
    IMAGE_HOST_BLOCKED: 'REF_BLOCKED',
    IMAGE_HTTP_ERROR: 'REF_HTTP',
    IMAGE_TIMEOUT: 'REF_TIMEOUT',
    ASSET_TOO_LARGE: 'REF_TOO_LARGE'
});
const MESSAGES = Object.freeze({
    REF_INVALID: 'Escribe una ruta de /uploads/ o una dirección http(s)',
    REF_NOT_FOUND: 'No hay ningún fichero con ese nombre en /uploads/',
    REF_TYPE: 'El fichero no es una imagen o un audio admitido aquí',
    REF_TOO_LARGE: 'El fichero pesa demasiado para este sitio',
    REF_BLOCKED: 'Esa dirección no es pública',
    REF_HTTP: 'La web no ha devuelto el fichero',
    REF_TIMEOUT: 'La web tarda demasiado en responder',
    REF_UNREACHABLE: 'No se ha podido conectar con esa web'
});

function refError(code, params) {
    return Object.assign(new Error(MESSAGES[code]), { code, ...(params ? { params } : {}) });
}

const maxBytesOf = (limits) => Math.max(...Object.values(limits));

/**
 * Nombre del fichero de /uploads al que apunta la referencia, o null si es de otra web.
 * @throws {Error} REF_INVALID si no es una ruta de /uploads ni una URL http(s)
 */
function localFilename(ref, ownHost) {
    const text = ref.startsWith('uploads/') ? `/${ref}` : ref;
    let pathname = text;
    if (!text.startsWith('/')) {
        let url;
        try {
            url = new URL(text);
        } catch (_err) {
            throw refError('REF_INVALID');
        }
        if (!ownHost || url.host !== ownHost) return null;
        pathname = url.pathname;
    }
    const match = LOCAL_PATH_RE.exec(pathname);
    if (!match || !isSafeUploadFilename(match[1])) throw refError('REF_INVALID');
    return match[1];
}

/** Tipo de contenido y extensión de los bytes, si este sitio los admite y caben. */
function classify(buffer, limits) {
    const imageExtension = IMAGE_EXTENSIONS[detectImageType(buffer)];
    const audioExtension = AUDIO_EXTENSIONS[detectAudioType(buffer)];
    let found = null;
    if (imageExtension && limits.image) found = { tipo_contenido: 'imagen', extension: imageExtension, max: limits.image };
    else if (audioExtension && limits.audio) found = { tipo_contenido: 'audio', extension: audioExtension, max: limits.audio };
    if (!found) throw refError('REF_TYPE');
    if (buffer.length > found.max) throw refError('REF_TOO_LARGE', { kb: Math.round(found.max / 1024) });
    return found;
}

async function readLocal(filename, limits, uploadDir) {
    const file = path.join(uploadDir, filename);
    let stats;
    try {
        stats = await fs.promises.stat(file);
    } catch (err) {
        if (err.code === 'ENOENT') throw refError('REF_NOT_FOUND');
        throw err;
    }
    if (!stats.isFile()) throw refError('REF_NOT_FOUND');
    const max = maxBytesOf(limits);
    if (stats.size > max) throw refError('REF_TOO_LARGE', { kb: Math.round(max / 1024) });
    const { tipo_contenido } = classify(await fs.promises.readFile(file), limits);
    return { url: `/uploads/${filename}`, tipo_contenido };
}

async function download(ref, limits, { uploadDir, fetchRemote }) {
    const accept = limits.audio ? 'image/*,audio/*' : 'image/*';
    const max = maxBytesOf(limits);
    let body;
    try {
        ({ body } = await fetchRemote(ref, { maxBytes: max, accept }));
    } catch (err) {
        const code = REMOTE_CODES[err.code] || 'REF_UNREACHABLE';
        throw refError(code, code === 'REF_TOO_LARGE' ? { kb: Math.round(max / 1024) } : null);
    }
    const { tipo_contenido, extension } = classify(body, limits);
    const url = await storeHashedBuffer(body, { prefix: REMOTE_PREFIX, extension, uploadDir });
    return { url, tipo_contenido };
}

/**
 * Comprueba la referencia y devuelve la ruta que se guarda en la pregunta.
 * @param {string} ref - Ruta (/uploads/mapa.jpg, uploads/mapa.jpg) o URL http(s)
 * @param {'media'|'image'|'small'|'cover'} kind - Sitio del editor: multimedia (imagen o audio),
 *   imagen principal sola (Toca la imagen), imagen pequeña (enunciado, opción) o portada
 * @param {Object} [options]
 * @param {string} [options.ownHost] - Host de la petición: sus URL completas cuentan como locales
 * @param {string} [options.uploadDir] - Carpeta de /uploads (inyectable en tests)
 * @param {Function} [options.fetchRemote] - Descarga (remote-image.fetchRemote, inyectable en tests)
 * @returns {Promise<{url: string, tipo_contenido: 'imagen'|'audio'}>}
 * @throws {Error} Con code REF_* si la referencia no vale; Error sin código si `kind` no existe o falla el disco
 */
async function resolveMediaRef(ref, kind, options = {}) {
    const limits = KIND_LIMITS[kind];
    if (!limits) throw new Error(`Sitio de imagen desconocido: ${kind}`);
    const { ownHost, uploadDir = DEFAULT_UPLOAD_DIR, fetchRemote = defaultFetchRemote } = options;
    const text = String(ref).trim();
    const filename = localFilename(text, ownHost);
    if (filename) return await readLocal(filename, limits, uploadDir);
    return await download(text, limits, { uploadDir, fetchRemote });
}

module.exports = { resolveMediaRef, MEDIA_REF_KINDS };
