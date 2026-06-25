/**
 * @fileoverview Inicialización de IdempotencyService con Redis
 * @module application/services/idempotency
 */

const { createClient } = require('redis');
const IdempotencyService = require('../../domain/services/IdempotencyService');
const logger = require('../../config/logger');
const { getWorkerContext } = require('../../config/log-context');

let idempotencyService = null;
let redisClient = null;

/**
 * Inicializa IdempotencyService con cliente Redis dedicado
 * @param {Object} options - Opciones de configuración
 * @returns {Promise<IdempotencyService>}
 */
async function initializeIdempotencyService(options = {}) {
    if (idempotencyService) {
        logger.debug('IdempotencyService already initialized', getWorkerContext());
        return idempotencyService;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
        // Crear cliente Redis dedicado para idempotencia
        redisClient = createClient({
            url: redisUrl,
            password: process.env.REDIS_PASSWORD || undefined,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger.error('Redis idempotency client exceeded max retries');
                        return new Error('Redis unavailable');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err) => {
            logger.error('Redis idempotency client error', { error: err.message });
        });

        redisClient.on('reconnecting', () => {
            logger.warn('Redis idempotency client reconnecting');
        });

        await redisClient.connect();

        // Crear servicio
        idempotencyService = new IdempotencyService(redisClient, {
            ttl: options.ttl || 300, // 5 minutos
            prefix: options.prefix || 'idempotency:'
        });

        logger.info('✅ IdempotencyService initialized with dedicated Redis client', getWorkerContext());

        return idempotencyService;
    } catch (error) {
        logger.error('Failed to initialize IdempotencyService', {
            error: error.message
        });

        // Crear servicio fallback sin Redis (para desarrollo)
        logger.warn('⚠️ Creating fallback IdempotencyService without Redis');
        idempotencyService = createFallbackService();
        return idempotencyService;
    }
}

/**
 * Servicio fallback sin Redis (usa Map en memoria)
 * Solo para desarrollo/testing
 */
function createFallbackService() {
    const memoryCache = new Map();

    // Periodic cleanup every 60 s to prevent unbounded growth
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of memoryCache.entries()) {
            if (now >= entry.expiresAt) {
                memoryCache.delete(key);
            }
        }
    }, 60000);
    // Allow the process to exit even if this interval is still active
    if (cleanupInterval.unref) cleanupInterval.unref();

    return {
        isProcessed(requestId) {
            const cached = memoryCache.get(requestId);
            if (!cached) return null;
            if (Date.now() >= cached.expiresAt) {
                memoryCache.delete(requestId);
                return null;
            }
            return cached.result;
        },

        markProcessed(requestId, result) {
            memoryCache.set(requestId, {
                result: { ...result, _cached: true },
                expiresAt: Date.now() + 300000 // 5 min
            });
            return true;
        },

        clear(requestId) {
            return memoryCache.delete(requestId);
        },

        getStats() {
            return {
                totalCached: memoryCache.size,
                ttl: 300,
                prefix: 'memory:',
                fallback: true
            };
        }
    };
}

/**
 * Obtiene la instancia del servicio
 * @returns {IdempotencyService|null}
 */
function getIdempotencyService() {
    return idempotencyService;
}

/**
 * Cierra conexiones y limpia recursos
 */
async function cleanup() {
    if (redisClient) {
        await redisClient.quit();
        logger.info('IdempotencyService Redis client closed');
    }
    idempotencyService = null;
    redisClient = null;
}

module.exports = {
    initializeIdempotencyService,
    getIdempotencyService,
    cleanup
};
