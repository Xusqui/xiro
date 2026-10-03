/**
 * @fileoverview Configuración dinámica en tiempo de ejecución
 * Singleton que gestiona los parámetros configurables sin reiniciar el servidor.
 * Cargado una vez al inicio, modificable mediante setParam().
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
    DEFAULT_ORIGINS_CSV,
    validateOriginList,
    formatOriginList,
} = require('./origin-list');

// Archivo de overrides persistente dentro del directorio app (montado en el contenedor).
// RUNTIME_OVERRIDES_FILE permite aislarlo (jest.setup.js lo apunta a una ruta inexistente
// para que los tests no lean ni escriban la configuración real de la instalación).
const OVERRIDES_FILE = process.env.RUNTIME_OVERRIDES_FILE || path.join(__dirname, 'runtime-overrides.json');

// Definición de parámetros gestionables con sus tipos y rangos
const PARAM_SCHEMA = {
    MAX_PLAYERS_PER_GAME: { type: 'int', min: 1, max: 5000, envKey: 'MAX_PLAYERS_PER_GAME' },
    MAX_LOBBIES: { type: 'int', min: 1, max: 50, envKey: 'MAX_LOBBIES' },
    QUESTION_TIME_LIMIT: { type: 'int', min: 5, max: 120, envKey: 'QUESTION_TIME_LIMIT' },
    GAME_CLEANUP_INTERVAL: { type: 'int', min: 60000, max: 86400000, envKey: 'GAME_CLEANUP_INTERVAL' },
    BASE_POINTS: { type: 'int', min: 1, max: 500, envKey: 'BASE_POINTS' },
    MAX_TIME_BONUS: { type: 'int', min: 0, max: 500, envKey: 'MAX_TIME_BONUS' },
    RANDOM_POINTS_REVEAL_MS: { type: 'int', min: 0, max: 15000, envKey: 'RANDOM_POINTS_REVEAL_MS' },
    STREAK_THRESHOLD: { type: 'int', min: 1, max: 20, envKey: 'STREAK_THRESHOLD' },
    STREAK_BONUS_PERCENTAGE: { type: 'float', min: 0, max: 5, envKey: 'STREAK_BONUS_PERCENTAGE' },
    TEAM_SCORE_LAMBDA: { type: 'float', min: 0, max: 10, envKey: 'TEAM_SCORE_LAMBDA' },
    RECONNECTION_TIMEOUT: { type: 'int', min: 10000, max: 600000, envKey: 'RECONNECTION_TIMEOUT' },
    PRESENTER_RECONNECTION_TIMEOUT: { type: 'int', min: 60000, max: 3600000, envKey: 'PRESENTER_RECONNECTION_TIMEOUT' },
    INACTIVE_GAME_THRESHOLD: { type: 'int', min: 900000, max: 86400000, envKey: 'INACTIVE_GAME_THRESHOLD' },
    EMPTY_LOBBY_TIMEOUT: { type: 'int', min: 30000, max: 1800000, envKey: 'EMPTY_LOBBY_TIMEOUT' },
    TOP_PLAYERS_DURING_GAME: { type: 'int', min: 1, max: 20, envKey: 'TOP_PLAYERS_DURING_GAME' },
    LOG_LEVEL: { type: 'enum', values: ['debug', 'info', 'warn', 'error'], envKey: 'LOG_LEVEL' },
    LOG_MAX_SIZE: { type: 'string', envKey: 'LOG_MAX_SIZE' },
    LOG_MAX_FILES: { type: 'string', envKey: 'LOG_MAX_FILES' },
    BACKUP_SCHEDULE: { type: 'enum', values: ['disabled', '0 2 * * *', '0 2 * * 0', '0 2 1 * *'], envKey: 'BACKUP_SCHEDULE' },
    BACKUP_RETENTION_DAYS: { type: 'int', min: 1, max: 365, envKey: 'BACKUP_RETENTION_DAYS' },
    CORS_ORIGIN: { type: 'origin_list', envKey: 'CORS_ORIGIN' },
    ALLOWED_ORIGINS: { type: 'origin_list', envKey: 'ALLOWED_ORIGINS' },
    // URL pública del servidor (emails, retorno de PayPal). Vacío = automático.
    PUBLIC_BASE_URL: { type: 'url', envKey: 'PUBLIC_BASE_URL' },
    UMAMI_SERVER_URL: { type: 'string', envKey: 'UMAMI_SERVER_URL' },
    UMAMI_WEBSITE_ID: { type: 'string', envKey: 'UMAMI_WEBSITE_ID' },
    // ── Contacto / SMTP ──────────────────────────────────────────────────────
    SMTP_HOST: { type: 'string', envKey: 'SMTP_HOST' },
    SMTP_PORT: { type: 'int', min: 1, max: 65535, envKey: 'SMTP_PORT' },
    SMTP_SECURE: { type: 'enum', values: ['true', 'false'], envKey: 'SMTP_SECURE' },
    SMTP_USER: { type: 'string', envKey: 'SMTP_USER' },
    SMTP_PASS: { type: 'string', envKey: 'SMTP_PASS', sensitive: true },
    SMTP_FROM: { type: 'string', envKey: 'SMTP_FROM' },
    CONTACT_TOKEN_SECRET: { type: 'string', envKey: 'CONTACT_TOKEN_SECRET', sensitive: true },
};

// Estado en memoria - se inicializa desde process.env
const _store = {};

function _init() {
    for (const [key, schema] of Object.entries(PARAM_SCHEMA)) {
        const raw = process.env[schema.envKey];
        if (schema.type === 'int') {
            _store[key] = raw ? parseInt(raw, 10) : _getDefault(key);
        } else if (schema.type === 'float') {
            _store[key] = raw ? parseFloat(raw) : _getDefault(key);
        } else if (schema.type === 'origin_list') {
            _store[key] = formatOriginList(raw || _getDefault(key), []);
        } else {
            _store[key] = raw || _getDefault(key);
        }
    }
}

function _getDefault(key) {
    const defaults = {
        MAX_PLAYERS_PER_GAME: 1000,
        MAX_LOBBIES: 10,
        QUESTION_TIME_LIMIT: 30,
        GAME_CLEANUP_INTERVAL: 3600000,
        BASE_POINTS: 20,
        MAX_TIME_BONUS: 20,
        RANDOM_POINTS_REVEAL_MS: 3500,
        STREAK_THRESHOLD: 3,
        STREAK_BONUS_PERCENTAGE: 0.5,
        TEAM_SCORE_LAMBDA: 0.5,
        RECONNECTION_TIMEOUT: 120000,
        PRESENTER_RECONNECTION_TIMEOUT: 900000,
        INACTIVE_GAME_THRESHOLD: 14400000,
        EMPTY_LOBBY_TIMEOUT: 300000,
        TOP_PLAYERS_DURING_GAME: 5,
        LOG_LEVEL: 'info',
        LOG_MAX_SIZE: '20m',
        LOG_MAX_FILES: '14d',
        BACKUP_SCHEDULE: '0 2 * * *',
        BACKUP_RETENTION_DAYS: 7,
        CORS_ORIGIN: DEFAULT_ORIGINS_CSV,
        ALLOWED_ORIGINS: DEFAULT_ORIGINS_CSV,
        PUBLIC_BASE_URL: '',
        UMAMI_SERVER_URL: '',
        UMAMI_WEBSITE_ID: '',
        SMTP_HOST: '',
        SMTP_PORT: 587,
        SMTP_SECURE: 'false',
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_FROM: '"XIRO! Contacto" <noreply@xiro.pro>',
        CONTACT_TOKEN_SECRET: 'xiro-contact-default-secret-2026',
    };
    return defaults[key];
}

function _validateNumber(key, value, schema, { isValid, parse, typeLabel }) {
    const n = parse(value);
    if (!isValid(n)) return `${key} debe ser un número ${typeLabel}`;
    if (n < schema.min || n > schema.max) return `${key} debe estar entre ${schema.min} y ${schema.max}`;
    return null;
}

function _validateEnum(key, value, schema) {
    if (!schema.values.includes(String(value))) {
        return `${key} debe ser uno de: ${schema.values.join(', ')}`;
    }
    return null;
}

function _validateUrl(key, value) {
    const trimmed = String(value ?? '').trim();
    if (trimmed === '') return null; // vacío = automático
    if (trimmed.includes(',')) return `${key} debe ser UNA sola URL (sin comas)`;

    try {
        const parsed = new URL(trimmed);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return `${key} debe empezar por http:// o https://`;
        }
    } catch (_err) {
        return `${key} debe ser una URL válida (ej: https://xiro.pro)`;
    }
    return null;
}

const _VALIDATORS_BY_TYPE = {
    int: (key, value, schema) => _validateNumber(key, value, schema, {
        isValid: (n) => !isNaN(n),
        parse: (v) => parseInt(v, 10),
        typeLabel: 'entero'
    }),
    float: (key, value, schema) => _validateNumber(key, value, schema, {
        isValid: (n) => !isNaN(n),
        parse: (v) => parseFloat(v),
        typeLabel: 'decimal'
    }),
    enum: _validateEnum,
    origin_list: (key, value) => validateOriginList(value, key),
    url: _validateUrl
};

/**
 * Valida un valor según el schema del parámetro
 * @returns {string|null} mensaje de error o null si válido
 */
