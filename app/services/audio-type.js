/**
 * @fileoverview Tipo real de un audio según sus primeros bytes, sin fiarse del nombre ni del
 * Content-Type que diga otra web. Los mismos formatos que admite la subida (config/multer.js).
 * @module services/audio-type
 */

'use strict';

const MIN_BYTES = 12;

function startsWith(buffer, bytes, offset = 0) {
    return bytes.every((byte, i) => buffer[offset + i] === byte);
}

const ascii = (text) => [...text].map((char) => char.charCodeAt(0));

// Sincronía de trama MPEG (11 bits a 1) con capa distinta de 00: la capa 00 es AAC, no MP3
function isMpegFrame(buffer) {
    return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0 && (buffer[1] & 0x06) !== 0;
}

/**
 * Tipo MIME del audio, o null si no es MP3, WAV, OGG ni WebM.
 * @param {Buffer} buffer - Contenido del fichero
 * @returns {'audio/mpeg'|'audio/wav'|'audio/ogg'|'audio/webm'|null}
 */
function detectAudioType(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < MIN_BYTES) return null;
    if (startsWith(buffer, ascii('ID3')) || isMpegFrame(buffer)) return 'audio/mpeg';
    if (startsWith(buffer, ascii('RIFF')) && startsWith(buffer, ascii('WAVE'), 8)) return 'audio/wav';
    if (startsWith(buffer, ascii('OggS'))) return 'audio/ogg';
    if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'audio/webm';
    return null;
}

module.exports = { detectAudioType };
