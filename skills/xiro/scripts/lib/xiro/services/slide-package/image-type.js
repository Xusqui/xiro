/**
 * @fileoverview Tipo real de una imagen según su contenido (firma de los primeros bytes), sin fiarse
 * del nombre ni del MIME que declara un paquete importado. Lo usa la importación de diapositivas libres.
 */
'use strict';

// Un SVG es texto: se busca la etiqueta raíz <svg en los primeros caracteres (tras BOM, <?xml ...?> y comentarios)
const SVG_SCAN_CHARS = 4096;
const SVG_ROOT_RE = /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>/]/i;

const SIGNATURES = [
    { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
    { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
    { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }
];

/** true si el buffer contiene esos bytes a partir de offset. */
function hasBytes(buffer, bytes, offset = 0) {
    if (buffer.length < offset + bytes.length) return false;
    return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/** Comprueba si el contenido empieza por una etiqueta <svg. */
function isSvg(buffer) {
    const head = buffer.subarray(0, SVG_SCAN_CHARS).toString('utf8').replace(/^\uFEFF/, '');
    return SVG_ROOT_RE.test(head);
}

/** WebP: contenedor RIFF con la marca WEBP en el byte 8. */
function isWebp(buffer) {
    return hasBytes(buffer, [0x52, 0x49, 0x46, 0x46]) && hasBytes(buffer, [0x57, 0x45, 0x42, 0x50], 8);
}

/**
 * Tipo MIME real de la imagen, o null si no es PNG, JPEG, GIF, WebP ni SVG.
 * @param {Buffer} buffer - Contenido del fichero
 * @returns {string|null}
 */
function detectImageType(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
    const match = SIGNATURES.find(sig => hasBytes(buffer, sig.bytes));
    if (match) return match.type;
    if (isWebp(buffer)) return 'image/webp';
    return isSvg(buffer) ? 'image/svg+xml' : null;
}

module.exports = { detectImageType };
