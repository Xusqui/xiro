/**
 * @fileoverview Guarda en /uploads una imagen recibida como bytes (imágenes de Wikimedia Commons del
 * generador de IA, imágenes incrustadas en el JSON de un banco). El tipo sale del contenido, nunca
 * del nombre ni del MIME que diga el origen; el nombre es el hash del contenido, así que la misma
 * imagen se reutiliza en vez de duplicarse. SVG no se admite: puede llevar scripts.
 * @module services/image-store
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { detectImageType } = require('./slide-package/image-type');
const { uploadDir: DEFAULT_UPLOAD_DIR } = require('../config/multer');

// Mismo límite que la subida de imágenes del editor (config/multer.js)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXTENSIONS = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' });
const PREFIX_RE = /^[a-z][a-z0-9-]{0,20}$/;

/**
 * Comprueba la imagen y la escribe en /uploads (si ya existe la misma, la reutiliza).
 * @param {Buffer} buffer - Contenido de la imagen
 * @param {Object} options
 * @param {string} options.prefix - Prefijo del nombre (palabra simple, p. ej. 'hotspot')
 * @param {string} [options.uploadDir] - Carpeta de destino (por defecto public/uploads)
 * @param {Function} [options.writeFile] - Como fs.promises.writeFile (inyectable en tests)
 * @returns {Promise<string|null>} URL relativa (/uploads/…) o null si no es una imagen admitida
 * @throws {Error} Si el prefijo no es válido o falla el disco (salvo «ya existe»)
 */
async function storeImageBuffer(buffer, { prefix, uploadDir = DEFAULT_UPLOAD_DIR, writeFile = fs.promises.writeFile }) {
    if (!PREFIX_RE.test(prefix)) throw new Error(`Prefijo de imagen no válido: ${prefix}`);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
    const extension = EXTENSIONS[detectImageType(buffer)];
    if (!extension) return null;
    return await storeHashedBuffer(buffer, { prefix, extension, uploadDir, writeFile });
}

/**
 * Escribe en /uploads unos bytes ya comprobados, con el hash del contenido como nombre (si ya
 * existe el mismo fichero, lo reutiliza). No mira el tipo ni el tamaño: eso lo decide quien llama.
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string} options.prefix - Prefijo del nombre (palabra simple)
 * @param {string} options.extension - Extensión sin punto (png, mp3…)
 * @param {string} [options.uploadDir]
 * @param {Function} [options.writeFile]
 * @returns {Promise<string>} URL relativa (/uploads/…)
 * @throws {Error} Si el prefijo no es válido o falla el disco (salvo «ya existe»)
 */
async function storeHashedBuffer(buffer, { prefix, extension, uploadDir = DEFAULT_UPLOAD_DIR, writeFile = fs.promises.writeFile }) {
    if (!PREFIX_RE.test(prefix)) throw new Error(`Prefijo de imagen no válido: ${prefix}`);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
    const filename = `${prefix}-${hash}.${extension}`;
    try {
        await writeFile(path.join(uploadDir, filename), buffer, { flag: 'wx' });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
    return `/uploads/${filename}`;
}

module.exports = { storeImageBuffer, storeHashedBuffer, MAX_IMAGE_BYTES, IMAGE_EXTENSIONS: EXTENSIONS };
