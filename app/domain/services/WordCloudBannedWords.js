/**
 * @fileoverview Filtro de palabras prohibidas de «Nube de palabras». Compara la clave de
 * agrupado (ya sin mayúsculas, tildes ni signos) con la lista de los 10 idiomas de la app, que
 * se junta en un solo conjunto porque no se sabe en qué idioma escribe cada jugador. Coincide la
 * clave entera o cualquiera de sus palabras, nunca una subcadena: «análisis» no se bloquea por
 * llevar «anal». Sin I/O.
 */

'use strict';

const { BANNED_BY_LANGUAGE } = require('./wordCloudBannedList');

const BANNED_KEYS = new Set(Object.values(BANNED_BY_LANGUAGE).flat());

/**
 * Indica si una clave de agrupado es, o contiene como palabra, algo prohibido.
 * @param {*} key - Clave devuelta por `wordKey`
 * @returns {boolean} `false` para cualquier valor que no sea una cadena con texto
 */
function isBannedWord(key) {
    if (typeof key !== 'string' || key === '') return false;
    return BANNED_KEYS.has(key) || key.split(' ').some(part => BANNED_KEYS.has(part));
}

module.exports = { isBannedWord, BANNED_BY_LANGUAGE };
