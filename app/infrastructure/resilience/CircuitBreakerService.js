/**
 * @fileoverview Circuit Breaker Pattern Implementation
 * @module infrastructure/resilience/CircuitBreakerService
 * 
 * Implementa el patrón Circuit Breaker para proteger servicios externos:
 * - CLOSED: Funcionamiento normal
 * - OPEN: Circuito abierto (fail fast sin intentar)
 * - HALF_OPEN: Probando si el servicio se recuperó
 * 
 * Estados:
 * CLOSED → (threshold errores) → OPEN → (timeout) → HALF_OPEN → (success) → CLOSED
 *                                                  → (error) → OPEN
 */

const EventEmitter = require('events');

/**
 * Estados posibles del Circuit Breaker
 */
const CircuitState = {
    CLOSED: 'CLOSED',       // Funcionamiento normal
    OPEN: 'OPEN',           // Circuito abierto (fail fast)
    HALF_OPEN: 'HALF_OPEN'  // Probando recuperación
};

/**
 * Opciones de configuración del Circuit Breaker
 * @typedef {Object} CircuitBreakerOptions
 * @property {number} failureThreshold - Número de errores consecutivos antes de abrir (default: 5)
 * @property {number} successThreshold - Número de éxitos en HALF_OPEN para cerrar (default: 2)
 * @property {number} timeout - Tiempo en ms antes de pasar a HALF_OPEN (default: 30000)
 * @property {number} monitoringPeriod - Período de monitoreo de errores en ms (default: 60000)
 * @property {string} name - Nombre del circuit breaker para logging
 */

/**
 * Circuit Breaker para proteger operaciones externas
 */
class CircuitBreakerService extends EventEmitter {
    /**
     * @param {CircuitBreakerOptions} options - Configuración del circuit breaker
     */
    constructor(options = {}) {
        super();

        this.name = options.name || 'unnamed';
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 2;
        this.timeout = options.timeout || 30000; // 30 segundos
        this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minuto

        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttempt = Date.now();

        // Métricas
        this.stats = {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            rejectedCalls: 0,
            stateChanges: {
                [CircuitState.CLOSED]: 0,
                [CircuitState.OPEN]: 0,
                [CircuitState.HALF_OPEN]: 0
            }
        };

        // Historial de llamadas recientes (para calcular error rate)
        this.recentCalls = [];
    }

    /**
     * Ejecuta una función protegida por el circuit breaker
     * @template T
     * @param {Function} fn - Función a ejecutar
     * @param {*} fallback - Valor de fallback si el circuito está abierto
     * @returns {Promise<T>} Resultado de la función o fallback
     */
    async execute(fn, fallback = null) {
        this.stats.totalCalls++;

        // Si el circuito está OPEN, verificar si es momento de probar
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttempt) {
                // Aún no es momento de reintentar, fail fast
                this.stats.rejectedCalls++;
                this.emit('rejected', {
                    name: this.name,
                    state: this.state,
                    nextAttempt: this.nextAttempt
                });

                if (fallback !== null) {
                    return typeof fallback === 'function' ? fallback() : fallback;
                }

                throw new Error(`Circuit breaker '${this.name}' is OPEN`);
            }

            // Pasar a HALF_OPEN para probar
            this._transitionTo(CircuitState.HALF_OPEN);
        }

        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (error) {
            this._onFailure(error);

            if (fallback !== null) {
                return typeof fallback === 'function' ? fallback() : fallback;
            }

            throw error;
        }
    }

    /**
     * Maneja el éxito de una llamada
     * @private
     */
    _onSuccess() {
        this.stats.successfulCalls++;
        this.failureCount = 0;

        this._recordCall(true);

        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;

            if (this.successCount >= this.successThreshold) {
                this._transitionTo(CircuitState.CLOSED);
                this.successCount = 0;
            }
        }

        this.emit('success', { name: this.name, state: this.state });
    }

    /**
     * Maneja el fallo de una llamada
     * @private
     */
    _onFailure(error) {
        this.stats.failedCalls++;
        this.failureCount++;
        this.successCount = 0;

        this._recordCall(false);

        this.emit('failure', {
            name: this.name,
            state: this.state,
            error: error.message,
            failureCount: this.failureCount
        });

        if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
            this._transitionTo(CircuitState.OPEN);
            this.nextAttempt = Date.now() + this.timeout;
        }
    }

    /**
     * Registra una llamada en el historial reciente
     * @private
     * @param {boolean} success - Si la llamada fue exitosa
     */
    _recordCall(success) {
        const now = Date.now();
        this.recentCalls.push({ timestamp: now, success });

        // Limpiar llamadas antiguas fuera del período de monitoreo
        this.recentCalls = this.recentCalls.filter(
            call => now - call.timestamp < this.monitoringPeriod
        );
    }

    /**
     * Transiciona a un nuevo estado
     * @private
     * @param {string} newState - Nuevo estado
     */
    _transitionTo(newState) {
        const oldState = this.state;
        this.state = newState;
        this.stats.stateChanges[newState]++;

        this.emit('stateChange', {
            name: this.name,
            from: oldState,
            to: newState,
            timestamp: Date.now()
        });
    }

    /**
     * Obtiene el estado actual del circuit breaker
     * @returns {string} Estado actual
     */
    getState() {
        return this.state;
    }

    /**
     * Calcula la tasa de errores en el período de monitoreo
     * @returns {number} Error rate (0-1)
     */
    getErrorRate() {
        if (this.recentCalls.length === 0) return 0;

        const failures = this.recentCalls.filter(call => !call.success).length;
        return failures / this.recentCalls.length;
    }

    /**
     * Obtiene estadísticas del circuit breaker
     * @returns {Object} Estadísticas
     */
    getStats() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            errorRate: this.getErrorRate(),
            nextAttempt: this.state === CircuitState.OPEN ? this.nextAttempt : null,
            ...this.stats
        };
    }

    /**
     * Reinicia el circuit breaker a su estado inicial
     */
    reset() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttempt = Date.now();
        this.recentCalls = [];

        this.emit('reset', { name: this.name });
    }

    /**
     * Fuerza el circuito a estado OPEN (útil para mantenimiento)
     */
    forceOpen() {
        this._transitionTo(CircuitState.OPEN);
        this.nextAttempt = Date.now() + this.timeout;
    }

    /**
     * Fuerza el circuito a estado CLOSED (útil para recuperación manual)
     */
    forceClosed() {
        this._transitionTo(CircuitState.CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
    }
}

module.exports = { CircuitBreakerService, CircuitState };
