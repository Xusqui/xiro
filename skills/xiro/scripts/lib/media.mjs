/**
 * Imágenes del paquete: tipo real por contenido y guardia de SVG (los de XiRo, services/slide-package/
 * image-type.js y svg-guard.js, copiados en lib/xiro/), medidas para la proporción, arreglos seguros de SVG
 * y, en macOS, conversión y reducción con sips (HEIC, TIFF, fotos enormes...).
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { MAX_ASSET_BYTES } from './rules.mjs';
import { detectImageType as vendoredDetect, isSafeSvg as vendoredIsSafeSvg } from './xiro.mjs';

/* ---------- Tipo real y guardia de SVG: los de XiRo (image-type.js y svg-guard.js) ---------- */

export const detectImageType = vendoredDetect;
const stripBom = text => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
export const isSafeSvg = vendoredIsSafeSvg;

// Solo para explicar por qué XiRo rechaza un SVG; quien decide es svg-guard.js
const EXPLAIN = [
    [/<!DOCTYPE/i, '<!DOCTYPE>'],
    [/<!ENTITY/i, '<!ENTITY>'],
    [/<\?xml-stylesheet/i, '<?xml-stylesheet?> (hoja de estilos externa)'],
    [/<\s*(?:[a-z0-9_-]+:)?(?:script|foreignObject|iframe|embed|object|handler|listener)\b/i, 'etiqueta activa (script, foreignObject, iframe, embed, object...)'],
    [/\son[a-z0-9_-]*\s*=/i, 'atributo on...= (manejador de eventos; ojo también con textos como " one =")'],
    [/@import/i, '@import'],
    [/url\(\s*['"]?\s*(?!#)/i, 'url(...) que no es exactamente url(#id), sin comillas ni espacios'],
    [/\b(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/(?:png|jpe?g|gif|webp);base64,)/i, 'href que no es #id ni data:image/png|jpeg|gif|webp;base64'],
    [/(?:javascript|vbscript|livescript):|data:text\/html/i, 'esquema peligroso (javascript:, data:text/html...)']
];

/** Motivo por el que XiRo rechazaría el SVG, o null si lo acepta. */
export function svgProblem(text) {
    if (typeof text !== 'string' || !text) return 'SVG vacío';
    if (vendoredIsSafeSvg(text)) return null;
    for (const [re, label] of EXPLAIN) {
        const m = re.exec(text);
        if (m) return `${label}: «${text.slice(Math.max(0, m.index - 20), m.index + 40).replace(/\s+/g, ' ')}»`;
    }
    return 'contenido que la guardia de SVG de XiRo no admite (entidades, esquemas o enlaces externos)';
}

/* ---------- Medidas ---------- */

function exifOrientation(buf, start, length) {
    const end = Math.min(buf.length, start + length);
    if (end - start < 8) return 1;
    const little = buf.toString('ascii', start, start + 2) === 'II';
    const u16 = o => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
    const u32 = o => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
    const ifd = start + u32(start + 4);
    if (ifd + 2 > end) return 1;
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > end) break;
        if (u16(entry) === 0x0112) return u16(entry + 8);
    }
    return 1;
}

function jpegSize(buf) {
    let i = 2;
    let orientation = 1;
    while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) {
            i++;
            continue;
        }
        const marker = buf[i + 1];
        if (marker === 0xff) {
            i++;
            continue;
        }
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            i += 2;
            continue;
        }
        const len = buf.readUInt16BE(i + 2);
        if (marker === 0xe1 && buf.toString('latin1', i + 4, i + 10) === 'Exif' + String.fromCharCode(0, 0)) {
            orientation = exifOrientation(buf, i + 10, len - 8);
        }
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            const h = buf.readUInt16BE(i + 5);
            const w = buf.readUInt16BE(i + 7);
            return orientation >= 5 && orientation <= 8 ? { w: h, h: w } : { w, h };
        }
        if (marker === 0xda) break;
        i += 2 + len;
    }
    return null;
}

function webpSize(buf) {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buf.length >= 30) return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ' && buf.length >= 30) return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L' && buf.length >= 25) {
        const b = buf.readUInt32LE(21);
        return { w: (b & 0x3fff) + 1, h: ((b >>> 14) & 0x3fff) + 1 };
    }
    return null;
}