function validate(key, value) {
    // hasOwn: claves heredadas (constructor, __proto__…) no son parámetros
    const schema = Object.hasOwn(PARAM_SCHEMA, key) ? PARAM_SCHEMA[key] : null;
    if (!schema) return `Parámetro desconocido: ${key}`;

    const validator = _VALIDATORS_BY_TYPE[schema.type];
    return validator ? validator(key, value, schema) : null;
}

/**
 * Obtiene el valor actual de un parámetro
 */
function get(key) {
    return _store[key] !== undefined ? _store[key] : _getDefault(key);
}

/**
 * Devuelve todos los parámetros con sus valores actuales y metadata
 */
function getAll() {
    const result = {};
    for (const [key, schema] of Object.entries(PARAM_SCHEMA)) {
        result[key] = { value: get(key), schema };
    }
    return result;
}

function getSchema() {
    return PARAM_SCHEMA;
}

/**
 * Carga los overrides guardados previamente (si existen) y los aplica sobre process.env.
 * Se llama una sola vez al arrancar.
 */
function _loadOverrides() {
    try {
        if (!fs.existsSync(OVERRIDES_FILE)) return;
        const raw = fs.readFileSync(OVERRIDES_FILE, 'utf8');
        const overrides = JSON.parse(raw);
        for (const [envKey, value] of Object.entries(overrides)) {
            process.env[envKey] = String(value);
        }
    } catch (err) {
        // Si el archivo está corrupto, simplemente lo ignoramos
        process.stderr.write(`[runtime-config] No se pudo cargar overrides: ${err.message}\n`);
    }
}

