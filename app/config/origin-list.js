'use strict';

const DEFAULT_ORIGINS = [
    'https://xiro.pro',
    'https://www.xiro.pro',
    'https://test.xiro.pro',
    'http://localhost:3000',
    'http://localhost'
];

const DEFAULT_ORIGINS_CSV = DEFAULT_ORIGINS.join(',');

function normalizeRawOrigins(rawValue) {
    if (Array.isArray(rawValue)) {
        return rawValue;
    }

    return String(rawValue || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}

function uniqueOrigins(origins) {
    return Array.from(new Set(origins));
}

/**
 * Convierte la lista de orígenes en un array sin duplicados; si queda vacía devuelve una copia del valor por defecto.
 * @param {string} rawValue - Lista separada por comas
 * @param {string[]} [fallback=DEFAULT_ORIGINS] - Orígenes por defecto
 * @returns {string[]}
 */
function parseOriginList(rawValue, fallback = DEFAULT_ORIGINS) {
    const parsed = uniqueOrigins(normalizeRawOrigins(rawValue));
    return parsed.length > 0 ? parsed : [...fallback];
}

function isValidOriginFormat(origin) {
    // Origin RFC-like format: scheme + host[:port], without path.
    return /^https?:\/\/[^/\s,]+$/i.test(origin);
}

/**
 * Comprueba que la lista tenga al menos un origen y que todos tengan formato esquema + host[:puerto], sin ruta.
 * @param {string} rawValue - Lista separada por comas
 * @param {string} [keyName='origenes permitidos'] - Nombre del ajuste para el mensaje
 * @returns {string|null} Mensaje de error, o null si es válida
 */
function validateOriginList(rawValue, keyName = 'origenes permitidos') {
    const parsed = parseOriginList(rawValue, []);

    if (parsed.length === 0) {
        return `${keyName} debe contener al menos un origen`;
    }

    const invalid = parsed.find(origin => !isValidOriginFormat(origin));
    if (invalid) {
        return `${keyName} contiene un origen invalido: ${invalid}`;
    }

    return null;
}

/**
 * Normaliza la lista de orígenes y la devuelve separada por comas.
 * @param {string} rawValue - Lista separada por comas
 * @param {string[]} [fallback=DEFAULT_ORIGINS] - Orígenes por defecto
 * @returns {string}
 */
function formatOriginList(rawValue, fallback = DEFAULT_ORIGINS) {
    return parseOriginList(rawValue, fallback).join(',');
}

module.exports = {
    DEFAULT_ORIGINS,
    DEFAULT_ORIGINS_CSV,
    parseOriginList,
    validateOriginList,
    formatOriginList
};
