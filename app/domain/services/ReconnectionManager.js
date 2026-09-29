/**
 * @fileoverview ReconnectionManager - Gestión inteligente de reconexiones con exponential backoff
 * @module domain/services/ReconnectionManager
 * 
 * Responsabilidades:
 * - Rastrear intentos de reconexión por jugador
 * - Implementar exponential backoff para evitar spam
 * - Limitar número máximo de intentos
 * - Calcular delays entre intentos
 * - Limpiar datos de reconexión expirados
 */

const logger = require('../../config/logger');
const { getWorkerContext } = require('../../config/log-context');
const runtimeConfig = require('../../config/runtime-config');

class ReconnectionManager {
    constructor(options = {}) {
        // Configuración
        this.maxAttempts = options.maxAttempts || 10;
        this.baseDelay = options.baseDelay || 1000; // 1s inicial
        this.maxDelay = options.maxDelay || 30000;  // 30s máximo
        this.timeoutDuration = options.timeoutDuration || runtimeConfig.get('RECONNECTION_TIMEOUT');

        // Mapa de intentos: playerId -> { attempts, lastAttempt, blockedUntil }
        this.reconnectionAttempts = new Map();

        // Timer para limpieza periódica
        this.cleanupInterval = setInterval(
            () => this._cleanupExpired(),
            60000 // Cada 1 minuto
        ).unref();

        logger.info('ReconnectionManager initialized', {
            ...getWorkerContext(),
            maxAttempts: this.maxAttempts,
            baseDelay: this.baseDelay,
            maxDelay: this.maxDelay
        });
    }

    /**
     * Verifica si un jugador puede intentar reconectar
     * @param {string} playerId - ID del jugador
     * @returns {Object} { allowed: boolean, reason?: string, waitTime?: number }
     */
    canReconnect(playerId) {
        const data = this.reconnectionAttempts.get(playerId);

        // Primera reconexión
        if (!data) {
            return { allowed: true };
        }

        const now = Date.now();

        // PRIMERO: Verificar si superó el máximo de intentos (más crítico)
        if (data.attempts >= this.maxAttempts) {
            return {
                allowed: false,
                reason: 'max_attempts_exceeded',
                message: `Máximo de ${this.maxAttempts} intentos alcanzado. Únete de nuevo al juego.`,
                code: 'RECONNECT_MAX_ATTEMPTS',
                params: { maxAttempts: this.maxAttempts }
            };
        }

        // SEGUNDO: Verificar si está bloqueado temporalmente (rate limiting)
        if (data.blockedUntil && now < data.blockedUntil) {
            const waitTime = data.blockedUntil - now;
            return {
                allowed: false,
                reason: 'rate_limited',
                waitTime,
                message: `Espera ${Math.ceil(waitTime / 1000)}s antes de reintentar`,
                code: 'RECONNECT_RATE_LIMITED',
                params: { waitSeconds: Math.ceil(waitTime / 1000) }
            };
        }

        return { allowed: true };
    }

    /**
     * Registra un intento de reconexión
     * @param {string} playerId - ID del jugador
     * @param {boolean} success - Si la reconexión fue exitosa
     * @returns {Object} Delay sugerido para próximo intento
     */
    recordAttempt(playerId, success = false) {
        const now = Date.now();
        let data = this.reconnectionAttempts.get(playerId);

        if (!data) {
            data = {
                attempts: 0,
                lastAttempt: now,
                blockedUntil: null,
                firstAttempt: now
            };
            this.reconnectionAttempts.set(playerId, data);
        }

        data.attempts++;
        data.lastAttempt = now;

        if (success) {
            // Reconexión exitosa: limpiar datos
            this.reconnectionAttempts.delete(playerId);
            logger.info('Reconnection successful - data cleared', { playerId });
            return { nextDelay: 0 };
        }

        // Calcular delay exponencial para siguiente intento
        const nextDelay = this._calculateDelay(data.attempts);
        data.blockedUntil = now + nextDelay;

        logger.info('Reconnection attempt recorded', {
            playerId,
            attempt: data.attempts,
            maxAttempts: this.maxAttempts,
            nextDelay,
            blockedUntil: new Date(data.blockedUntil).toISOString()
        });

        return {
            attempt: data.attempts,
            maxAttempts: this.maxAttempts,
            nextDelay,
            blockedUntil: data.blockedUntil
        };
    }

    /**
     * Calcula delay con exponential backoff
     * @private
     * @param {number} attempts - Número de intentos
     * @returns {number} Delay en milisegundos
     */
    _calculateDelay(attempts) {
        // Formula: baseDelay * 2^(attempts - 1)
        // Ejemplo: 1s, 2s, 4s, 8s, 16s, 30s (max)
        const exponentialDelay = this.baseDelay * Math.pow(2, attempts - 1);

        // Limitar al máximo
        return Math.min(exponentialDelay, this.maxDelay);
    }

    /**
     * Resetea intentos de un jugador (útil para testing o casos especiales)
     * @param {string} playerId - ID del jugador
     */
    resetAttempts(playerId) {
        this.reconnectionAttempts.delete(playerId);
        logger.info('Reconnection attempts reset', { playerId });
    }

    /**
     * Obtiene información de intentos de un jugador
     * @param {string} playerId - ID del jugador
     * @returns {Object|null}
     */
    getAttemptInfo(playerId) {
        const data = this.reconnectionAttempts.get(playerId);

        if (!data) {
            return null;
        }

        const now = Date.now();
        return {
            attempts: data.attempts,
            maxAttempts: this.maxAttempts,
            lastAttempt: data.lastAttempt,
            isBlocked: data.blockedUntil && now < data.blockedUntil,
            blockedUntil: data.blockedUntil,
            remainingWait: data.blockedUntil ? Math.max(0, data.blockedUntil - now) : 0
        };
    }

    /**
     * Limpia datos expirados (jugadores que no intentaron reconectar en mucho tiempo)
     * @private
     */
    _cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;

        for (const [playerId, data] of this.reconnectionAttempts.entries()) {
            // Eliminar si pasó el timeout global desde el primer intento
            if (now - data.firstAttempt > this.timeoutDuration) {
                this.reconnectionAttempts.delete(playerId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info('Reconnection data cleaned up', {
                cleaned,
                remaining: this.reconnectionAttempts.size
            });
        }
    }

    /**
     * Obtiene estadísticas del manager
     * @returns {Object}
     */
    getStats() {
        const stats = {
            totalTracked: this.reconnectionAttempts.size,
            blocked: 0,
            highAttempts: 0 // jugadores con más de 5 intentos
        };

        const now = Date.now();

        for (const data of this.reconnectionAttempts.values()) {
            if (data.blockedUntil && now < data.blockedUntil) {
                stats.blocked++;
            }
            if (data.attempts > 5) {
                stats.highAttempts++;
            }
        }

        return stats;
    }

    /**
     * Limpieza completa (para shutdown)
     */
    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        this.reconnectionAttempts.clear();
        logger.info('ReconnectionManager cleaned up');
    }
}

module.exports = ReconnectionManager;
