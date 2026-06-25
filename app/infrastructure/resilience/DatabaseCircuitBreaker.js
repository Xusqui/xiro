/**
 * @fileoverview Database Circuit Breaker Wrapper
 * @module infrastructure/resilience/DatabaseCircuitBreaker
 * 
 * Wrappea el pool de PostgreSQL con Circuit Breaker para:
 * - Proteger contra cascadas de errores de DB
 * - Fail fast cuando la DB no responde
 * - Métricas de salud de DB
 */

const { CircuitBreakerService } = require('./CircuitBreakerService');
const logger = require('../../config/logger');

/**
 * Wrapper del pool de PostgreSQL con Circuit Breaker
 */
class DatabaseCircuitBreaker {
    constructor(pool, options = {}) {
        this.pool = pool;

        // Circuit Breaker para operaciones de lectura (más tolerante)
        this.readCircuit = new CircuitBreakerService({
            name: 'db-read',
            failureThreshold: options.readFailureThreshold || 5,
            successThreshold: options.readSuccessThreshold || 2,
            timeout: options.readTimeout || 30000,
            monitoringPeriod: 60000
        });

        // Circuit Breaker para operaciones de escritura (menos tolerante)
        this.writeCircuit = new CircuitBreakerService({
            name: 'db-write',
            failureThreshold: options.writeFailureThreshold || 3,
            successThreshold: options.writeSuccessThreshold || 2,
            timeout: options.writeTimeout || 30000,
            monitoringPeriod: 60000
        });

        this._setupEventListeners();
    }

    /**
     * Configura listeners para eventos del circuit breaker
     * @private
     */
    _setupEventListeners() {
        // Eventos de lectura
        this.readCircuit.on('stateChange', ({ from, to, timestamp }) => {
            logger.warn('DB Read Circuit Breaker state changed', { from, to, timestamp });
        });

        this.readCircuit.on('failure', ({ error, failureCount }) => {
            logger.error('DB Read operation failed', { error, failureCount });
        });

        // Eventos de escritura
        this.writeCircuit.on('stateChange', ({ from, to, timestamp }) => {
            logger.error('DB Write Circuit Breaker state changed', { from, to, timestamp });
        });

        this.writeCircuit.on('failure', ({ error, failureCount }) => {
            logger.error('DB Write operation failed', { error, failureCount });
        });
    }

    /**
     * Determina si una query es de lectura o escritura
     * @private
     * @param {string} text - Query SQL
     * @returns {boolean} true si es lectura
     */
    _isReadQuery(text) {
        const queryUpper = text.trim().toUpperCase();
        return queryUpper.startsWith('SELECT') ||
            queryUpper.startsWith('WITH') && queryUpper.includes('SELECT');
    }

    /**
     * Ejecuta una query con Circuit Breaker
     * @param {string|Object} textOrConfig - Query SQL o configuración
     * @param {Array} values - Valores parametrizados
     * @returns {Promise<Object>} Resultado de la query
     */
    query(textOrConfig, values) {
        const text = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
        const isRead = this._isReadQuery(text);
        const circuit = isRead ? this.readCircuit : this.writeCircuit;

        return circuit.execute(
            () => this.pool.query(textOrConfig, values),
            null // Sin fallback, dejar que propague el error
        );
    }

    /**
     * Obtiene un client del pool con Circuit Breaker
     * @returns {Promise<Object>} Client de PostgreSQL
     */
    connect() {
        return this.writeCircuit.execute(
            () => this.pool.connect(),
            null
        );
    }

    /**
     * Finaliza el pool
     * @returns {Promise<void>}
     */
    end() {
        return this.pool.end();
    }

    /**
     * Obtiene estadísticas de ambos circuit breakers
     * @returns {Object} Estadísticas
     */
    getStats() {
        return {
            read: this.readCircuit.getStats(),
            write: this.writeCircuit.getStats()
        };
    }

    /**
     * Resetea ambos circuit breakers
     */
    reset() {
        this.readCircuit.reset();
        this.writeCircuit.reset();
    }

    /**
     * Obtiene el estado de salud de la DB basado en los circuit breakers
     * @returns {Object} Estado de salud
     */
    getHealthStatus() {
        const readStats = this.readCircuit.getStats();
        const writeStats = this.writeCircuit.getStats();

        const isHealthy = readStats.state === 'CLOSED' && writeStats.state === 'CLOSED';
        const isDegraded = readStats.state === 'HALF_OPEN' || writeStats.state === 'HALF_OPEN';

        return {
            healthy: isHealthy,
            degraded: isDegraded,
            readCircuit: {
                state: readStats.state,
                errorRate: readStats.errorRate,
                failureCount: readStats.failureCount
            },
            writeCircuit: {
                state: writeStats.state,
                errorRate: writeStats.errorRate,
                failureCount: writeStats.failureCount
            }
        };
    }
}

module.exports = DatabaseCircuitBreaker;
