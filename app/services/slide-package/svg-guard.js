/**
 * @fileoverview Comprueba que un SVG importado no tenga contenido activo ni externo (scripts,
 * manejadores de eventos, enlaces, hojas de estilo...). No lo limpia: si encuentra algo no
 * permitido, el SVG se rechaza entero. Es una defensa más junto a la cabecera sandbox con la que
 * se sirven los SVG de /uploads/ (middlewares/uploadsSvgPolicy.js).
 */
'use strict';

const FORBIDDEN_PATTERNS = [
    /<!DOCTYPE/i,
    /<!ENTITY/i,
    /<\?xml-stylesheet/i,
    /<\s*(?:[a-z0-9_-]+:)?(?:script|foreignObject|iframe|embed|object|handler|listener)\b/i,
    /\son[a-z0-9_-]*\s*=/i,
    /@import/i,
    /url\(\s*['"]?\s*(?!#)/i
];
// href permitidos: fragmentos del propio SVG (#id) o imágenes rasterizadas incrustadas
const SAFE_HREF_RE = /^\s*(?:#|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;
const HREF_RE = /\b(?:xlink:)?href\s*=\s*(["'])([\s\S]*?)\1/gi;
const ENTITY_RE = /&#(x[0-9a-f]+|\d+);?/gi;
const SCHEME_RE = /(?:javascript|vbscript|livescript):|data:text\/html/;
const MAX_CODE_POINT = 0x10ffff;

/** Sustituye las referencias numéricas (&#106; &#x6a;) por su carácter para que no oculten nada. */
function decodeEntities(text) {
    return text.replace(ENTITY_RE, (_match, code) => {
        const value = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10);
        return Number.isFinite(value) && value <= MAX_CODE_POINT ? String.fromCodePoint(value) : '';
    });
}

/**
 * true si el SVG no tiene nada activo ni externo; false en cualquier otro caso.
 * @param {string} text - Contenido del SVG
 * @returns {boolean}
 */
function isSafeSvg(text) {
    if (typeof text !== 'string' || !text) return false;
    const decoded = decodeEntities(text);
    if (FORBIDDEN_PATTERNS.some(re => re.test(decoded))) return false;
    // Esquemas peligrosos aunque vengan partidos con espacios o caracteres de control
    // eslint-disable-next-line no-control-regex -- quitar los caracteres de control es justo lo que se busca
    const compact = decoded.replace(/[\s\u0000-\u001f]+/g, '').toLowerCase();
    if (SCHEME_RE.test(compact)) return false;
    for (const match of decoded.matchAll(HREF_RE)) {
        if (!SAFE_HREF_RE.test(match[2])) return false;
    }
    return true;
}

module.exports = { isSafeSvg };
