/**
 * @fileoverview Database Metrics Service
 * @module services/db-metrics.service
 * 
 * Proporciona métricas detalladas de la base de datos para monitoreo
 */

const { pool } = require('../config/database');

/**
 * Obtiene estadísticas del pool de conexiones
 * @returns {Object} Estadísticas del pool
 */
function getPoolMetrics() {
    // Acceder al rawPool interno del DatabaseCircuitBreaker
    const rawPool = pool.pool;

    return {
        totalCount: rawPool.totalCount || 0,
        idleCount: rawPool.idleCount || 0,
        waitingCount: rawPool.waitingCount || 0,
        configuration: {
            min: rawPool.options.min,
            max: rawPool.options.max,
            idleTimeoutMillis: rawPool.options.idleTimeoutMillis,
            connectionTimeoutMillis: rawPool.options.connectionTimeoutMillis
        }
    };
}

/**
 * Ejecuta query de estadísticas de PostgreSQL
 * @returns {Promise<Object>} Estadísticas de queries
 */
async function getQueryMetrics() {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_queries,
                SUM(CASE WHEN state = 'active' THEN 1 ELSE 0 END) as active_queries,
                SUM(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) as idle_connections
            FROM pg_stat_activity
            WHERE datname = current_database()
        `);

        return result.rows[0] || {
            total_queries: 0,
            active_queries: 0,
            idle_connections: 0
        };
    } catch (error) {
        return {
            total_queries: 0,
            active_queries: 0,
            idle_connections: 0,
            error: error.message
        };
    }
}

/**
 * Obtiene estadísticas de índices
 * @returns {Promise<Array>} Top 10 índices más usados
 */
async function getIndexMetrics() {
    try {
        const result = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan as scans,
                idx_tup_read as tuples_read,
                idx_tup_fetch as tuples_fetched,
                pg_size_pretty(pg_relation_size(indexname::regclass)) as size
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
            ORDER BY idx_scan DESC
            LIMIT 10
        `);

        return result.rows;
    } catch (error) {
        return [];
    }
}

/**
 * Obtiene tamaño de las tablas principales
 * @returns {Promise<Array>} Tamaño de tablas
 */
async function getTableSizes() {
    try {
        const result = await pool.query(`
            SELECT 
                tablename,
                pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
                pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size,
                pg_size_pretty(pg_total_relation_size(tablename::regclass) - pg_relation_size(tablename::regclass)) as indexes_size
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(tablename::regclass) DESC
            LIMIT 10
        `);

        return result.rows;
    } catch (error) {
        return [];
    }
}

/**
 * Obtiene métricas completas de la base de datos
 * @returns {Promise<Object>} Métricas completas
 */
async function getCompleteMetrics() {
    const [queryMetrics, indexMetrics, tableSizes] = await Promise.all([
        getQueryMetrics(),
        getIndexMetrics(),
        getTableSizes()
    ]);

    return {
        timestamp: new Date().toISOString(),
        pool: getPoolMetrics(),
        circuitBreaker: pool.getStats(),
        health: pool.getHealthStatus(),
        queries: queryMetrics,
        indexes: indexMetrics,
        tables: tableSizes
    };
}

module.exports = {
    getPoolMetrics,
    getQueryMetrics,
    getIndexMetrics,
    getTableSizes,
    getCompleteMetrics
};
