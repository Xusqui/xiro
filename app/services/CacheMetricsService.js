/**
 * @fileoverview Servicio agregador de métricas de caché
 * Recopila y centraliza métricas de todos los sistemas de caché
 * FASE 17.1 - DÍA 5: Cache metrics dashboard
 */

const { questionBankCache, fileCacheService } = require('./cache.service');
const rankingCache = require('./RankingCache');
const sessionStore = require('./SessionStore');
const cacheWarmingService = require('./CacheWarmingService');
const cacheInvalidationService = require('./CacheInvalidationService');
const logger = require('../config/logger');

/**
 * Servicio singleton para agregar métricas de todos los cachés
 */
class CacheMetricsService {
    /**
     * Calcula el tamaño aproximado de un objeto en bytes
     * @param {*} obj - Objeto a medir
     * @returns {number} - Tamaño aproximado en bytes
     */
    calculateSizeInBytes(obj) {
        try {
            const str = JSON.stringify(obj);
            return new Blob([str]).size;
        } catch (error) {
            // Fallback si JSON.stringify falla
            return 0;
        }
    }

    /**
     * Convierte bytes a megabytes
     * @param {number} bytes - Tamaño en bytes
     * @returns {string} - Tamaño formateado en MB
     */
    bytesToMB(bytes) {
        return (bytes / (1024 * 1024)).toFixed(2);
    }

    /**
     * Calcula hit rate como porcentaje
     * @param {number} hits - Número de hits
     * @param {number} misses - Número de misses
     * @returns {string} - Hit rate como string con %
     */
    calculateHitRate(hits, misses) {
        const total = hits + misses;
        if (total === 0) return '0.00%';
        return ((hits / total) * 100).toFixed(2) + '%';
    }

    /**
     * Obtiene métricas de QuestionBankCache
     * @returns {Object} - Métricas del caché de bancos de preguntas
     */
    getQuestionBankCacheMetrics() {
        try {
            const stats = questionBankCache.getStats();
            return {
                type: 'QuestionBankCache',
                hits: stats.hits,
                misses: stats.misses,
                hitRate: stats.hitRate,
                evictions: stats.evictions,
                size: stats.size,
                maxSize: stats.maxSize,
                ttl: `${stats.ttl / 1000}s`
            };
        } catch (error) {
            logger.error('Error getting QuestionBankCache metrics', { error: error.message });
            return { type: 'QuestionBankCache', error: error.message };
        }
    }

    /**
     * Obtiene métricas de FileCacheService
     * @returns {Object} - Métricas del caché de archivos
     */
    getFileCacheMetrics() {
        try {
            const stats = fileCacheService.getStats();
            return {
                type: 'FileCacheService',
                hits: stats.hits,
                misses: stats.misses,
                hitRate: this.calculateHitRate(stats.hits, stats.misses),
                errors: stats.errors,
                cacheSize: stats.cacheSize,
                lastAccess: stats.lastAccess
            };
        } catch (error) {
            logger.error('Error getting FileCacheService metrics', { error: error.message });
            return { type: 'FileCacheService', error: error.message };
        }
    }

    /**
     * Obtiene métricas de RankingCache
     * @returns {Object} - Métricas del caché de rankings
     */
    async getRankingCacheMetrics() {
        try {
            const stats = await rankingCache.getStats();
            return {
                type: 'RankingCache',
                hits: stats.hits,
                misses: stats.misses,
                hitRate: this.calculateHitRate(stats.hits, stats.misses),
                evictions: stats.evictions,
                keys: stats.keys,
                ttl: `${stats.defaultTTL}s`
            };
        } catch (error) {
            logger.error('Error getting RankingCache metrics', { error: error.message });
            return { type: 'RankingCache', error: error.message };
        }
    }

    /**
     * Obtiene métricas de SessionStore
     * @returns {Object} - Métricas del store de sesiones
     */
    async getSessionStoreMetrics() {
        try {
            const stats = await sessionStore.getStats();
            return {
                type: 'SessionStore',
                hits: stats.hits,
                misses: stats.misses,
                hitRate: this.calculateHitRate(stats.hits, stats.misses),
                activeSessions: stats.activeSessions,
                ttl: `${stats.defaultTTL}s`
            };
        } catch (error) {
            logger.error('Error getting SessionStore metrics', { error: error.message });
            return { type: 'SessionStore', error: error.message };
        }
    }

    /**
     * Obtiene estadísticas de CacheWarmingService
     * @returns {Object} - Estadísticas de precarga de caché
     */
    getWarmingStats() {
        try {
            const stats = cacheWarmingService.getStats();
            return {
                type: 'CacheWarmingService',
                warmingInProgress: stats.warmingInProgress,
                lastWarmingTime: stats.lastWarmingTime,
                warmedGamesCount: stats.warmedGamesCount
            };
        } catch (error) {
            logger.error('Error getting CacheWarmingService stats', { error: error.message });
            return { type: 'CacheWarmingService', error: error.message };
        }
    }

    /**
     * Obtiene estadísticas de CacheInvalidationService
     * @returns {Object} - Estadísticas de invalidación de caché
     */
    getInvalidationStats() {
        try {
            const stats = cacheInvalidationService.getStats();
            return {
                type: 'CacheInvalidationService',
                gameEndedInvalidations: stats.gameEndedInvalidations,
                playerJoinedInvalidations: stats.playerJoinedInvalidations,
                cascadeInvalidations: stats.cascadeInvalidations,
                totalInvalidations: stats.totalInvalidations,
                errors: stats.errors,
                lastInvalidation: stats.lastInvalidation
            };
        } catch (error) {
            logger.error('Error getting CacheInvalidationService stats', { error: error.message });
            return { type: 'CacheInvalidationService', error: error.message };
        }
    }

    /**
     * Agrega métricas de todos los cachés del sistema
     * @returns {Promise<Object>} - Métricas agregadas de todos los cachés
     */
    async aggregateMetrics() {
        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                caches: {
                    questionBank: this.getQuestionBankCacheMetrics(),
                    fileCache: this.getFileCacheMetrics(),
                    ranking: await this.getRankingCacheMetrics(),
                    sessions: await this.getSessionStoreMetrics()
                },
                services: {
                    warming: this.getWarmingStats(),
                    invalidation: this.getInvalidationStats()
                },
                summary: this.calculateSummary()
            };

            logger.debug('Cache metrics aggregated successfully');
            return metrics;
        } catch (error) {
            logger.error('Error aggregating cache metrics', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    /**
     * Calcula resumen agregado de todas las métricas
     * @returns {Object} - Resumen con totales y promedios
     */
    calculateSummary() {
        try {
            const qbStats = questionBankCache.getStats();
            const fileStats = fileCacheService.getStats();

            const totalHits = qbStats.hits + fileStats.hits;
            const totalMisses = qbStats.misses + fileStats.misses;
            const totalEvictions = qbStats.evictions;

            return {
                totalHits,
                totalMisses,
                overallHitRate: this.calculateHitRate(totalHits, totalMisses),
                totalEvictions,
                cacheCount: 4 // QuestionBank, FileCache, Ranking, Sessions
            };
        } catch (error) {
            logger.error('Error calculating summary', { error: error.message });
            return {
                totalHits: 0,
                totalMisses: 0,
                overallHitRate: '0.00%',
                totalEvictions: 0,
                cacheCount: 0
            };
        }
    }
}

// Exportar instancia singleton
const cacheMetricsService = new CacheMetricsService();

module.exports = cacheMetricsService;
