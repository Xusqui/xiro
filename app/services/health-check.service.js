/**
 * @fileoverview Health Check Service
 * @module services/health-check.service
 * 
 * Proporciona endpoints de salud para monitoreo de la aplicación
 */

const { pool } = require('../config/database');

/**
 * Verifica la salud de la base de datos
 * @returns {Promise<Object>} Estado de salud de la DB
 */
async function checkDatabaseHealth() {
    try {
        // Verificar estado de los circuit breakers
        const circuitHealth = pool.getHealthStatus();

        // Test de conectividad simple
        const startTime = Date.now();
        await pool.query('SELECT 1');
        const responseTime = Date.now() - startTime;

        return {
            status: circuitHealth.healthy ? 'healthy' : (circuitHealth.degraded ? 'degraded' : 'unhealthy'),
            details: {
                ...circuitHealth,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            details: {
                error: error.message,
                timestamp: new Date().toISOString()
            }
        };
    }
}

/**
 * Obtiene estadísticas de los circuit breakers
 * @returns {Object} Estadísticas de circuit breakers
 */
function getCircuitBreakerStats() {
    return pool.getStats();
}

module.exports = {
    checkDatabaseHealth,
    getCircuitBreakerStats
};
