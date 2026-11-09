'use strict';

/**
 * @fileoverview Fuentes de las diapositivas libres en el PDF. El PDF se genera con
 * setContent (sin origen desde el que resolver /fonts/), así que cada página lleva
 * incrustadas, en base64, solo las familias que usa.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const FONTS_CSS = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'fonts.css'), 'utf8');
// Solo el subconjunto latino: cada variante incrustada pesa unos 25 KB por página
const LATIN_FACE = /^@font-face\{font-family:'([^']+)';.*url\(\/fonts\/([a-z-]+-latin-\d+-[a-z]+\.woff2)\).*$/gm;
const dataUriCache = new Map();

/**
 * @param {string} fileName - Fichero de public/fonts
 * @returns {string|null} Data URI de la fuente, o null si no se puede leer
 */
function readFontDataUri(fileName) {
    if (dataUriCache.has(fileName)) return dataUriCache.get(fileName);
    try {
        const bytes = fs.readFileSync(path.join(PUBLIC_DIR, 'fonts', fileName));
        const dataUri = `data:font/woff2;base64,${bytes.toString('base64')}`;
        dataUriCache.set(fileName, dataUri);
        return dataUri;
    } catch (error) {
        logger.warn('PDF font could not be read', { fileName, error: error.message });
        return null;
    }
}

/**
 * Reglas @font-face de las familias que aparecen en el HTML, con la fuente incrustada.
 * @param {string} html - HTML del escenario
 * @param {string} css - Hoja con una regla @font-face por línea
 * @param {function(string): (string|null)} readFont - Devuelve el data URI de un fichero
 * @returns {string} CSS listo para un bloque style
 */
function selectFontFaces(html, css, readFont) {
    const faces = [];
    for (const [rule, family, fileName] of css.matchAll(LATIN_FACE)) {
        if (!html.includes(family)) continue;
        const dataUri = readFont(fileName);
        if (dataUri) faces.push(rule.replace(`/fonts/${fileName}`, dataUri));
    }
    return faces.join('');
}

/**
 * @param {string} html - HTML del escenario de una diapositiva libre
 * @returns {string} CSS con las fuentes que usa
 */
function canvasFontFaces(html) {
    return selectFontFaces(html, FONTS_CSS, readFontDataUri);
}

module.exports = { canvasFontFaces, selectFontFaces };
