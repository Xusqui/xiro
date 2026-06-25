/**
 * @fileoverview Servicio de caché en memoria para archivos estáticos y bancos de preguntas
 * Reduce I/O de disco en NAS mediante caché LRU con pre-carga
 * FASE 1 OPTIMIZACIÓN: Agregado caché de bancos de preguntas
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');
const { calculateHitRate, buildCacheStats } = require('./helpers/CacheStatsHelper');

/**
 * Implementación de LRU Cache con TTL
 * Usa el orden de inserción de Map para O(1) en get/set/delete/evict.
 */
class LRUCache {
    constructor(maxSize = 1000, ttl = 5 * 60 * 1000) { // 5 minutos TTL por defecto
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.cache = new Map();
        this.evictions = 0; // Contador de evictions
    }

    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Verificar TTL
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        // Mover al final (más reciente) — O(1)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;
    }

    set(key, value) {
        // Si existe, eliminar para reinsertarlo al final — O(1)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        this.cache.set(key, { value, timestamp: Date.now() });

        // Si excede tamaño, eliminar el más antiguo (primero en Map) — O(1)
        if (this.cache.size > this.maxSize) {
            const lruKey = this.cache.keys().next().value;
            this.cache.delete(lruKey);
            this.evictions++;
        }
    }

    has(key) {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttl: this.ttl,
            evictions: this.evictions,
            oldestEntry: this.cache.size > 0 ? Math.min(...Array.from(this.cache.values()).map(e => e.timestamp)) : null
        };
    }
}

/**
 * Servicio de caché de archivos
 */
class FileCacheService {
    constructor() {
        this.cache = new LRUCache(500, 10 * 60 * 1000); // 500 archivos, 10 minutos TTL
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0
        };
    }

    /**
     * Lee archivo desde caché o disco
     * @param {string} filePath - Ruta absoluta al archivo
     * @param {string} encoding - Codificación (por defecto 'utf8')
     * @returns {Promise<string|Buffer>}
     */
    async readFile(filePath, encoding = 'utf8') {
        const cacheKey = `${filePath}:${encoding}`;

        // Intentar obtener desde caché
        const cached = this.cache.get(cacheKey);
        if (cached !== null) {
            this.stats.hits++;
            logger.debug('File cache HIT', { file: path.basename(filePath), hitRate: this.getHitRate() });
            return cached;
        }

        // Cache miss - leer desde disco
        this.stats.misses++;
        try {
            const content = await fs.readFile(filePath, encoding);
            this.cache.set(cacheKey, content);
            logger.debug('File cache MISS (loaded from disk)', {
                file: path.basename(filePath),
                size: content.length,
                hitRate: this.getHitRate()
            });
            return content;
        } catch (error) {
            this.stats.errors++;
            logger.error('File cache ERROR', { file: filePath, error: error.message });
            throw error;
        }
    }

    /**
     * Lee archivo JSON y lo parsea
     * @param {string} filePath - Ruta absoluta al archivo JSON
     * @returns {Promise<Object>}
     */
    async readJSON(filePath) {
        const content = await this.readFile(filePath, 'utf8');
        return JSON.parse(content);
    }

    /**
     * Pre-carga archivos en memoria (ideal para archivos estáticos en /public/data/)
     * @param {string} directoryPath - Ruta al directorio
     * @param {RegExp} pattern - Patrón de archivos a pre-cargar (por defecto: *.json)
     * @returns {Promise<number>} Número de archivos pre-cargados
     */
    async preloadDirectory(directoryPath, pattern = /\.json$/) {
        try {
            const files = await fs.readdir(directoryPath);
            let preloadedCount = 0;

            for (const file of files) {
                if (pattern.test(file) && !file.startsWith('.') && !file.startsWith('._')) {
                    const filePath = path.join(directoryPath, file);
                    try {
                        await this.readFile(filePath, 'utf8');
                        preloadedCount++;
                    } catch (err) {
                        logger.warn('Failed to preload file', { file, error: err.message });
                    }
                }
            }

            logger.info('File cache preloaded', {
                directory: directoryPath,
                count: preloadedCount,
                cacheSize: this.cache.cache.size
            });
            return preloadedCount;
        } catch (error) {
            logger.error('Failed to preload directory', { directory: directoryPath, error: error.message });
            return 0;
        }
    }

    /**
     * Invalida un archivo específico en caché
     * @param {string} filePath - Ruta del archivo a invalidar
     */
    invalidate(filePath) {
        const keysToDelete = [];
        for (const key of this.cache.cache.keys()) {
            if (key.startsWith(filePath)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => {
            this.cache.delete(key);
        });
        logger.debug('File cache invalidated', { file: filePath, keysRemoved: keysToDelete.length });
    }

    /**
     * Limpia toda la caché
     */
    clearAll() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, errors: 0 };
        logger.info('File cache cleared completely');
    }

    /**
     * Obtiene tasa de aciertos
     * @returns {string} Porcentaje con 2 decimales
     */
    getHitRate() {
        return calculateHitRate(this.stats.hits, this.stats.misses);
    }

    /**
     * Obtiene estadísticas completas
     * @returns {Object}
     */
    getStats() {
        return buildCacheStats(this.stats, this.cache);
    }
}

