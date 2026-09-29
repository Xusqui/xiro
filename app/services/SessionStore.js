/**
 * @fileoverview Redis Session Store - Almacenamiento de sesiones de juego
 * @module services/SessionStore
 * 
 * Funcionalidades:
 * - Guardar estado completo del juego por sessionId
 * - Cargar estado para reconexiones
 * - TTL automático de 6 horas
 * - Invalidación al finalizar juego
 */

const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

class SessionStore {
    constructor() {
        this.keyPrefix = 'session:';
        this.defaultTTL = 6 * 60 * 60; // 6 horas en segundos
    }

    /**
     * Generar clave Redis para sessionId
     * @private
     */
    _getKey(sessionId) {
        return `${this.keyPrefix}${sessionId}`;
    }

    /**
     * Guardar estado de sesión
     * @param {string} sessionId - ID de sesión
     * @param {Object} gameState - Estado del juego
     * @param {number} [ttl] - TTL en segundos (default: 6h)
     * @returns {Promise<boolean>}
     */
    async save(sessionId, gameState, ttl = this.defaultTTL) {
        try {
            const client = await getRedisClient();
            const key = this._getKey(sessionId);

            const data = JSON.stringify({
                ...gameState,
                savedAt: Date.now()
            });

            await client.setEx(key, ttl, data);

            logger.debug('Session saved', { sessionId, ttl });
            return true;
        } catch (error) {
            logger.error('Failed to save session', {
                sessionId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Cargar estado de sesión
     * @param {string} sessionId - ID de sesión
     * @returns {Promise<Object|null>}
     */
    async load(sessionId) {
        try {
            const client = await getRedisClient();
            const key = this._getKey(sessionId);

            const data = await client.get(key);

            if (!data) {
                logger.debug('Session not found', { sessionId });
                return null;
            }

            const gameState = JSON.parse(data);
            logger.debug('Session loaded', { sessionId });

            return gameState;
        } catch (error) {
            logger.error('Failed to load session', {
                sessionId,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Verificar si sesión existe
     * @param {string} sessionId - ID de sesión
     * @returns {Promise<boolean>}
     */
    async exists(sessionId) {
        try {
            const client = await getRedisClient();
            const key = this._getKey(sessionId);

            const result = await client.exists(key);
            return result === 1;
        } catch (error) {
            logger.error('Failed to check session existence', {
                sessionId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Invalidar sesión (eliminar)
     * @param {string} sessionId - ID de sesión
     * @returns {Promise<boolean>}
     */
    async invalidate(sessionId) {
        try {
            const client = await getRedisClient();
            const key = this._getKey(sessionId);

            const result = await client.del(key);

            logger.debug('Session invalidated', { sessionId });
            return result === 1;
        } catch (error) {
            logger.error('Failed to invalidate session', {
                sessionId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Actualizar TTL de sesión existente
     * @param {string} sessionId - ID de sesión
     * @param {number} ttl - Nuevo TTL en segundos
     * @returns {Promise<boolean>}
     */
    async refreshTTL(sessionId, ttl = this.defaultTTL) {
        try {
            const client = await getRedisClient();
            const key = this._getKey(sessionId);

            const result = await client.expire(key, ttl);

            if (result) {
                logger.debug('Session TTL refreshed', { sessionId, ttl });
            }

            return result === 1;
        } catch (error) {
            logger.error('Failed to refresh session TTL', {
                sessionId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Obtener tiempo restante de TTL
     * @param {string} sessionId - ID de sesión
     * @returns {Promise<number>} Segundos restantes (-2 si no existe, -1 si no tiene TTL)
     */
    async getTTL(sessionId) {
        try {
            const client = await getRedisClient();
            const key = this._getKey(sessionId);

            return await client.ttl(key);
        } catch (error) {
            logger.error('Failed to get session TTL', {
                sessionId,
                error: error.message
            });
            return -2;
        }
    }
}

// Singleton
const sessionStore = new SessionStore();

module.exports = sessionStore;
module.exports.SessionStore = SessionStore; // Para tests
