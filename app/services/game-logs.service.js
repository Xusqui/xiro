/**
 * @fileoverview Session game logs service (Redis buffer + persistence helpers)
 */

const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

const SESSION_LOG_PREFIX = 'logs:session:';
const SESSION_LOG_TTL_SECONDS = 6 * 60 * 60;
const DEFAULT_LOG_LIMIT = 5000;
const MAX_METADATA_CHARS = 8000;

function buildSessionLogKey(sessionId) {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return null;
    return `${SESSION_LOG_PREFIX}${normalized}`;
}

function normalizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return {};
    try {
        const serialized = JSON.stringify(metadata);
        if (!serialized || serialized.length <= MAX_METADATA_CHARS) {
            return metadata;
        }
        return {
            truncated: true,
            preview: serialized.slice(0, MAX_METADATA_CHARS)
        };
    } catch (_err) {
        return { malformedMetadata: true };
    }
}

function normalizeLogEntry(entry) {
    return {
        ts: new Date().toISOString(),
        level: entry?.level || 'info',
        event: entry?.event || 'unknown',
        actor: entry?.actor || null,
        message: entry?.message || '',
        data: normalizeMetadata(entry?.data || {})
    };
}

async function getRedisClientSafe() {
    try {
        const client = await Promise.resolve(getRedisClient());
        return client?.isReady ? client : null;
    } catch (_err) {
        return null;
    }
}

/**
 * Añade una entrada al registro de eventos de la sesión en Redis (TTL 6 h). Si Redis falla lo registra y devuelve
 * false.
 * @param {string} sessionId - ID de sesión
 * @param {Object} entry - { level, event, actor, message, metadata }; los campos que faltan toman su valor por defecto
 * @returns {Promise<boolean>} true si se guardó
 */
async function pushSessionLog(sessionId, entry) {
    const key = buildSessionLogKey(sessionId);
    if (!key) return false;

    const client = await getRedisClientSafe();
    if (!client) return false;

    try {
        const payload = JSON.stringify(normalizeLogEntry(entry));
        await client.rPush(key, payload);
        await client.expire(key, SESSION_LOG_TTL_SECONDS);
        return true;
    } catch (error) {
        logger.warn('Failed to push session log', {
            sessionId,
            error: error.message
        });
        return false;
    }
}

function parseRawLog(raw) {
    try {
        return JSON.parse(raw);
    } catch (_err) {
        return null;
    }
}

/**
 * Lee el registro de eventos de la sesión, en orden de llegada.
 * @param {string} sessionId - ID de sesión
 * @param {number} [limit=5000] - Máximo de entradas
 * @returns {Promise<Object[]>} Entradas; vacío si no hay o falla Redis
 */
async function readSessionLogs(sessionId, limit = DEFAULT_LOG_LIMIT) {
    const key = buildSessionLogKey(sessionId);
    if (!key) return [];

    const client = await getRedisClientSafe();
    if (!client) return [];

    try {
        const maxIndex = Math.max(0, Number(limit) - 1);
        const raw = await client.lRange(key, 0, maxIndex);
        return raw.map(parseRawLog).filter(Boolean);
    } catch (error) {
        logger.warn('Failed to read session logs', {
            sessionId,
            error: error.message
        });
        return [];
    }
}

/**
 * Lee el registro de eventos de la sesión y borra la clave de Redis (al guardar la sesión en la base de datos).
 * @param {string} sessionId - ID de sesión
 * @param {number} [limit=5000] - Máximo de entradas
 * @returns {Promise<Object[]>} Entradas leídas
 */
async function drainSessionLogs(sessionId, limit = DEFAULT_LOG_LIMIT) {
    const key = buildSessionLogKey(sessionId);
    if (!key) return [];

    const client = await getRedisClientSafe();
    if (!client) return [];

    const logs = await readSessionLogs(sessionId, limit);
    try {
        await client.del(key);
    } catch (error) {
        logger.warn('Failed to cleanup session logs key', {
            sessionId,
            error: error.message
        });
    }
    return logs;
}

function normalizeSessionLogs(logs) {
    if (!Array.isArray(logs)) return [];
    return logs.map(entry => normalizeLogEntry(entry || {})).slice(0, DEFAULT_LOG_LIMIT);
}

/**
 * Registro que se guarda con la sesión: el que llega ya normalizado o, si no, el que había en Redis (que se vacía).
 * @param {Object} input
 * @param {string} [input.sessionId] - ID de sesión
 * @param {Object[]} [input.sessionLogs] - Entradas ya recogidas
 * @returns {Object[]|Promise<Object[]>} Entradas (promesa si hay que leer Redis)
 */
function resolveSessionLogsForSave({ sessionId, sessionLogs }) {
    if (Array.isArray(sessionLogs) && sessionLogs.length > 0) {
        return normalizeSessionLogs(sessionLogs);
    }
    if (!sessionId) {
        return [];
    }
    return drainSessionLogs(sessionId, DEFAULT_LOG_LIMIT);
}

/**
 * Formatea el registro de una sesión como texto plano para descargarlo.
 * @param {Object} session - Fila de game_sessions (id, pin, game_type, played_at)
 * @param {Object[]} logs - Entradas
 * @returns {string}
 */
function formatSessionLogsAsText(session, logs) {
    const lines = [];
    const safeLogs = Array.isArray(logs) ? logs : [];

    lines.push('XIRO! - Session Logs');
    lines.push(`Session ID: ${session?.id ?? '-'}`);
    lines.push(`PIN: ${session?.pin ?? '-'}`);
    lines.push(`Game Type: ${session?.game_type ?? '-'}`);
    lines.push(`Played At: ${session?.played_at ?? '-'}`);
    lines.push(`Events: ${safeLogs.length}`);
    lines.push('');

    safeLogs.forEach((log, idx) => {
        const ts = log?.ts || '-';
        const level = (log?.level || 'info').toUpperCase();
        const event = log?.event || 'unknown';
        const actor = log?.actor ? ` actor=${log.actor}` : '';
        const message = log?.message ? ` ${log.message}` : '';
        lines.push(`${idx + 1}. [${ts}] [${level}] ${event}${actor}${message}`);

        const data = log?.data;
        if (data && Object.keys(data).length > 0) {
            lines.push(`   data=${JSON.stringify(data)}`);
        }
    });

    return lines.join('\r\n');
}

module.exports = {
    pushSessionLog,
    readSessionLogs,
    drainSessionLogs,
    resolveSessionLogsForSave,
    formatSessionLogsAsText
};
