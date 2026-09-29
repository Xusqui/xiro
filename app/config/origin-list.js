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
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function uniqueOrigins(origins) {
    return Array.from(new Set(origins));
}

function parseOriginList(rawValue, fallback = DEFAULT_ORIGINS) {
    const parsed = uniqueOrigins(normalizeRawOrigins(rawValue));
    return parsed.length > 0 ? parsed : [...fallback];
}

function isValidOriginFormat(origin) {
    // Origin RFC-like format: scheme + host[:port], without path.
    return /^https?:\/\/[^/\s,]+$/i.test(origin);
}

function validateOriginList(rawValue, keyName = 'origenes permitidos') {
    const parsed = parseOriginList(rawValue, []);

    if (parsed.length === 0) {
        return `${keyName} debe contener al menos un origen`;
    }

    const invalid = parsed.find((origin) => !isValidOriginFormat(origin));
    if (invalid) {
        return `${keyName} contiene un origen invalido: ${invalid}`;
    }

    return null;
}

function formatOriginList(rawValue, fallback = DEFAULT_ORIGINS) {
    return parseOriginList(rawValue, fallback).join(',');
}

module.exports = {
    DEFAULT_ORIGINS,
    DEFAULT_ORIGINS_CSV,
    parseOriginList,
    validateOriginList,
    formatOriginList,
};
