/**
 * @fileoverview Gestor centralizado de timers
 * Previene memory leaks y asegura limpieza automática de setTimeout/setInterval
 */

const logger = require('../config/logger');

class TimerManager {
    constructor() {
        // Map: timerId → { handle, type, createdAt, roomId }
        this.timers = new Map();
        this.nextId = 1;
    }

    /**
     * Crea un setTimeout con tracking automático
     * @param {Function} callback - Función a ejecutar
     * @param {number} delay - Delay en milisegundos
     * @param {string} type - Tipo de timer ('game-countdown', 'cleanup', 'animation')
     * @param {string} roomId - ID del room/juego asociado (opcional)
     * @returns {number} Timer ID único
     */
    setTimeout(callback, delay, type = 'unknown', roomId = null) {
        const timerId = this.nextId++;

        const wrappedCallback = () => {
            try {
                callback();
            } finally {
                // Auto-limpieza después de ejecutar
                this.timers.delete(timerId);
            }
        };

        const handle = setTimeout(wrappedCallback, delay);

        this.timers.set(timerId, {
            handle,
            type,
            roomId,
            createdAt: Date.now(),
            isInterval: false
        });

        logger.debug('Timer created', { timerId, type, roomId, delay });
        return timerId;
    }

    /**
     * Crea un setInterval con tracking automático
     * @param {Function} callback - Función a ejecutar
     * @param {number} interval - Intervalo en milisegundos
     * @param {string} type - Tipo de timer ('cleanup', 'heartbeat')
     * @param {string} roomId - ID del room/juego asociado (opcional)
     * @returns {number} Timer ID único
     */
    setInterval(callback, interval, type = 'unknown', roomId = null) {
        const timerId = this.nextId++;

        const handle = setInterval(() => {
            try {
                callback();
            } catch (error) {
                logger.error('Interval callback error', { timerId, type, error: error.message });
            }
        }, interval);

        this.timers.set(timerId, {
            handle,
            type,
            roomId,
            createdAt: Date.now(),
            isInterval: true
        });

        logger.debug('Interval created', { timerId, type, roomId, interval });
        return timerId;
    }

    /**
     * Limpia un timer específico
     * @param {number} timerId - ID del timer
     * @returns {boolean} True si se limpió correctamente
     */
    clear(timerId) {
        const timer = this.timers.get(timerId);
        if (!timer) {
            return false;
        }

        if (timer.isInterval) {
            clearInterval(timer.handle);
        } else {
            clearTimeout(timer.handle);
        }

        this.timers.delete(timerId);
        logger.debug('Timer cleared', { timerId, type: timer.type, roomId: timer.roomId });
        return true;
    }

    /**
     * Limpia todos los timers de un room específico
     * @param {string} roomId - ID del room
     * @returns {number} Cantidad de timers eliminados
     */
    clearByRoom(roomId) {
        let cleared = 0;

        for (const [timerId, timer] of this.timers.entries()) {
            if (timer.roomId === roomId) {
                this.clear(timerId);
                cleared++;
            }
        }

        if (cleared > 0) {
            logger.info('Timers cleared by room', { roomId, count: cleared });
        }
        return cleared;
    }

    /**
     * Limpia todos los timers de un tipo específico
     * @param {string} type - Tipo de timer
     * @returns {number} Cantidad de timers eliminados
     */
    clearByType(type) {
        let cleared = 0;

        for (const [timerId, timer] of this.timers.entries()) {
            if (timer.type === type) {
                this.clear(timerId);
                cleared++;
            }
        }

        if (cleared > 0) {
            logger.info('Timers cleared by type', { type, count: cleared });
        }
        return cleared;
    }

    /**
     * Limpia TODOS los timers (para graceful shutdown)
     * @returns {number} Cantidad de timers eliminados
     */
    clearAll() {
        const count = this.timers.size;

        for (const [, timer] of this.timers.entries()) {
            if (timer.isInterval) {
                clearInterval(timer.handle);
            } else {
                clearTimeout(timer.handle);
            }
        }

        this.timers.clear();

        if (count > 0) {
            logger.warn('All timers cleared', { count });
        }
        return count;
    }

    /**
     * Obtiene estadísticas de timers activos
     * @returns {Object} Estadísticas por tipo y total
     */
    getStats() {
        const stats = {
            activeTimers: this.timers.size,
            total: this.timers.size,
            byType: {},
            byRoom: {},
            oldest: null,
            intervals: 0,
            timeouts: 0
        };

        let oldestTimestamp = Date.now();

        for (const [timerId, timer] of this.timers.entries()) {
            // Contar por tipo
            stats.byType[timer.type] = (stats.byType[timer.type] || 0) + 1;

            // Contar por room
            if (timer.roomId) {
                stats.byRoom[timer.roomId] = (stats.byRoom[timer.roomId] || 0) + 1;
            }

            // Contar intervals vs timeouts
            if (timer.isInterval) {
                stats.intervals++;
            } else {
                stats.timeouts++;
            }

            // Encontrar el más antiguo
            if (timer.createdAt < oldestTimestamp) {
                oldestTimestamp = timer.createdAt;
                stats.oldest = {
                    timerId,
                    type: timer.type,
                    roomId: timer.roomId,
                    ageSeconds: Math.floor((Date.now() - timer.createdAt) / 1000)
                };
            }
        }

        return stats;
    }

    /**
     * Detecta timers huérfanos (más de 1 hora de vida)
     * Solo detecta timers con roomId (excluye timers globales del sistema)
     * @returns {Array} Lista de timers sospechosos
     */
    detectOrphans() {
        const ORPHAN_THRESHOLD = 60 * 60 * 1000; // 1 hora
        const now = Date.now();
        const orphans = [];

        for (const [timerId, timer] of this.timers.entries()) {
            const age = now - timer.createdAt;
            // Solo detectar huérfanos en timers con roomId (excluye globales del sistema)
            if (age > ORPHAN_THRESHOLD && timer.roomId) {
                orphans.push({
                    timerId,
                    type: timer.type,
                    roomId: timer.roomId,
                    ageMinutes: Math.floor(age / 60000)
                });
            }
        }

        if (orphans.length > 0) {
            logger.warn('Orphan timers detected', { count: orphans.length, orphans });
        }

        return orphans;
    }
}

// Exportar instancia singleton
const timerManager = new TimerManager();

module.exports = timerManager;
