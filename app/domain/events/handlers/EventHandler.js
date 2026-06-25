const fallbackLogger = require('../../../config/logger');

/**
 * @fileoverview Base class para Event Handlers
 * @module domain/events/handlers/EventHandler
 * 
 * Event Handlers escuchan eventos del EventBus y ejecutan side effects.
 * Esto desacopla la lógica de negocio (Commands/Services) de los efectos secundarios
 * (socket broadcasts, persistencia, logging, etc.)
 */

class EventHandler {
    /**
     * @param {EventBus} eventBus - Instancia del EventBus
     * @param {Object} io - Socket.IO server instance
     * @param {Object} dependencies - Dependencias adicionales (DB, cache, etc.)
     */
    constructor(eventBus, io, dependencies = {}) {
        this.eventBus = eventBus;
        this.io = io;
        this.dependencies = dependencies;
        this.subscriptions = [];
    }

    /**
     * Registra todos los listeners del handler
     * Debe ser implementado por clases hijas
     */
    register() {
        throw new Error('register() must be implemented by subclass');
    }

    /**
     * Desregistra todos los listeners (cleanup)
     */
    unregister() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];
    }

    /**
     * Helper para suscribirse a un evento y trackear la suscripción
     * @param {string} eventName - Nombre del evento
     * @param {Function} handler - Función handler
     * @param {number} priority - Prioridad (0-10, default 5)
     */
    subscribe(eventName, handler, priority = 5) {
        const unsubscribe = this.eventBus.on(eventName, handler, priority);
        this.subscriptions.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Helper para logging consistente
     */
    log(level, message, data = {}) {
        const logData = {
            handler: this.constructor.name,
            ...data
        };

        if (this.dependencies.logger && typeof this.dependencies.logger[level] === 'function') {
            this.dependencies.logger[level](message, logData);
            return;
        }

        if (fallbackLogger && typeof fallbackLogger[level] === 'function') {
            fallbackLogger[level](message, logData);
            return;
        }

        process.stderr.write(`[${level.toUpperCase()}] ${message} ${JSON.stringify(logData)}\n`);
    }
}

module.exports = EventHandler;