/**
 * FASE 1 OPTIMIZACIÓN: Caché de Bancos de Preguntas
 * TTL de 30 minutos, capacidad 100 bancos
 */
class QuestionBankCache {
    constructor() {
        this.cache = new LRUCache(100, 30 * 60 * 1000); // 100 bancos, 30 minutos TTL
        this.stats = {
            hits: 0,
            misses: 0,
            invalidations: 0
        };
    }

    /**
     * Obtiene banco de caché
     * @param {number} bankId - ID del banco
     * @param {string} type - Tipo: 'bank', 'game', 'custom_game'
     * @returns {Object|null}
     */
    get(bankId, type = 'bank') {
        const key = `${type}:${bankId}`;
        const cached = this.cache.get(key);

        if (cached) {
            this.stats.hits++;
            logger.debug('Question bank cache HIT', { bankId, type });
            return cached;
        }

        this.stats.misses++;
        return null;
    }

    /**
     * Guarda banco en caché
     * @param {number} bankId - ID del banco
     * @param {Object} data - Datos del banco
     * @param {string} type - Tipo: 'bank', 'game', 'custom_game'
     */
    set(bankId, data, type = 'bank') {
        const key = `${type}:${bankId}`;
        this.cache.set(key, data);
        logger.debug('Question bank cached', { bankId, type, size: JSON.stringify(data).length });
    }

    /**
     * Invalida caché de un banco específico
     * @param {number} bankId - ID del banco
     * @param {string} type - Tipo: 'bank', 'game', 'custom_game'
     */
    invalidate(bankId, type = 'bank') {
        const key = `${type}:${bankId}`;
        const deleted = this.cache.delete(key);

        if (deleted) {
            this.stats.invalidations++;
            logger.info('Question bank cache invalidated', { bankId, type });
        }
    }

    /**
     * Invalida todos los bancos
     */
    invalidateAll() {
        this.cache.clear();
        this.stats.invalidations++;
        logger.info('All question banks cache invalidated');
    }

    /**
     * Obtiene tasa de aciertos
     * @returns {string}
     */
    getHitRate() {
        return calculateHitRate(this.stats.hits, this.stats.misses);
    }

    /**
     * Obtiene estadísticas
     * @returns {Object}
     */
    getStats() {
        const cacheStats = this.cache.getStats();
        return {
            ...this.stats,
            evictions: cacheStats.evictions,
            hitRate: this.getHitRate(),
            size: cacheStats.size,
            maxSize: cacheStats.maxSize,
            ttl: cacheStats.ttl
        };
    }

    /**
     * Obtiene juego completo de caché (game + todos sus bancos de preguntas)
     * @param {string} gameId - ID del juego (puede ser PIN o ID numérico)
     * @param {string} type - Tipo: 'game' o 'custom_game'
     * @returns {Object|null} - { game: {...}, questions: [...] } o null si no está en caché
     */
    getFullGame(gameId, type = 'game') {
        const key = `fullgame:${type}:${gameId}`;
        const cached = this.cache.get(key);

        if (cached) {
            this.stats.hits++;
            logger.debug('Full game cache HIT', { gameId, type, questionsCount: cached.questions?.length || 0 });
            return cached;
        }

        this.stats.misses++;
        return null;
    }

    /**
     * Guarda juego completo en caché (game + todas sus preguntas)
     * @param {string} gameId - ID del juego
     * @param {Object} gameData - Datos del juego con estructura { game: {...}, questions: [...] }
     * @param {string} type - Tipo: 'game' o 'custom_game'
     */
    setFullGame(gameId, gameData, type = 'game') {
        const key = `fullgame:${type}:${gameId}`;
        this.cache.set(key, gameData);

        const questionsCount = gameData.questions?.length || 0;
        const dataSize = JSON.stringify(gameData).length;

        logger.debug('Full game cached', {
            gameId,
            type,
            questionsCount,
            size: dataSize,
            gameName: gameData.game?.name || 'unknown'
        });
    }

    /**
     * Invalida caché de un juego completo específico
     * @param {string} gameId - ID del juego
     * @param {string} type - Tipo: 'game' o 'custom_game'
     */
    invalidateGame(gameId, type = 'game') {
        const key = `fullgame:${type}:${gameId}`;
        const deleted = this.cache.delete(key);

        if (deleted) {
            this.stats.invalidations++;
            logger.info('Full game cache invalidated', { gameId, type });
        }
    }
}

// Exportar instancias singleton
const fileCacheService = new FileCacheService();
const questionBankCache = new QuestionBankCache();

module.exports = {
    fileCacheService,
    questionBankCache
};
