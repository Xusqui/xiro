/**
 * @fileoverview HeartbeatService - Gestión de heartbeat/ping-pong para mantener conexiones vivas
 * @module domain/services/HeartbeatService
 * 
 * Responsabilidades:
 * - Gestionar ping/pong automático de Socket.io
 * - Detectar conexiones muertas (sin respuesta a ping)
 * - Emitir eventos cuando una conexión se considera muerta
 * - Configurar timeouts personalizados por socket
 */

const EventEmitter = require('events');
const logger = require('../../config/logger');
const { getWorkerContext } = require('../../config/log-context');

class HeartbeatService extends EventEmitter {
    constructor(options = {}) {
        super();

        // Configuración por defecto
        this.pingInterval = options.pingInterval || 25000; // 25s (Socket.io default)
        this.pingTimeout = options.pingTimeout || 60000;   // 60s (Socket.io default)

        // Mapa de sockets monitoreados: socketId -> { lastPing, timeoutId }
        this.monitoredSockets = new Map();

        logger.info('HeartbeatService initialized', {
            ...getWorkerContext(),
            pingInterval: this.pingInterval,
            pingTimeout: this.pingTimeout
        });
    }

    /**
     * Inicia monitoreo de un socket
     * @param {Socket} socket - Socket.io socket instance
     */
    startMonitoring(socket) {
        if (this.monitoredSockets.has(socket.id)) {
            logger.debug('Socket already monitored', { socketId: socket.id });
            return;
        }

        const monitor = {
            lastPing: Date.now(),
            timeoutId: null,
            socketId: socket.id
        };

        this.monitoredSockets.set(socket.id, monitor);

        // Escuchar eventos de Socket.io
        socket.on('ping', () => this._handlePing(socket));
        socket.on('pong', () => this._handlePong(socket));
        socket.on('disconnect', () => this.stopMonitoring(socket.id));

        logger.debug('Monitoring started for socket', { socketId: socket.id });
    }

    /**
     * Detiene monitoreo de un socket
     * @param {string} socketId - ID del socket
     */
    stopMonitoring(socketId) {
        const monitor = this.monitoredSockets.get(socketId);

        if (monitor && monitor.timeoutId) {
            clearTimeout(monitor.timeoutId);
        }

        this.monitoredSockets.delete(socketId);
        logger.debug('Monitoring stopped for socket', { socketId });
    }

    /**
     * Maneja evento 'ping' de Socket.io
     * @private
     */
    _handlePing(socket) {
        const monitor = this.monitoredSockets.get(socket.id);

        if (!monitor) {
            return;
        }

        monitor.lastPing = Date.now();

        // Cancelar timeout anterior si existe
        if (monitor.timeoutId) {
            clearTimeout(monitor.timeoutId);
        }

        // Establecer nuevo timeout para detectar socket muerto
        monitor.timeoutId = setTimeout(() => {
            this._handleTimeout(socket);
        }, this.pingTimeout);
    }

    /**
     * Maneja evento 'pong' de Socket.io (respuesta del cliente)
     * @private
     */
    _handlePong(socket) {
        const monitor = this.monitoredSockets.get(socket.id);

        if (!monitor) {
            return;
        }

        // Cancelar timeout (cliente respondió)
        if (monitor.timeoutId) {
            clearTimeout(monitor.timeoutId);
            monitor.timeoutId = null;
        }

        logger.debug('Pong received', {
            socketId: socket.id,
            latency: Date.now() - monitor.lastPing
        });
    }

    /**
     * Maneja timeout (socket no respondió al ping)
     * @private
     */
    _handleTimeout(socket) {
        logger.warn('Socket timeout - no pong received', {
            socketId: socket.id,
            lastPing: this.monitoredSockets.get(socket.id)?.lastPing
        });

        // Emitir evento para que otros servicios reaccionen
        this.emit('socket-timeout', {
            socketId: socket.id,
            reason: 'ping_timeout'
        });

        // Socket.io se encargará de desconectar automáticamente
        // No hacemos socket.disconnect() aquí para evitar duplicación
    }

    /**
     * Obtiene estadísticas de sockets monitoreados
     * @returns {Object} Estadísticas
     */
    getStats() {
        const stats = {
            totalMonitored: this.monitoredSockets.size,
            socketsWithTimeout: 0,
            avgTimeSinceLastPing: 0
        };

        let totalTime = 0;
        const now = Date.now();

        for (const monitor of this.monitoredSockets.values()) {
            if (monitor.timeoutId) {
                stats.socketsWithTimeout++;
            }
            totalTime += (now - monitor.lastPing);
        }

        if (stats.totalMonitored > 0) {
            stats.avgTimeSinceLastPing = Math.round(totalTime / stats.totalMonitored);
        }

        return stats;
    }

    /**
     * Verifica si un socket está siendo monitoreado
     * @param {string} socketId - ID del socket
     * @returns {boolean}
     */
    isMonitored(socketId) {
        return this.monitoredSockets.has(socketId);
    }

    /**
     * Limpia todos los monitores (para testing/shutdown)
     */
    cleanup() {
        for (const monitor of this.monitoredSockets.values()) {
            if (monitor.timeoutId) {
                clearTimeout(monitor.timeoutId);
            }
        }

        this.monitoredSockets.clear();
        this.removeAllListeners();

        logger.info('HeartbeatService cleaned up');
    }
}

module.exports = HeartbeatService;