/**
 * Persiste los valores actuales del _store en runtime-overrides.json.
 * Solo guarda las claves que difieren del default para mantener el archivo limpio.
 */
function _saveOverrides() {
    try {
        const schema = getSchema();
        const toSave = {};
        for (const [key, meta] of Object.entries(schema)) {
            toSave[meta.envKey] = String(_store[key]);
        }
        fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(toSave, null, 2), 'utf8');
    } catch (err) {
        process.stderr.write(`[runtime-config] No se pudo guardar overrides: ${err.message}\n`);
    }
}

/**
 * Actualiza un parámetro en memoria, process.env y persiste en JSON.
 * @returns {string|null} error message o null si OK
 */
function set(key, value) {
    const error = validate(key, value);
    if (error) return error;

    const schema = PARAM_SCHEMA[key];
    let parsed;
    if (schema.type === 'int') parsed = parseInt(value, 10);
    else if (schema.type === 'float') parsed = parseFloat(value);
    else if (schema.type === 'origin_list') parsed = formatOriginList(value, []);
    else if (schema.type === 'url') parsed = String(value ?? '').trim().replace(/\/+$/, '');
    else parsed = String(value);

    _store[key] = parsed;
    process.env[schema.envKey] = String(parsed);
    return null;
}

/**
 * Persiste todos los valores actuales del store en el archivo JSON.
 * Llamar desde las rutas après aplicar todos los cambios.
 */
function persistAll() {
    _saveOverrides();
}

/**
 * Recarga el store desde el archivo runtime-overrides.json.
 * Llamado en todos los workers al recibir la notificación Redis 'config-updated'.
 */
function reload() {
    _loadOverrides();
    _init();
}

// Inicializar: primero cargar overrides (sobreescriben .env), luego leer process.env
_loadOverrides();
_init();

module.exports = { get, set, persistAll, reload, getAll, getSchema, validate };
