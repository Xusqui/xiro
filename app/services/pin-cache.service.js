/**
 * @fileoverview Servicio de caché para validación de PINs
 * Cachea PINs válidos para reducir hits a la BD
 * 
 * Estrategia:
 * - TTL: 5 minutos (PINs cambian raramente)
 * - Invalidación: Al crear/actualizar/eliminar bancos/games
 * - Métricas: Hit/miss rate
 */

const logger = require('../config/logger');

class PinCacheService {
    constructor(ttlMinutes = 5) {
        this.cache = new Map(); // pin → {valid, type, id, timestamp}
        this.ttlMs = ttlMinutes * 60 * 1000;
        this.stats = {
            hits: 0,
            misses: 0,
            invalidations: 0
        };

        // Limpiar caché expirado cada minuto
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000).unref();
    }

    /**
     * Obtener PIN del caché
     * @param {string} pin - PIN a buscar
     * @returns {{valid: boolean, type: string|null, id: number|null} | null}
     */
    get(pin) {
        const normalizedPin = String(pin).toUpperCase();
        const cached = this.cache.get(normalizedPin);

        if (!cached) {
            this.stats.misses++;
            return null;
        }

        // Verificar si expiró
        const age = Date.now() - cached.timestamp;
        if (age > this.ttlMs) {
            this.cache.delete(normalizedPin);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return {
            valid: cached.valid,
            type: cached.type,
            id: cached.id
        };
    }

    /**
     * Guardar PIN en caché
     * @param {string} pin
     * @param {boolean} valid
     * @param {string|null} type
     * @param {number|null} id
     */
    set(pin, valid, type = null, id = null) {
        const normalizedPin = String(pin).toUpperCase();
        this.cache.set(normalizedPin, {
            valid,
            type,
            id,
            timestamp: Date.now()
        });
    }

    /**
     * Invalidar un PIN específico
     * @param {string} pin
     */
    invalidate(pin) {
        const normalizedPin = String(pin).toUpperCase();
        const deleted = this.cache.delete(normalizedPin);
        if (deleted) {
            this.stats.invalidations++;
        }
    }

    /**
     * Invalidar todos los PINs de un tipo específico
     * @param {string} type - 'bank' | 'game' | 'custom_game' | 'quiz'
     */
    invalidateByType(type) {
        let count = 0;
        for (const [pin, data] of this.cache.entries()) {
            if (data.type === type) {
                this.cache.delete(pin);
                count++;
            }
        }
        this.stats.invalidations += count;
        logger.info(`[PinCache] Invalidados ${count} PINs de tipo ${type}`);
    }

    /**
     * Limpiar toda la caché
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.invalidations += size;
        logger.info(`[PinCache] Caché limpiada completamente (${size} entradas)`);
    }

    /**
     * Limpiar entradas expiradas
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;

        for (const [pin, data] of this.cache.entries()) {
            const age = now - data.timestamp;
            if (age > this.ttlMs) {
                this.cache.delete(pin);
                removed++;
            }
        }

        if (removed > 0) {
            logger.debug(`[PinCache] Cleanup: ${removed} entradas expiradas eliminadas`);
        }
    }

    /**
     * Obtener estadísticas de caché
     * @returns {{hits: number, misses: number, hitRate: number, size: number}}
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            invalidations: this.stats.invalidations,
            hitRate: parseFloat(hitRate),
            size: this.cache.size,
            ttlMinutes: this.ttlMs / 60000
        };
    }

    /**
     * Resetear estadísticas
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            invalidations: 0
        };
    }

    /**
     * Destruir servicio (limpiar interval)
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

// Singleton
const pinCache = new PinCacheService(5); // 5 minutos TTL

module.exports = pinCache;
