/**
 * @fileoverview IdempotencyService - Prevención de procesamiento duplicado de comandos
 * @module domain/services/IdempotencyService
 * 
 * Responsabilidades:
 * - Detectar requests duplicados usando requestId
 * - Cachear resultados de requests procesados (Redis)
 * - Retornar resultados cacheados para requests duplicados
 * - Auto-expiración con TTL configurable
 * 
 * Casos de uso:
 * - Evitar double-submit de respuestas
 * - Proteger contra spam de reconexiones
 * - Manejar reintentos automáticos del cliente
 */

const logger = require('../../config/logger');
const { getWorkerContext } = require('../../config/log-context');

class IdempotencyService {
    /**
     * @param {Object} redisClient - Cliente Redis
     * @param {Object} options - Opciones de configuración
     * @param {number} options.ttl - Time to live en segundos (default: 300 = 5 min)
     * @param {string} options.prefix - Prefijo para keys (default: 'idempotency:')
     */
    constructor(redisClient, options = {}) {
        if (!redisClient) {
            throw new Error('IdempotencyService requires a Redis client');
        }

        this.redis = redisClient;
        this.ttl = options.ttl || 300; // 5 minutos por defecto
        this.prefix = options.prefix || 'idempotency:';

        logger.info('IdempotencyService initialized', {
            ...getWorkerContext(),
            ttl: this.ttl,
            prefix: this.prefix
        });
    }

    /**
     * Verifica si un requestId ya fue procesado
     * @param {string} requestId - ID único del request
     * @returns {Promise<Object|null>} Resultado cacheado o null si no existe
     */
    async isProcessed(requestId) {
        if (!requestId) {
            return null;
        }

        try {
            const key = this._buildKey(requestId);
            const cached = await this.redis.get(key);

            if (cached) {
                logger.debug('Request duplicado detectado', { requestId });
                return JSON.parse(cached);
            }

            return null;
        } catch (error) {
            logger.error('Error checking idempotency', {
                requestId,
                error: error.message
            });
            // En caso de error, permitir procesamiento (fail open)
            return null;
        }
    }

    /**
     * Marca un request como procesado y guarda su resultado
     * @param {string} requestId - ID único del request
     * @param {Object} result - Resultado a cachear
     * @returns {Promise<boolean>} true si se guardó correctamente
     */
    async markProcessed(requestId, result) {
        if (!requestId) {
            logger.warn('Attempted to mark request without requestId');
            return false;
        }

        try {
            const key = this._buildKey(requestId);
            const serialized = JSON.stringify({
                ...result,
                _cached: true,
                _cachedAt: Date.now()
            });

            if (typeof this.redis.setEx === 'function') {
                await this.redis.setEx(key, this.ttl, serialized);
            } else if (typeof this.redis.setex === 'function') {
                await this.redis.setex(key, this.ttl, serialized);
            } else {
                await this.redis.set(key, serialized, { EX: this.ttl });
            }

            logger.debug('Request marked as processed', {
                requestId,
                ttl: this.ttl
            });

            return true;
        } catch (error) {
            logger.error('Error marking request as processed', {
                requestId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Elimina un request del cache (útil para testing)
     * @param {string} requestId - ID del request a eliminar
     * @returns {Promise<boolean>}
     */
    async clear(requestId) {
        if (!requestId) {
            return false;
        }

        try {
            const key = this._buildKey(requestId);
            await this.redis.del(key);
            return true;
        } catch (error) {
            logger.error('Error clearing idempotency key', {
                requestId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Genera requestId único (helper para clientes sin soporte)
     * @param {string} playerId - ID del jugador
     * @param {string} operation - Tipo de operación
     * @returns {string} requestId único
     */
    static generateRequestId(playerId, operation = 'default') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        return `${playerId}-${operation}-${timestamp}-${random}`;
    }

    /**
     * Valida formato de requestId
     * @param {string} requestId - ID a validar
     * @returns {boolean}
     */
    static isValidRequestId(requestId) {
        if (!requestId || typeof requestId !== 'string') {
            return false;
        }

        // Formato esperado: playerId-operation-timestamp-random
        // Mínimo 10 caracteres
        return requestId.length >= 10;
    }

    /**
     * Construye key de Redis
     * @private
     * @param {string} requestId
     * @returns {string}
     */
    _buildKey(requestId) {
        return `${this.prefix}${requestId}`;
    }

    /**
     * Obtiene estadísticas del servicio (para monitoring)
     * @returns {Promise<Object>}
     */
    async getStats() {
        try {
            const pattern = `${this.prefix}*`;
            const keys = await this.redis.keys(pattern);

            return {
                totalCached: keys.length,
                ttl: this.ttl,
                prefix: this.prefix
            };
        } catch (error) {
            logger.error('Error getting idempotency stats', {
                error: error.message
            });
            return {
                totalCached: -1,
                ttl: this.ttl,
                prefix: this.prefix,
                error: error.message
            };
        }
    }
}

module.exports = IdempotencyService;
