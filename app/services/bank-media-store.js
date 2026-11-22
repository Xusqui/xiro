/**
 * @fileoverview Guarda en /uploads una imagen o un audio que viaja dentro del JSON de un banco.
 * El tipo y el tamaño salen de los bytes, nunca del nombre ni del MIME que declare el origen; el
 * nombre es el hash del contenido, así que el mismo recurso no se duplica. SVG no se admite:
 * puede llevar scripts.
 * @module services/bank-media-store
 */

'use strict';

const { detectImageType } = require('./slide-package/image-type');
const { detectAudioType } = require('./audio-type');
const { storeHashedBuffer, IMAGE_EXTENSIONS, MAX_IMAGE_BYTES } = require('./image-store');

// Mismo límite que la subida de audio del editor (config/multer.js)
const MAX_BANK_AUDIO_BYTES = 10 * 1024 * 1024;
const AUDIO_EXTENSIONS = Object.freeze({ 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' });
const STORE_PREFIX = 'import';

/** Error con `code` BANK_MEDIA_* para que la ruta elija el estado HTTP. */
class BankMediaError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'BankMediaError';
        this.code = code;
    }
}

/** Tipo de contenido, extensión y tamaño máximo de los bytes, o null si no se admiten. */
function classify(buffer) {
    const imageExtension = IMAGE_EXTENSIONS[detectImageType(buffer)];
    if (imageExtension) return { tipo_contenido: 'imagen', extension: imageExtension, max: MAX_IMAGE_BYTES };
    const audioExtension = AUDIO_EXTENSIONS[detectAudioType(buffer)];
    if (audioExtension) return { tipo_contenido: 'audio', extension: audioExtension, max: MAX_BANK_AUDIO_BYTES };
    return null;
}

/**
 * Comprueba los bytes y los guarda en /uploads (si ya existe el mismo contenido, lo reutiliza).
 * @param {Buffer} buffer - Contenido del fichero
 * @param {Object} [options]
 * @param {Function} [options.store] - Como storeHashedBuffer (inyectable en tests)
 * @returns {Promise<{url: string, tipo_contenido: 'imagen'|'audio'}>}
 * @throws {BankMediaError} BANK_MEDIA_INVALID si no es imagen ni audio admitidos; BANK_MEDIA_TOO_LARGE si pesa demasiado
 */
async function storeBankMedia(buffer, { store = storeHashedBuffer } = {}) {
    const kind = Buffer.isBuffer(buffer) ? classify(buffer) : null;
    if (!kind) throw new BankMediaError('BANK_MEDIA_INVALID', 'El fichero no es una imagen ni un audio admitidos');
    if (buffer.length > kind.max) throw new BankMediaError('BANK_MEDIA_TOO_LARGE', 'El fichero pesa demasiado');
    const url = await store(buffer, { prefix: STORE_PREFIX, extension: kind.extension });
    return { url, tipo_contenido: kind.tipo_contenido };
}

module.exports = { storeBankMedia, BankMediaError, MAX_BANK_AUDIO_BYTES };
