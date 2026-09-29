/**
 * @fileoverview Checkers individuales para cada dependencia
 * @module infrastructure/health/DependencyChecker
 *
 * Cada checker devuelve: { status: 'healthy'|'degraded'|'unhealthy', latencyMs, details? }
 */

const { pool } = require('../../config/database');
const { getRedisClient } = require('../../config/redis');

/**
 * Comprobar salud de PostgreSQL
 */
async function checkDatabase() {
    const start = Date.now();
    try {
        await pool.query('SELECT 1');
        const latencyMs = Date.now() - start;
        return {
            status: latencyMs < 200 ? 'healthy' : 'degraded',
            latencyMs,
            details: {
                totalConnections: pool.totalCount || 0,
                idleConnections: pool.idleCount || 0,
                waitingClients: pool.waitingCount || 0
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            latencyMs: Date.now() - start,
            error: error.message
        };
    }
}

/**
 * Comprobar salud de Redis
 */
async function checkRedis() {
    const start = Date.now();
    try {
        // Attempt to connect if not yet ready so health reflects real availability.
        const client = await getRedisClient();
        await client.ping();
        const latencyMs = Date.now() - start;
        return {
            status: latencyMs < 100 ? 'healthy' : 'degraded',
            latencyMs
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            latencyMs: Date.now() - start,
            error: error.message
        };
    }
}

/**
 * Comprobar salud de Socket.IO
 * @param {Object} io - Instancia de Socket.IO (puede ser null antes de inicializar)
 */
function checkSocketIO(io) {
    if (!io) {
        return { status: 'unhealthy', latencyMs: 0, error: 'Socket.IO not initialized' };
    }
    try {
        const connectedCount = io.sockets?.sockets?.size || 0;
        const adapterType = io.sockets?.adapter?.constructor?.name || 'unknown';
        return {
            status: 'healthy',
            latencyMs: 0,
            details: {
                connectedClients: connectedCount,
                adapter: adapterType
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            latencyMs: 0,
            error: error.message
        };
    }
}

module.exports = { checkDatabase, checkRedis, checkSocketIO };
