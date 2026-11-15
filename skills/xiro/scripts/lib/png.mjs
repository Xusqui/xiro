/**
 * Lector mínimo de PNG (8 bits, RGB/RGBA, sin entrelazar: lo que guarda Chrome al hacer captura)
 * para medir el contraste real del texto sobre lo que tiene debajo.
 */

import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

/** { width, height, channels, data } con los píxeles sin filtros, o null si el PNG no es de ese tipo. */
export function readPng(file) {
    const buf = readFileSync(file);
    let pos = 8;
    let width = 0;
    let height = 0;
    let channels = 0;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const body = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            const depth = body[8];
            const colorType = body[9];
            if (depth !== 8 || body[12] !== 0 || (colorType !== 2 && colorType !== 6)) return null;
            channels = colorType === 6 ? 4 : 3;
        } else if (type === 'IDAT') idat.push(body);
        else if (type === 'IEND') break;
        pos += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const data = Buffer.alloc(height * stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const out = y * stride;
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? data[out + x - channels] : 0;
            const b = y > 0 ? data[out - stride + x] : 0;
            const c = x >= channels && y > 0 ? data[out - stride + x - channels] : 0;
            let v = line[x];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a);
                const pb = Math.abs(p - b);
                const pc = Math.abs(p - c);
                v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            data[out + x] = v & 0xff;
        }
    }
    return { width, height, channels, data };
}

/** Color { r, g, b } del píxel (x, y). */
export function pixel(png, x, y) {
    const i = (y * png.width + x) * png.channels;
    return { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2] };
}
