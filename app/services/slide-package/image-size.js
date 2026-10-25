'use strict';

/**
 * @fileoverview Tamaño en píxeles de una imagen PNG, JPEG, GIF, WebP o SVG leyendo solo su cabecera, para que
 * las diapositivas con IA respeten la proporción de cada foto. En los JPEG tiene en cuenta la orientación
 * EXIF: las fotos del móvil guardadas en horizontal y giradas 90° se ven con el ancho y el alto cambiados.
 */

// Marcadores SOF de JPEG (todos los C0-CF salvo DHT C4, JPG C8 y DAC CC)
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const EXIF_ORIENTATION_TAG = 0x0112;
const SVG_HEAD_CHARS = 4096;

function pngSize(b) {
    return b.toString('latin1', 12, 16) === 'IHDR' ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : null;
}

function gifSize(b) {
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

function webpSize(b) {
    const chunk = b.toString('latin1', 12, 16);
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
        const bits = b.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
    return null;
}

/** Orientación EXIF (1-8) de un segmento APP1 que empieza en start, o 1 si no la trae. */
function exifOrientation(b, start) {
    if (b.toString('latin1', start, start + 6) !== 'Exif\0\0') return 1;
    const tiff = start + 6;
    const little = b.toString('latin1', tiff, tiff + 2) === 'II';
    const u16 = at => (little ? b.readUInt16LE(at) : b.readUInt16BE(at));
    const ifd = tiff + (little ? b.readUInt32LE(tiff + 4) : b.readUInt32BE(tiff + 4));
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (u16(entry) === EXIF_ORIENTATION_TAG) return u16(entry + 8);
    }
    return 1;
}

function jpegSize(b) {
    let offset = 2;
    let orientation = 1;
    while (offset + 9 < b.length) {
        if (b[offset] !== 0xff) return null;
        const marker = b[offset + 1];
        if (marker === 0xff) {
            offset++;
            continue;
        }
        if (marker === 0xe1) orientation = exifOrientation(b, offset + 4);
        if (JPEG_SOF.has(marker)) {
            const height = b.readUInt16BE(offset + 5);
            const width = b.readUInt16BE(offset + 7);
            return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
        }
        offset += 2 + b.readUInt16BE(offset + 2);
    }
    return null;
}

/** Ancho y alto de un SVG: los de su viewBox o, si no tiene, sus atributos width y height en px. */
function svgSize(b) {
    const tag = /<svg\b[^>]*>/i.exec(b.subarray(0, SVG_HEAD_CHARS).toString('utf8'));
    if (!tag) return null;
    const box = /\sviewBox\s*=\s*["']\s*-?[\d.]+(?:\s+|\s*,\s*)-?[\d.]+(?:\s+|\s*,\s*)([\d.]+)(?:\s+|\s*,\s*)([\d.]+)\s*["']/i.exec(tag[0]);
    if (box) return { width: parseFloat(box[1]), height: parseFloat(box[2]) };
    const width = /\swidth\s*=\s*["']\s*([\d.]+)\s*(?:px)?\s*["']/i.exec(tag[0]);
    const height = /\sheight\s*=\s*["']\s*([\d.]+)\s*(?:px)?\s*["']/i.exec(tag[0]);
    return width && height ? { width: parseFloat(width[1]), height: parseFloat(height[1]) } : null;
}

const READERS = { 'image/png': pngSize, 'image/gif': gifSize, 'image/webp': webpSize, 'image/jpeg': jpegSize, 'image/svg+xml': svgSize };

/**
 * Tamaño de una imagen ya identificada por su contenido (image-type.js), o null si no se puede leer.
 * @param {Buffer} buffer
 * @param {string} type - MIME real
 * @returns {{width: number, height: number}|null}
 */
function imageSize(buffer, type) {
    const read = READERS[type];
    if (!read || !Buffer.isBuffer(buffer)) return null;
    try {
        const size = read(buffer);
        return size && size.width > 0 && size.height > 0 ? size : null;
    } catch (_err) {
        // Cabecera cortada o rara: sin tamaño
        return null;
    }
}

module.exports = { imageSize };
