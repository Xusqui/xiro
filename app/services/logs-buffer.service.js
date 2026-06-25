/**
 * @fileoverview Buffer circular de logs en Redis (compartido entre workers)
 * Almacena los últimos N logs para consulta en tiempo real
 */

const { getRedisClient } = require('../config/redis');

class LogsBufferService {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.enabled = true;
        this.redisKey = 'xiro:logs:buffer';
        // Backoff: tras un error de Redis, esperar antes de reintentar
        this._retryAfter = 0;       // timestamp ms hasta el que no reintentar
        this._retryDelay = 10000;   // 10 segundos de backoff
    }

    /**
     * Obtiene el cliente Redis listo para usar, o null si no está disponible.
     * Nunca cachea el cliente; delega en el singleton de redis.js.
     * @private
     */
    async _getRedisClient() {
        if (Date.now() < this._retryAfter) {
            return null; // En período de backoff, no intentar
        }

        // Fijar backoff ANTES del await para evitar race condition:
        // con múltiples llamadas concurrentes todas pasan el guard anterior
        // (Date.now() == 0) antes de que ninguna complete el await y setee
        // _retryAfter. Al fijarla aquí (síncronamente), las siguientes ya la ven.
        this._retryAfter = Date.now() + this._retryDelay;

        try {
            const client = await getRedisClient();
            if (client?.isReady) {
                this._retryAfter = 0; // Conexión ok, permitir llamadas inmediatas
                return client;
            }
            return null;
        } catch (err) {
            // Solo loguear la primera vez del período de backoff
            console.error('LogsBufferService: Redis unavailable:', err.message);
            return null;
        }
    }

    /**
     * Añade un log al buffer en Redis
     * @param {Object} logEntry - Entrada de log
     * @param {string} logEntry.level - Nivel del log (error, warn, info, http, debug)
     * @param {string} logEntry.message - Mensaje del log
     * @param {Object} [logEntry.metadata] - Metadata adicional
     * @param {string|Date} [logEntry.timestamp] - Timestamp del log
     */
    async add(logEntry) {
        if (!this.enabled) return;

        const client = await this._getRedisClient();
        if (!client) return; // Redis no disponible, silencio total

        try {
            // Normalizar timestamp a ISO 8601 para ordenamiento consistente
            let normalizedTimestamp;
            try {
                normalizedTimestamp = logEntry.timestamp
                    ? new Date(logEntry.timestamp).toISOString()
                    : new Date().toISOString();
            } catch (e) {
                normalizedTimestamp = new Date().toISOString();
            }

            const entry = {
                id: this._generateId(),
                timestamp: normalizedTimestamp,
                level: logEntry.level || 'info',
                message: logEntry.message || '',
                metadata: this._sanitizeMetadata(logEntry.metadata || {}),
                ...this._extractContextInfo(logEntry)
            };

            // Guardar en Redis (LPUSH añade al inicio, más reciente primero)
            await client.lPush(this.redisKey, JSON.stringify(entry));

            // Mantener solo los últimos N logs (LTRIM)
            await client.lTrim(this.redisKey, 0, this.maxSize - 1);
        } catch (err) {
            // Activar backoff para no reintentar de inmediato
            this._retryAfter = Date.now() + this._retryDelay;
        }
    }

    /**
     * Obtiene logs con filtros opcionales (desde Redis)
     * @param {Object} options - Opciones de filtrado
     * @param {string} [options.level] - Filtrar por nivel
     * @param {string} [options.search] - Buscar texto en mensaje
     * @param {number} [options.limit] - Límite de resultados
     * @returns {Promise<Array>} Logs filtrados
     */
    async getLogs(options = {}) {
        if (!this.enabled) {
            return [];
        }

        const client = await this._getRedisClient();
        if (!client) return [];

        try {
            // Obtener todos los logs de Redis (LRANGE 0 -1)
            const rawLogs = await client.lRange(this.redisKey, 0, -1);

            let logs = rawLogs.map(raw => {
                try {
                    return JSON.parse(raw);
                } catch (e) {
                    return null;
                }
            }).filter(log => log !== null);

            // Ordenar por timestamp (más antiguos primero)
            logs.sort((a, b) => {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return timeA - timeB; // Ascendente
            });

            // Filtrar por nivel
            if (options.level && options.level !== 'all') {
                logs = logs.filter(log => log.level === options.level);
            }

            // Buscar en mensaje y metadata
            if (options.search) {
                const searchLower = options.search.toLowerCase();
                logs = logs.filter(log => {
                    const messageMatch = log.message.toLowerCase().includes(searchLower);
                    const metadataMatch = JSON.stringify(log.metadata).toLowerCase().includes(searchLower);
                    return messageMatch || metadataMatch;
                });
            }

            // Limitar resultados
            if (options.limit && options.limit > 0) {
                logs = logs.slice(0, options.limit);
            }

            return logs;
        } catch (err) {
            console.error('LogsBufferService.getLogs error:', err.message);
            return [];
        }
    }

    /**
     * Obtiene estadísticas de logs (desde Redis)
     * @returns {Promise<Object>} Estadísticas por nivel
     */
    async getStats() {
        const stats = {
            total: 0,
            byLevel: {
                error: 0,
                warn: 0,
                info: 0,
                http: 0,
                debug: 0
            },
            oldest: null,
            newest: null
        };

        if (!this.enabled) {
            return stats;
        }

        try {
            const logs = await this.getLogs();
            stats.total = logs.length;

            logs.forEach(log => {
                if (stats.byLevel[log.level] !== undefined) {
                    stats.byLevel[log.level]++;
                }
            });

            if (logs.length > 0) {
                stats.oldest = logs[0].timestamp;
                stats.newest = logs[logs.length - 1].timestamp;
            }
        } catch (err) {
            console.error('LogsBufferService.getStats error:', err.message);
        }

        return stats;
    }

    /**
     * Limpia todos los logs del buffer en Redis
     */
    async clear() {
        if (!this.enabled) return;

        const client = await this._getRedisClient();
        if (!client) return;

        try {
            await client.del(this.redisKey);
        } catch (err) {
            this._retryAfter = Date.now() + this._retryDelay;
        }
    }

    /**
     * Habilita o deshabilita el buffer
     * @param {boolean} enabled - Estado del buffer
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Genera un ID único para cada log
     * @private
     */
    _generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sanitiza metadata para evitar información sensible
     * @private
     */
    _sanitizeMetadata(metadata) {
        const sanitized = { ...metadata };

        // Eliminar campos internos de Winston
        const internalFields = ['level', 'message', 'timestamp', 'Symbol(level)', 'Symbol(message)'];
        internalFields.forEach(field => delete sanitized[field]);

        // Eliminar posibles tokens/passwords
        const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'apiKey'];
        Object.keys(sanitized).forEach(key => {
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                sanitized[key] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    /**
     * Extrae información de contexto del log
     * @private
     */
    _extractContextInfo(logEntry) {
        const context = {};

        // Extraer tipo si existe (socket, game, auth, etc.)
        if (logEntry.metadata?.type) {
            context.type = logEntry.metadata.type;
        }

        // Extraer acción si existe
        if (logEntry.metadata?.action) {
            context.action = logEntry.metadata.action;
        }

        return context;
    }

    /**
     * Obtiene métricas del buffer (desde Redis)
     * @returns {Promise<Object>} Métricas de uso
     */
    async getMetrics() {
        let size = 0;

        if (this.enabled) {
            const client = await this._getRedisClient();
            if (client) {
                try {
                    size = await client.lLen(this.redisKey);
                } catch (err) {
                    this._retryAfter = Date.now() + this._retryDelay;
                }
            }
        }

        return {
            size,
            maxSize: this.maxSize,
            usage: ((size / this.maxSize) * 100).toFixed(2) + '%',
            enabled: this.enabled,
            storage: 'redis'
        };
    }
}

// Singleton
let instance = null;

/**
 * Obtiene la instancia singleton del servicio
 * @param {number} [maxSize] - Tamaño máximo del buffer (solo primera vez)
 * @returns {LogsBufferService}
 */
function getLogsBufferService(maxSize = 1000) {
    if (!instance) {
        instance = new LogsBufferService(maxSize);
    }
    return instance;
}

module.exports = {
    LogsBufferService,
    getLogsBufferService
};
