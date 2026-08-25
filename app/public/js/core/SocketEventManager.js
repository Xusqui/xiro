/**
 * @fileoverview Gestor centralizado de eventos Socket.IO
 * @description Centraliza socket.on/emit con validación automática, logging y manejo de errores
 * @created 2025-02-05
 * @week Semana 19 - Frontend Cleanup
 */

import {
    isValidEvent,
    isDeprecatedEvent,
    requiresAck,
    getEventInfo
} from './socket-events.js?v=20260825083937';

/**
 * Gestor centralizado de eventos Socket.IO
 * Proporciona validación automática, logging y manejo de errores
 */
export class SocketEventManager {
    /**
     * @param {Socket} socket - Instancia de Socket.IO
     * @param {Object} options - Opciones de configuración
     * @param {boolean} options.debug - Habilitar logs de debug
     * @param {boolean} options.strict - Modo estricto (lanza errores en eventos inválidos)
     */
    constructor(socket, options = {}) {
        if (!socket) {
            throw new Error('SocketEventManager: socket es requerido');
        }

        this.socket = socket;
        this.handlers = new Map();
        this.options = {
            debug: options.debug || false,
            strict: options.strict || false,
        };

        // Estadísticas de eventos
        this.stats = {
            emitted: new Map(),
            received: new Map(),
            errors: new Map(),
        };

        this._log('SocketEventManager inicializado', { options: this.options });
    }

    /**
     * Registra un handler para un evento
     * @param {string} event - Nombre del evento
     * @param {Function} handler - Función handler
     * @returns {SocketEventManager} this (para chaining)
     */
    on(event, handler) {
        if (typeof handler !== 'function') {
            throw new Error(`SocketEventManager.on: handler debe ser una función (evento: ${event})`);
        }

        // Validar evento deprecado
        if (isDeprecatedEvent(event)) {
            console.warn(`⚠️ DEPRECADO: El evento "${event}" está deprecado y no debe usarse`);
            if (this.options.strict) {
                throw new Error(`SocketEventManager: No se permite usar evento deprecado: ${event}`);
            }
            return this;
        }

        // Validar evento válido
        if (!isValidEvent(event)) {
            console.error(`❌ INVÁLIDO: El evento "${event}" no es un evento válido del sistema`);
            if (this.options.strict) {
                throw new Error(`SocketEventManager: Evento inválido: ${event}`);
            }
        }

        // Crear wrapper para logging y estadísticas
        const wrappedHandler = (...args) => {
            this._incrementStat('received', event);
            this._log(`📥 Recibido: ${event}`, args[0]);

            try {
                handler(...args);
            } catch (error) {
                this._incrementStat('errors', event);
                console.error(`❌ Error en handler de "${event}":`, error);
                this._handleError(event, error, args[0]);
            }
        };

        // Guardar handler para poder eliminarlo después
        this.handlers.set(event, {
            original: handler,
            wrapped: wrappedHandler,
        });

        // Registrar en Socket.IO
        this.socket.on(event, wrappedHandler);

        this._log(`✅ Handler registrado: ${event}`);
        return this;
    }

    /**
     * Emite un evento con validación
     * @param {string} event - Nombre del evento
     * @param {*} data - Datos a enviar
     * @param {Function} [ack] - Callback de acknowledgment (opcional)
     */
    emit(event, data, ack) {
        // Validar evento deprecado
        if (isDeprecatedEvent(event)) {
            console.warn(`⚠️ DEPRECADO: Intentando emitir evento deprecado "${event}"`);
            if (this.options.strict) {
                throw new Error(`SocketEventManager: No se permite emitir evento deprecado: ${event}`);
            }
            return;
        }

        // Validar evento válido
        if (!isValidEvent(event)) {
            console.error(`❌ INVÁLIDO: Intentando emitir evento inválido "${event}"`);
            if (this.options.strict) {
                throw new Error(`SocketEventManager: Evento inválido: ${event}`);
            }
            return;
        }

        // Verificar si requiere acknowledgment
        const eventInfo = getEventInfo(event);
        if (eventInfo?.requiresAck && !ack) {
            console.warn(`⚠️ El evento "${event}" debería incluir un callback de acknowledgment`);
        }

        this._incrementStat('emitted', event);
        this._log(`📤 Emitiendo: ${event}`, data);

        // Emitir evento
        if (ack) {
            this.socket.emit(event, data, (response) => {
                this._log(`✅ ACK recibido: ${event}`, response);
                ack(response);
            });
        } else {
            this.socket.emit(event, data);
        }
    }

    /**
     * Elimina un handler específico
     * @param {string} event - Nombre del evento
     */
    off(event) {
        const handlerData = this.handlers.get(event);
        if (!handlerData) {
            console.warn(`⚠️ No existe handler para el evento "${event}"`);
            return;
        }

        this.socket.off(event, handlerData.wrapped);
        this.handlers.delete(event);
        this._log(`🗑️ Handler eliminado: ${event}`);
    }

    /**
     * Elimina TODOS los handlers registrados
     */
    removeAllListeners() {
        this._log('🗑️ Eliminando todos los handlers');

        this.handlers.forEach((handlerData, event) => {
            this.socket.off(event, handlerData.wrapped);
        });

        this.handlers.clear();
    }

    /**
     * Obtiene estadísticas de uso de eventos
     * @returns {Object} Estadísticas
     */
    getStats() {
        return {
            emitted: Object.fromEntries(this.stats.emitted),
            received: Object.fromEntries(this.stats.received),
            errors: Object.fromEntries(this.stats.errors),
            totalEmitted: Array.from(this.stats.emitted.values()).reduce((sum, n) => sum + n, 0),
            totalReceived: Array.from(this.stats.received.values()).reduce((sum, n) => sum + n, 0),
            totalErrors: Array.from(this.stats.errors.values()).reduce((sum, n) => sum + n, 0),
        };
    }

    /**
     * Resetea estadísticas
     */
    resetStats() {
        this.stats.emitted.clear();
        this.stats.received.clear();
        this.stats.errors.clear();
        this._log('📊 Estadísticas reseteadas');
    }

    /**
     * Incrementa contador de estadística
     * @private
     */
    _incrementStat(type, event) {
        const map = this.stats[type];
        map.set(event, (map.get(event) || 0) + 1);
    }

    /**
     * Log interno
     * @private
     */
    _log(message, data) {
        if (this.options.debug) {
            if (data !== undefined) {
                console.log(`[SocketEventManager] ${message}`, data);
            } else {
                console.log(`[SocketEventManager] ${message}`);
            }
        }
    }

    /**
     * Manejo de errores personalizable
     * @private
     */
    _handleError(event, error, data) {
        // Hook para manejo de errores customizado
        // Puede ser sobrescrito por el usuario
        if (this.onError) {
            this.onError(event, error, data);
        }
    }
}

export default SocketEventManager;
