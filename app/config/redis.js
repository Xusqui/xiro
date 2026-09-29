/**
 * @fileoverview Redis Client Singleton - Cliente Redis compartido
 * @module config/redis
 * 
 * Proporciona un único cliente Redis para múltiples servicios (SessionStore, Cache, etc.)
 * Evita múltiples conexiones Redis innecesarias.
 */

const { createClient } = require('redis');

let redisClient = null;
let connectingPromise = null;
let logger = null;

/**
 * Obtiene el logger de forma lazy para evitar dependencias circulares
 * @private
 */
function getLogger() {
    if (!logger) {
        try {
            logger = require('./logger');
        } catch (err) {
            // Fallback si logger no está disponible (muy raro)
            logger = console;
        }
    }
    return logger;
}

function disconnectClientBestEffort(client) {
    if (!client || typeof client.disconnect !== 'function') {
        return;
    }

    try {
        const disconnectResult = client.disconnect();
        if (disconnectResult && typeof disconnectResult.catch === 'function') {
            disconnectResult.catch(() => undefined);
        }
    } catch (_disconnectError) {
        // no-op cleanup best effort
    }
}

async function disconnectClientBestEffortAsync(client) {
    if (!client || typeof client.disconnect !== 'function') {
        return;
    }

    try {
        const disconnectResult = client.disconnect();
        if (disconnectResult && typeof disconnectResult.catch === 'function') {
            await disconnectResult.catch(() => undefined);
        }
    } catch (_disconnectError) {
        // no-op cleanup best effort
    }
}

/**
 * Obtener o crear cliente Redis compartido
 * @returns {Promise<RedisClient>}
 */
function getRedisClient() {
    if (redisClient?.isReady) {
        return redisClient;
    }

    // Si ya hay una conexión en curso, todos los llamadores comparten la misma promesa
    if (connectingPromise) {
        return connectingPromise;
    }

    connectingPromise = (async () => {
        try {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            const redisSocketPath = process.env.REDIS_SOCKET_PATH;
            const redisPassword = process.env.REDIS_PASSWORD || undefined;
            const isTestEnv = process.env.NODE_ENV === 'test';

            const clientOptions = {
                url: redisUrl,
                password: redisPassword,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (isTestEnv) {
                            return false;
                        }

                        if (retries > 10) {
                            getLogger().error('Redis client exceeded max retries');
                            return false;
                        }
                        return Math.min(retries * 100, 3000);
                    }
                }
            };

            if (redisSocketPath) {
                clientOptions.url = 'redis://localhost';
                clientOptions.socket.path = redisSocketPath;
            }

            redisClient = createClient(clientOptions);

            // Nota: Usar console directamente para evitar dependencia circular con logger
            // Los event listeners de Redis se ejecutan durante la carga del módulo
            redisClient.on('error', (err) => {
                getLogger().error('Redis client error:', { error: err.message });
            });

            redisClient.on('end', () => {
                // El cliente se cerró permanentemente (reconexión agotada o quit)
                // Reseteamos para que getRedisClient() pueda crear uno nuevo
                getLogger().warn('Redis client closed, resetting for future reconnection');
                redisClient = null;
            });

            redisClient.on('reconnecting', () => {
                getLogger().warn('Redis client reconnecting');
            });

            redisClient.on('ready', () => {
                getLogger().info('✅ Redis client ready');
            });

            await redisClient.connect();
            getLogger().info('Redis client connected', { url: redisUrl });

            return redisClient;
        } catch (error) {
            getLogger().error('Failed to connect Redis client:', { error: error.message });
            disconnectClientBestEffort(redisClient);
            redisClient = null;
            throw error;
        } finally {
            connectingPromise = null;
        }
    })();

    return connectingPromise;
}

/**
 * Cerrar cliente Redis
 */
async function closeRedisClient() {
    if (!redisClient) {
        return;
    }

    if (redisClient?.isReady) {
        await redisClient.quit();
        getLogger().info('Redis client closed');
        redisClient = null;
        return;
    }

    await disconnectClientBestEffortAsync(redisClient);
    redisClient = null;
}

/**
 * Verificar si Redis está disponible
 * @returns {boolean}
 */
function isRedisAvailable() {
    return redisClient?.isReady || false;
}

module.exports = {
    getRedisClient,
    closeRedisClient,
    isRedisAvailable
};
