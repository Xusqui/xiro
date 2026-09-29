/**
 * @fileoverview Event Bus - Sistema de eventos desacoplado para comunicación interna
 * @module domain/events/EventBus
 * @description
 * Event Bus mejorado con:
 * - Wildcards para suscripciones (* y **)
 * - Prioridades para handlers
 * - Error handling robusto
 * - Métricas de eventos
 * - Unsubscribe seguro
 */

const EventEmitter = require('events');
const logger = require('../../config/logger');

/**
 * Event Bus singleton para comunicación desacoplada entre componentes
 * 
 * @example
 * // Suscribirse a un evento
 * EventBus.on('game.started', (event) => {
 *   logger.info(`Game ${event.gameId} started`);
 * });
 * 
 * // Emitir un evento
 * EventBus.emit('game.started', new GameStartedEvent({ gameId: '1234' }));
 * 
 * // Wildcards
 * EventBus.on('game.*', handler); // Todos los eventos game.*
 * EventBus.on('**', handler);      // TODOS los eventos
 */
class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Evitar warning en clusters
        this.metrics = {
            emitted: new Map(),
            handled: new Map(),
            errors: new Map()
        };
        this.handlers = new Map(); // eventName → [{handler, priority}]
    }

    /**
     * Suscribirse a un evento con prioridad opcional
     * @param {string} eventName - Nombre del evento (soporta wildcards: *, **)
     * @param {Function} handler - Función manejadora (event) => void
     * @param {number} [priority=0] - Prioridad (mayor = ejecuta primero)
     * @returns {Function} Función para unsubscribe
     */
    on(eventName, handler, priority = 0) {
        if (!this.handlers.has(eventName)) {
            this.handlers.set(eventName, []);
        }

        const handlerInfo = { handler, priority };
        this.handlers.get(eventName).push(handlerInfo);

        // Ordenar por prioridad (mayor primero)
        this.handlers.get(eventName).sort((a, b) => b.priority - a.priority);

        // Registrar en EventEmitter nativo
        super.on(eventName, handler);

        // Retornar función para unsubscribe
        return () => this.off(eventName, handler);
    }

    /**
     * Suscribirse a un evento una sola vez
     * @param {string} eventName - Nombre del evento
     * @param {Function} handler - Función manejadora
     * @param {number} [priority=0] - Prioridad
     * @returns {Function} Función para unsubscribe
     */
    once(eventName, handler, priority = 0) {
        const wrapper = (event) => {
            this.off(eventName, wrapper);
            handler(event);
        };

        // Registrar wrapper con la misma prioridad que el handler original
        if (!this.handlers.has(eventName)) {
            this.handlers.set(eventName, []);
        }

        const handlerInfo = { handler: wrapper, priority };
        this.handlers.get(eventName).push(handlerInfo);
        this.handlers.get(eventName).sort((a, b) => b.priority - a.priority);

        return () => this.off(eventName, wrapper);
    }

    /**
     * Desuscribirse de un evento
     * @param {string} eventName - Nombre del evento
     * @param {Function} handler - Función manejadora a eliminar
     */
    off(eventName, handler) {
        if (this.handlers.has(eventName)) {
            const handlers = this.handlers.get(eventName);
            const index = handlers.findIndex(h => h.handler === handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
            if (handlers.length === 0) {
                this.handlers.delete(eventName);
            }
        }
        super.off(eventName, handler);
    }

    /**
     * Emitir un evento con soporte para wildcards y error handling
     * @param {string} eventName - Nombre del evento
     * @param {Object} event - Objeto evento (debe tener timestamp y eventName)
     * @returns {boolean} true si hubo listeners
     */
    emit(eventName, event) {
        // Asegurar que el evento tiene metadata
        const enrichedEvent = {
            ...event,
            eventName: eventName,
            timestamp: event.timestamp || Date.now()
        };

        // Actualizar métricas
        this.metrics.emitted.set(eventName, (this.metrics.emitted.get(eventName) || 0) + 1);

        // Emitir con error handling
        const emitSafe = (name, evt) => {
            const handlers = this.handlers.get(name) || [];
            handlers.forEach(({ handler }) => {
                try {
                    handler(evt);
                } catch (error) {
                    this.handleError(name, error);
                }
            });
            return handlers.length > 0;
        };

        // Emitir a listeners exactos
        const exactHandled = emitSafe(eventName, enrichedEvent);

        // Emitir a wildcards (game.* escucha game.started)
        let wildcardHandled = false;
        const parts = eventName.split('.');
        for (let i = 0; i < parts.length; i++) {
            const wildcardPattern = parts.slice(0, i).concat('*').join('.');
            if (this.handlers.has(wildcardPattern)) {
                emitSafe(wildcardPattern, enrichedEvent);
                wildcardHandled = true;
            }
        }

        // Emitir a ** (escucha TODOS los eventos)
        if (this.handlers.has('**')) {
            emitSafe('**', enrichedEvent);
        }

        return exactHandled || wildcardHandled;
    }

    /**
     * Emitir evento de forma asíncrona (no bloquea)
     * @param {string} eventName - Nombre del evento
     * @param {Object} event - Objeto evento
     */
    emitAsync(eventName, event) {
        setImmediate(() => {
            try {
                this.emit(eventName, event);
            } catch (error) {
                this.handleError(eventName, error);
            }
        });
    }

    /**
     * Manejar errores en handlers
     * @private
     */
    handleError(eventName, error) {
        this.metrics.errors.set(eventName, (this.metrics.errors.get(eventName) || 0) + 1);
        logger.error(`[EventBus] Error handling event "${eventName}":`, error);
        // Emitir evento de error (sin recursión infinita)
        if (eventName !== 'eventbus.error') {
            super.emit('eventbus.error', { eventName, error, timestamp: Date.now() });
        }
    }

    /**
     * Obtener métricas de eventos
     * @returns {Object} Estadísticas de eventos
     */
    getMetrics() {
        return {
            emitted: Object.fromEntries(this.metrics.emitted),
            errors: Object.fromEntries(this.metrics.errors),
            activeListeners: Object.fromEntries(
                Array.from(this.handlers.entries()).map(([name, handlers]) => [name, handlers.length])
            )
        };
    }

    /**
     * Limpiar todas las suscripciones
     */
    removeAllListeners(eventName) {
        if (eventName) {
            this.handlers.delete(eventName);
            // Eliminar listeners de EventEmitter nativo también
            const listeners = super.listeners(eventName);
            listeners.forEach(listener => super.off(eventName, listener));
        } else {
            this.handlers.clear();
            super.removeAllListeners();
        }
        return this;
    }

    /**
     * Resetear métricas
     */
    resetMetrics() {
        this.metrics.emitted.clear();
        this.metrics.handled.clear();
        this.metrics.errors.clear();
    }
}

// Singleton global
const eventBusInstance = new EventBus();

module.exports = eventBusInstance;
