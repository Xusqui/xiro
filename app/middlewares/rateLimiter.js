/**
 * @fileoverview Rate Limiter para Socket.IO
 * Protege contra spam de acciones por socket (DoS local)
 * Usa sliding window para limitar acciones por segundo
 */

const logger = require('../config/logger');

/**
 * Rate limiter usando sliding window
 * Permite X acciones en Y segundos por socket
 */
class SocketRateLimiter {
    constructor() {
        // Map<socketId, Map<action, timestamps[]>>
        this.actionLog = new Map();

        // Configuración por tipo de acción
        this.limits = {
            'submit-answer': { max: 2, window: 1000 },      // 2 respuestas por segundo
            'join-lobby': { max: 3, window: 5000 },         // 3 joins en 5 segundos
            'leave-game': { max: 5, window: 10000 },        // 5 leaves en 10 segundos
            'next-question': { max: 10, window: 5000 },     // 10 next en 5 segundos (presentador)
            'select-team': { max: 5, window: 3000 },        // 5 cambios de equipo en 3s
            'manual-points': { max: 20, window: 10000 },    // 20 asignaciones en 10s
            'default': { max: 20, window: 1000 }            // 20 acciones/segundo por defecto
        };

        // Cleanup cada 5 minutos sin mantener vivo el event loop
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    /**
     * Verifica si una acción está permitida
     * @param {string} socketId - ID del socket
     * @param {string} action - Nombre de la acción
     * @returns {boolean} - true si está permitido, false si excede límite
     */
    checkLimit(socketId, action) {
        const now = Date.now();
        const limit = this.limits[action] || this.limits['default'];

        // Inicializar estructuras si no existen
        if (!this.actionLog.has(socketId)) {
            this.actionLog.set(socketId, new Map());
        }

        const socketActions = this.actionLog.get(socketId);
        if (!socketActions.has(action)) {
            socketActions.set(action, []);
        }

        const timestamps = socketActions.get(action);

        // Filtrar timestamps fuera de la ventana
        const validTimestamps = timestamps.filter(ts => now - ts < limit.window);

        // Verificar si excede el límite
        if (validTimestamps.length >= limit.max) {
            logger.warn('Rate limit exceeded', {
                socketId,
                action,
                count: validTimestamps.length,
                limit: limit.max,
                window: limit.window
            });
            return false;
        }

        // Agregar timestamp actual
        validTimestamps.push(now);
        socketActions.set(action, validTimestamps);

        return true;
    }

    /**
     * Limpia el log de un socket específico
     * @param {string} socketId - ID del socket
     */
    clearSocket(socketId) {
        this.actionLog.delete(socketId);
    }

    /**
     * Limpieza periódica de sockets inactivos
     */
    cleanup() {
        const now = Date.now();
        const maxInactivity = 30 * 60 * 1000; // 30 minutos

        let cleaned = 0;
        for (const [socketId, socketActions] of this.actionLog.entries()) {
            let hasRecentActivity = false;

            for (const timestamps of socketActions.values()) {
                if (timestamps.length > 0 && now - timestamps[timestamps.length - 1] < maxInactivity) {
                    hasRecentActivity = true;
                    break;
                }
            }

            if (!hasRecentActivity) {
                this.actionLog.delete(socketId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug('Rate limiter cleanup', { socketsRemoved: cleaned });
        }
    }

    /**
     * Obtiene estadísticas actuales
     * @returns {Object} - Estadísticas del rate limiter
     */
    getStats() {
        return {
            trackedSockets: this.actionLog.size,
            limits: this.limits
        };
    }
}

// Instancia singleton
const rateLimiter = new SocketRateLimiter();

/**
 * Middleware de rate limiting para Socket.IO
 * @param {string} action - Nombre de la acción a proteger
 * @returns {Function} - Middleware function
 */
function createRateLimitMiddleware(action) {
    return (socket, next) => {
        if (!rateLimiter.checkLimit(socket.id, action)) {
            const error = new Error('Rate limit exceeded');
            error.data = { action, retry: true };
            return next(error);
        }
        next();
    };
}

module.exports = {
    rateLimiter,
    createRateLimitMiddleware
};
