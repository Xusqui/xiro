/**
 * Lectura de valores del spec con mensajes claros (los usan build.mjs y build-extras.mjs).
 * Cada función lanza SpecError explicando qué esperaba y qué recibió.
 */

import * as R from './rules.mjs';

export class SpecError extends Error {}

export const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** Copia sin las claves de comentario (empiezan por "_"). */
export function clean(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (!k.startsWith('_')) out[k] = v;
    return out;
}

export function unknownKeys(obj, allowed, where) {
    const bad = Object.keys(obj).filter(k => allowed.indexOf(k) < 0);
    if (bad.length) throw new SpecError(`${where}: clave desconocida ${bad.map(k => `"${k}"`).join(', ')} (válidas: ${allowed.join(', ')})`);
}

/** #rgb/#rgba se amplían; null, "none" y "transparent" son «sin color» si el campo lo admite. */
export function colorValue(v, where, name, allowNull) {
    if (v === null || v === 'none' || v === 'transparent') {
        if (allowNull) return null;
        throw new SpecError(`${where}: "${name}" no admite «sin color»`);
    }
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (/^#[0-9a-f]{3,4}$/.test(s)) return '#' + [...s.slice(1)].map(c => c + c).join('');
        if (R.COLOR_RE.test(s)) return s;
    }
    throw new SpecError(`${where}: "${name}" debe ser un color #rrggbb o #rrggbbaa${allowNull ? ' (o null)' : ''}; recibido ${JSON.stringify(v)}`);
}

export function intValue(v, min, max, where, name) {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new SpecError(`${where}: "${name}" debe ser un número; recibido ${JSON.stringify(v)}`);
    const n = Math.round(v);
    if (n < min || n > max) throw new SpecError(`${where}: "${name}" debe estar entre ${min} y ${max}; recibido ${v}`);
    return n;
}

export function boolValue(v, where, name) {
    if (typeof v !== 'boolean') throw new SpecError(`${where}: "${name}" debe ser true o false`);
    return v;
}

export function enumValue(v, list, where, name) {
    if (list.indexOf(v) < 0) throw new SpecError(`${where}: "${name}" debe ser ${list.map(x => `"${x}"`).join(' | ')}; recibido ${JSON.stringify(v)}`);
    return v;
}
