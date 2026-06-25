/**
 * @fileoverview Helper consolidado para estadísticas de caché
 * Elimina duplicación en cache.service.js
 */

/**
 * Calcula la tasa de aciertos de caché
 * @param {number} hits - Número de hits
 * @param {number} misses - Número de misses
 * @returns {string} Porcentaje formateado con 2 decimales
 */
function calculateHitRate(hits, misses) {
    const total = hits + misses;
    if (total === 0) return '0.00%';
    return ((hits / total) * 100).toFixed(2) + '%';
}

/**
 * Construye objeto de estadísticas de caché
 * @param {Object} stats - Estadísticas base { hits, misses, ... }
 * @param {Object} cache - Instancia de caché con propiedades
 * @returns {Object} Estadísticas completas
 */
function buildCacheStats(stats, cache) {
    return {
        ...stats,
        hitRate: calculateHitRate(stats.hits, stats.misses),
        cacheSize: cache.cache ? cache.cache.size : cache.size,
        maxSize: cache.maxSize,
        ttl: cache.ttl
    };
}

module.exports = {
    calculateHitRate,
    buildCacheStats
};
