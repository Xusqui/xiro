/** @fileoverview Versiones de Xiro!: x.y.z con una letra opcional de revisión (3.7.8a en Docker Hub,
 *  3.7.8-a en package.json, porque npm añade el guion). La revisión va después de su versión base:
 *  3.7.8 < 3.7.8a < 3.7.8b < 3.7.9. Lo usan el backend y el actualizador (que solo copia esta carpeta). */
'use strict';

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-?([a-z]))?$/;

/**
 * Descompone una versión
 * @param {string} version - Versión (3.7.8, 3.7.8a o 3.7.8-a)
 * @returns {number[]|null} [mayor, menor, parche, revisión] (revisión 0 sin letra) o null si no es válida
 */
function parseVersion(version) {
    const m = VERSION_RE.exec(String(version));
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? m[4].charCodeAt(0) - 96 : 0];
}

/**
 * Indica si una cadena es una versión válida
 * @param {string} version - Cadena a comprobar
 * @returns {boolean}
 */
function isValidVersion(version) {
    return parseVersion(version) !== null;
}

/**
 * Compara dos versiones
 * @param {string} a - Primera versión
 * @param {string} b - Segunda versión
 * @returns {-1|0|1} -1 si a < b, 0 si son la misma, 1 si a > b
 */
function compareVersions(a, b) {
    const pa = parseVersion(a) || [0, 0, 0, 0];
    const pb = parseVersion(b) || [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
    }
    return 0;
}

/**
 * Indica si dos cadenas nombran la misma versión (3.7.8a y 3.7.8-a lo son)
 * @param {string} a - Primera versión
 * @param {string} b - Segunda versión
 * @returns {boolean}
 */
function sameVersion(a, b) {
    return isValidVersion(a) && isValidVersion(b) && compareVersions(a, b) === 0;
}

module.exports = { parseVersion, isValidVersion, compareVersions, sameVersion };