const UNIT_PX = { '': 1, px: 1, pt: 4 / 3, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

function svgLength(value) {
    const m = /^\s*([0-9]*\.?[0-9]+(?:e[-+]?\d+)?)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(value || '');
    return m ? parseFloat(m[1]) * UNIT_PX[(m[2] || '').toLowerCase()] : null;
}

function rootTag(text) {
    const m = /<svg\b[^>]*>/i.exec(text);
    return m ? { tag: m[0], index: m.index } : null;
}

function attr(tag, name) {
    const m = new RegExp('\\s' + name + '\\s*=\\s*(["\'])([\\s\\S]*?)\\1', 'i').exec(tag);
    return m ? m[2] : null;
}

function svgSize(text) {
    const root = rootTag(text);
    if (!root) return null;
    const vb = (attr(root.tag, 'viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const viewBox = vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? { w: vb[2], h: vb[3] } : null;
    const w = svgLength(attr(root.tag, 'width'));
    const h = svgLength(attr(root.tag, 'height'));
    if (w && h) return { w, h };
    if (viewBox) return viewBox;
    return null;
}

/** { w, h } en píxeles (con la orientación EXIF aplicada en JPEG), o null. */
export function imageSize(buffer, type) {
    try {
        if (type === 'image/png') return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
        if (type === 'image/gif') return { w: buffer.readUInt16LE(6), h: buffer.readUInt16LE(8) };
        if (type === 'image/jpeg') return jpegSize(buffer);
        if (type === 'image/webp') return webpSize(buffer);
        if (type === 'image/svg+xml') return svgSize(stripBom(buffer.toString('utf8')));
    } catch {
        return null;
    }
    return null;
}

/* ---------- SVG: arreglos seguros antes de comprobarlo ---------- */

function fmt(n) {
    return String(Math.round(n * 1000) / 1000);
}

/**
 * Deja el SVG listo para XiRo: sin BOM ni DOCTYPE simple, con xmlns, viewBox y width/height
 * (para que se escale bien como <img>, también en navegadores antiguos). Lanza Error si XiRo lo rechazaría.
 */
export function prepareSvg(source) {
    let text = stripBom(String(source)).trim();
    const notes = [];
    if (/<!DOCTYPE[^>[]*>/i.test(text)) {
        text = text.replace(/<!DOCTYPE[^>[]*>\s*/i, '');
        notes.push('quitado <!DOCTYPE>');
    }
    const root = rootTag(text);
    if (!root) throw new Error('no es un SVG (no hay etiqueta <svg>)');
    let tag = root.tag;
    if (!/\sxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(tag)) {
        tag = tag.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (/\sxlink:/i.test(text) && !/\sxmlns:xlink\s*=/i.test(tag)) {
        tag = tag.replace(/^<svg\b/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    const vbRaw = attr(tag, 'viewBox');
    const w = svgLength(attr(tag, 'width'));
    const h = svgLength(attr(tag, 'height'));
    const vb = (vbRaw || '').trim().split(/[\s,]+/).map(Number);
    const hasViewBox = vb.length === 4 && vb[2] > 0 && vb[3] > 0;
    if (!hasViewBox && !(w && h)) throw new Error('el SVG necesita viewBox (o width y height en px)');
    if (!hasViewBox) tag = tag.replace(/^<svg\b/i, `<svg viewBox="0 0 ${fmt(w)} ${fmt(h)}"`);
    if (!(w && h)) {
        const size = hasViewBox ? { w: vb[2], h: vb[3] } : { w, h };
        tag = tag.replace(/\s(width|height)\s*=\s*(["'])[\s\S]*?\2/gi, '');
        tag = tag.replace(/^<svg\b/i, `<svg width="${fmt(size.w)}" height="${fmt(size.h)}"`);
    }
    text = text.slice(0, root.index) + tag + text.slice(root.index + root.tag.length);
    const buffer = Buffer.from(text, 'utf8');
    if (detectImageType(buffer) !== 'image/svg+xml') {
        throw new Error('XiRo no lo reconocería como SVG: debe empezar por <svg (como mucho tras <?xml ...?> y comentarios)');
    }
    const problem = svgProblem(text);
    if (problem) throw new Error(`XiRo rechazaría este SVG: ${problem}`);
    return { text, notes };
}

/* ---------- Ráster: conversión y reducción con sips (macOS) ---------- */

const MAX_SIDE = 3200;
const TARGET_SIDE = 2560;

function sipsPath() {
    return process.platform === 'darwin' && existsSync('/usr/bin/sips') ? '/usr/bin/sips' : null;
}

function runSips(buffer, inputExt, args, outExt) {
    const sips = sipsPath();
    const dir = mkdtempSync(path.join(os.tmpdir(), 'xiroslide-sips-'));
    try {
        const input = path.join(dir, 'in.' + inputExt);
        const output = path.join(dir, 'out.' + outExt);
        writeFileSync(input, buffer);
        const r = spawnSync(sips, [...args, input, '--out', output], { encoding: 'utf8' });
        if (r.status !== 0 || !existsSync(output)) throw new Error((r.stderr || r.stdout || 'sips falló').trim());
        return readFileSync(output);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const JPEG_ARGS = ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85'];
const PNG_ARGS = ['-s', 'format', 'png'];
const EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** Convierte a PNG/JPEG lo que XiRo no admite (HEIC, TIFF, BMP, AVIF...) y reduce fotos enormes. */
function fixRaster(buffer, name, notes) {
    let type = detectImageType(buffer);
    const ext = (path.extname(name || '').slice(1) || 'img').toLowerCase();
    if (!type) {
        if (!sipsPath()) throw new Error('formato no admitido: XiRo solo acepta PNG, JPEG, GIF, WebP o SVG');
        const toJpeg = /^(heic|heif|jpe?g|jfif)$/.test(ext);
        buffer = runSips(buffer, ext, toJpeg ? JPEG_ARGS : PNG_ARGS, toJpeg ? 'jpg' : 'png');
        type = detectImageType(buffer);
        if (!type) throw new Error('formato no admitido y sips no lo pudo convertir');
        notes.push(`convertida de ${ext.toUpperCase()} a ${toJpeg ? 'JPEG' : 'PNG'}`);
    }
    const size = imageSize(buffer, type);
    const tooBig = buffer.length > MAX_ASSET_BYTES || (size && Math.max(size.w, size.h) > MAX_SIDE);
    if (tooBig && type !== 'image/gif' && sipsPath()) {
        const before = size ? `${size.w}×${size.h}` : `${Math.round(buffer.length / 1024)} KB`;
        const outPng = type === 'image/png' || type === 'image/webp';
        buffer = runSips(buffer, EXT_BY_TYPE[type], ['-Z', String(TARGET_SIDE), ...(outPng ? PNG_ARGS : JPEG_ARGS)], outPng ? 'png' : 'jpg');
        if (buffer.length > MAX_ASSET_BYTES && outPng) {
            buffer = runSips(buffer, 'png', JPEG_ARGS, 'jpg');
            notes.push('pasada a JPEG para que quepa en 5 MB (pierde la transparencia)');
        }
        type = detectImageType(buffer);
        const after = imageSize(buffer, type);
        notes.push(`reducida de ${before} a ${after ? `${after.w}×${after.h}` : '?'} (${Math.round(buffer.length / 1024)} KB)`);
    }
    if (buffer.length > MAX_ASSET_BYTES) {
        throw new Error(`ocupa ${(buffer.length / 1048576).toFixed(1)} MB y XiRo admite como mucho 5 MB por imagen`);
    }
    return { buffer, type };
}

/**
 * Imagen lista para el paquete a partir de su contenido.
 * @returns {{buffer: Buffer, type: string, w: number, h: number, ratio: number, notes: string[]}}
 */
export function prepareImage(buffer, name) {
    const notes = [];
    let type = detectImageType(buffer);
    if (type === 'image/svg+xml' || (!type && /\.svg$/i.test(name || ''))) {
        const svg = prepareSvg(buffer.toString('utf8'));
        notes.push(...svg.notes);
        buffer = Buffer.from(svg.text, 'utf8');
        type = 'image/svg+xml';
        if (buffer.length > MAX_ASSET_BYTES) throw new Error('el SVG ocupa más de 5 MB');
    } else {
        ({ buffer, type } = fixRaster(buffer, name, notes));
    }
    const size = imageSize(buffer, type);
    if (!size || !(size.w > 0) || !(size.h > 0)) throw new Error('no se pudieron leer las medidas de la imagen');
    return { buffer, type, w: size.w, h: size.h, ratio: size.w / size.h, notes };
}

/** Contenido de una imagen: archivo local (relativo a baseDir, admite ~) o URL http(s). */
export async function readImageSource(src, baseDir) {
    if (/^https?:\/\//i.test(src)) {
        let res;
        try {
            res = await fetch(src, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
        } catch (err) {
            throw new Error(`no se pudo descargar (${err.message})`);
        }
        if (!res.ok) throw new Error(`no se pudo descargar (HTTP ${res.status})`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const name = decodeURIComponent(new URL(src).pathname.split('/').pop() || 'imagen');
        return { buffer, name };
    }
    const file = src.startsWith('~/') ? path.join(os.homedir(), src.slice(2)) : path.resolve(baseDir, src);
    if (!existsSync(file)) throw new Error(`no existe el archivo ${file}`);
    return { buffer: readFileSync(file), name: path.basename(file) };
}
