/**
 * @fileoverview Lector ZIP propio (docx, odt, odp, pptx, epub) sobre zlib nativo.
 * Solo lee el directorio central y descomprime bajo demanda (métodos 0 y 8).
 *
 * Protección contra zip bombs: límite de entradas, de tamaño descomprimido por
 * entrada y en total, y de ratio de compresión. zlib corta la salida aunque el
 * tamaño declarado en la cabecera mienta.
 */

'use strict';

const zlib = require('zlib');

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const LIMITS = {
    maxEntries: 5000,
    maxEntryBytes: 50 * 1024 * 1024,
    maxTotalBytes: 120 * 1024 * 1024,
    maxRatio: 200
};

function isZip(buffer) {
    return buffer.length >= 4 && buffer.readUInt32LE(0) === SIG_LOCAL;
}

function findEndOfCentralDir(buf) {
    const min = Math.max(0, buf.length - 22 - 0xffff);
    for (let i = buf.length - 22; i >= min; i--) {
        if (buf.readUInt32LE(i) === SIG_EOCD) return i;
    }
    return -1;
}

function readCentralDirectory(buf) {
    const eocd = findEndOfCentralDir(buf);
    if (eocd < 0) throw new Error('El archivo está dañado (ZIP no válido)');
    const count = buf.readUInt16LE(eocd + 10);
    if (count > LIMITS.maxEntries) throw new Error('El archivo contiene demasiadas entradas');

    const entries = new Map();
    let p = buf.readUInt32LE(eocd + 16);
    for (let i = 0; i < count; i++) {
        if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CENTRAL) {
            throw new Error('El archivo está dañado (directorio ZIP incoherente)');
        }
        const nameLen = buf.readUInt16LE(p + 28);
        const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
        entries.set(name, {
            encrypted: (buf.readUInt16LE(p + 8) & 1) === 1,
            method: buf.readUInt16LE(p + 10),
            compSize: buf.readUInt32LE(p + 20),
            size: buf.readUInt32LE(p + 24),
            localOffset: buf.readUInt32LE(p + 42)
        });
        p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    }
    return entries;
}

function checkEntry(entry, name) {
    if (entry.encrypted) throw new Error('El documento está protegido con contraseña');
    if (entry.size > LIMITS.maxEntryBytes) throw new Error(`Parte del documento demasiado grande: ${name}`);
    if (entry.compSize > 0 && entry.size / entry.compSize > LIMITS.maxRatio) {
        throw new Error('El archivo tiene una compresión sospechosa y se ha rechazado');
    }
}

function inflateEntry(buf, entry, name) {
    const p = entry.localOffset;
    if (p + 30 > buf.length || buf.readUInt32LE(p) !== SIG_LOCAL) {
        throw new Error('El archivo está dañado (cabecera ZIP local no válida)');
    }
    const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
    const data = buf.subarray(start, start + entry.compSize);
    if (entry.method === 0) return data;
    if (entry.method === 8) {
        return zlib.inflateRawSync(data, { maxOutputLength: LIMITS.maxEntryBytes });
    }
    throw new Error(`Compresión ZIP no soportada (método ${entry.method}) en ${name}`);
}

/**
 * Abre un ZIP en memoria.
 * @param {Buffer} buffer
 * @returns {{ names: string[], has: (name: string) => boolean,
 *             read: (name: string) => Buffer|null, readText: (name: string) => string|null,
 *             stats: () => { entries: number, partsRead: number, inflatedBytes: number } }}
 */
function openZip(buffer) {
    const entries = readCentralDirectory(buffer);
    let totalBytes = 0;
    let partsRead = 0;

    function read(name) {
        const entry = entries.get(name);
        if (!entry) return null;
        checkEntry(entry, name);
        const out = inflateEntry(buffer, entry, name);
        totalBytes += out.length;
        partsRead++;
        if (totalBytes > LIMITS.maxTotalBytes) throw new Error('El documento descomprimido es demasiado grande');
        return out;
    }

    return {
        names: [...entries.keys()],
        has: name => entries.has(name),
        read,
        readText: name => {
            const data = read(name);
            return data ? data.toString('utf8').replace(/^\ufeff/, '') : null;
        },
        stats: () => ({ entries: entries.size, partsRead, inflatedBytes: totalBytes })
    };
}

module.exports = { openZip, isZip };
