/**
 * @fileoverview Caché de rankings usando Redis Sorted Sets
 * 
 * Implementa el patrón Cache-aside con actualizaciones incrementales
 * usando el comando ZADD de Redis para mantener rankings ordenados
 * en tiempo real durante las partidas.
 * 
 * Características principales:
 * - Sorted Sets para ranking ordenado por score
 * - Actualizaciones incrementales (O(log N) por operación)
 * - TTL automático para limpieza de partidas finalizadas
 * - Lazy connection: se conecta a Redis bajo demanda
 * - Singleton: una única instancia compartida en toda la app
 * 
 * @module RankingCache
 * @requires config/logger
 * @requires config/redis
 */

const logger = require('../config/logger');
const { getRedisClient } = require('../config/redis');

class RankingCache {
    /**
     * @constructor
     * Inicializa la caché de rankings con configuración por defecto.
     * La conexión a Redis se establece de forma lazy en la primera operación.
     */
    constructor() {
        this.keyPrefix = 'ranking:';
        this.defaultTTL = 60; // 60s para juegos activos
        this._redis = null;
    }

    /**
     * Obtiene el cliente Redis, conectando si es necesario (lazy init).
     * Verifica que la conexión esté activa antes de devolverla.
     * @private
     * @returns {Promise<import('redis').RedisClientType|null>} Cliente Redis o null si no disponible
     */
    async _getRedis() {
        if (this._redis?.isReady) return this._redis;
        try {
            this._redis = await getRedisClient();
            return this._redis;
        } catch {
            return null;
        }
    }

    /**
     * Genera la clave Redis para el ranking de una sesión.
     * @private
     * @param {string} sessionId - ID de la sesión de juego
     * @returns {string} Clave Redis con formato "ranking:{sessionId}"
     */
    _getKey(sessionId) {
        return `${this.keyPrefix}${sessionId}`;
    }

    /**
     * Actualiza el score de un jugador en el sorted set del ranking.
     * Si el jugador no existe, lo añade. Si existe, actualiza su score.
     * Operación atómica O(log N) usando ZADD.
     * 
     * @param {string} sessionId - ID de la sesión de juego
     * @param {string} nickname - Nombre del jugador
     * @param {number} score - Puntuación del jugador
     * @param {number} [ttl] - TTL en segundos (default: 60s)
     * @returns {Promise<boolean>} true si la operación fue exitosa
     */
    async updateIncremental(sessionId, nickname, score, ttl) {
        try {
            const redis = await this._getRedis();
            if (!redis) {
                logger.warn('RankingCache: Redis no disponible, skip cache');
                return false;
            }

            const key = this._getKey(sessionId);
            const ttlToUse = ttl || this.defaultTTL;

            // Pipeline update and TTL using MULTI/EXEC
            await redis.multi()
                .zAdd(key, { score, value: nickname })
                .expire(key, ttlToUse)
                .exec();

            logger.debug(`RankingCache: Actualizado ${nickname} → ${score} en ${sessionId}`);
            return true;
        } catch (error) {
            logger.error('RankingCache: Error en updateIncremental', {
                error: error.message, sessionId, nickname, score
            });
            return false;
        }
    }

    /**
     * Obtiene el ranking (top N jugadores) ordenado por score descendente.
     * Usa ZRANGE con REV para obtener desde el mayor score.
     * 
     * @param {string} sessionId - ID de la sesión de juego
     * @param {number} [limit] - Número máximo de jugadores a retornar (default: todos)
     * @returns {Promise<Array<{nickname: string, score: number, position: number}>|null>}
     *          Array de jugadores ordenados por score, o null si no existe ranking
     */
    async getRange(sessionId, limit) {
        try {
            const redis = await this._getRedis();
            if (!redis) {
                logger.warn('RankingCache: Redis no disponible, retornando null');
                return null;
            }

            const key = this._getKey(sessionId);
            const end = limit ? limit - 1 : -1;
            const ranking = await redis.zRangeWithScores(key, 0, end, { REV: true });

            if (!ranking || ranking.length === 0) {
                return null;
            }

            return ranking.map((item, index) => ({
                nickname: item.value,
                score: item.score,
                position: index + 1
            }));
        } catch (error) {
            logger.error('RankingCache: Error en getRange', {
                error: error.message, sessionId, limit
            });
            return null;
        }
    }

    /**
     * Verifica si existe un ranking en caché para la sesión dada.
     * 
     * @param {string} sessionId - ID de la sesión de juego
     * @returns {Promise<boolean>} true si el ranking existe en Redis
     */
    async exists(sessionId) {
        try {
            const redis = await this._getRedis();
            if (!redis) {
                return false;
            }

            const key = this._getKey(sessionId);
            const result = await redis.exists(key);
            return result === 1;
        } catch (error) {
            logger.error('RankingCache: Error en exists', { error: error.message, sessionId });
            return false;
        }
    }

    /**
     * Invalida (elimina) el ranking de una sesión de la caché.
     * Se usa al finalizar una partida para limpieza.
     * 
     * @param {string} sessionId - ID de la sesión de juego
     * @returns {Promise<boolean>} true si se eliminó el ranking
     */
    async invalidate(sessionId) {
        try {
            const redis = await this._getRedis();
            if (!redis) {
                logger.warn('RankingCache: Redis no disponible, skip invalidación');
                return false;
            }

            const key = this._getKey(sessionId);
            const deleted = await redis.del(key);

            if (deleted > 0) {
                logger.info(`RankingCache: Invalidado ranking para ${sessionId}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error('RankingCache: Error en invalidate', { error: error.message, sessionId });
            return false;
        }
    }

    /**
     * Refresca el TTL de un ranking existente.
     * Útil para mantener vivo el ranking durante partidas largas.
     * 
     * @param {string} sessionId - ID de la sesión de juego
     * @param {number} [ttl] - Nuevo TTL en segundos (default: 60s)
     * @returns {Promise<boolean>} true si se actualizó el TTL
     */
    async refreshTTL(sessionId, ttl) {
        try {
            const redis = await this._getRedis();
            if (!redis) {
                return false;
            }

            const key = this._getKey(sessionId);
            const ttlToUse = ttl || this.defaultTTL;

            const updated = await redis.expire(key, ttlToUse);
            return updated === 1;
        } catch (error) {
            logger.error('RankingCache: Error en refreshTTL', { error: error.message, sessionId });
            return false;
        }
    }

    /**
     * Obtiene el TTL restante de un ranking en segundos.
     * 
     * @param {string} sessionId - ID de la sesión de juego
     * @returns {Promise<number>} TTL en segundos, -1 si no tiene TTL, -2 si no existe
     */
    async getTTL(sessionId) {
        try {
            const redis = await this._getRedis();
            if (!redis) {
                return -2;
            }

            const key = this._getKey(sessionId);
            return await redis.ttl(key);
        } catch (error) {
            logger.error('RankingCache: Error en getTTL', { error: error.message, sessionId });
            return -2;
        }
    }
}

// Singleton instance
const rankingCache = new RankingCache();

module.exports = rankingCache;
