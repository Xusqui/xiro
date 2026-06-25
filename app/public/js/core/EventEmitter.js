/**
 * @fileoverview Event Emitter simple (patrón Observer)
 * @description Sistema de eventos interno para comunicación entre módulos
 * @created 2025-02-05
 * @week Semana 19 - Frontend Cleanup
 */

/**
 * Event Emitter básico (patrón Observer)
 * Permite comunicación desacoplada entre módulos
 */
export class EventEmitter {
    constructor() {
        this._events = new Map();
    }

    /**
     * Registra un listener para un evento
     * @param {string} event - Nombre del evento
     * @param {Function} listener - Función listener
     * @returns {EventEmitter} this (para chaining)
     */
    on(event, listener) {
        if (typeof listener !== 'function') {
            throw new Error('EventEmitter.on: listener debe ser una función');
        }

        if (!this._events.has(event)) {
            this._events.set(event, []);
        }

        this._events.get(event).push(listener);
        return this;
    }

    /**
     * Registra un listener que se ejecuta solo una vez
     * @param {string} event - Nombre del evento
     * @param {Function} listener - Función listener
     * @returns {EventEmitter} this (para chaining)
     */
    once(event, listener) {
        const onceWrapper = (...args) => {
            listener(...args);
            this.off(event, onceWrapper);
        };

        return this.on(event, onceWrapper);
    }

    /**
     * Emite un evento
     * @param {string} event - Nombre del evento
     * @param {...*} args - Argumentos a pasar a los listeners
     * @returns {boolean} true si había listeners
     */
    emit(event, ...args) {
        const listeners = this._events.get(event);

        if (!listeners || listeners.length === 0) {
            return false;
        }

        listeners.forEach(listener => {
            try {
                listener(...args);
            } catch (error) {
                console.error(`Error en listener de evento "${event}":`, error);
            }
        });

        return true;
    }

    /**
     * Elimina un listener específico
     * @param {string} event - Nombre del evento
     * @param {Function} listener - Función listener a eliminar
     */
    off(event, listener) {
        const listeners = this._events.get(event);

        if (!listeners) {
            return;
        }

        const index = listeners.indexOf(listener);
        if (index !== -1) {
            listeners.splice(index, 1);
        }

        // Limpiar array vacío
        if (listeners.length === 0) {
            this._events.delete(event);
        }
    }

    /**
     * Elimina TODOS los listeners de un evento (o todos si no se especifica)
     * @param {string} [event] - Nombre del evento (opcional)
     */
    removeAllListeners(event) {
        if (event) {
            this._events.delete(event);
        } else {
            this._events.clear();
        }
    }

    /**
     * Obtiene el número de listeners de un evento
     * @param {string} event - Nombre del evento
     * @returns {number} Número de listeners
     */
    listenerCount(event) {
        const listeners = this._events.get(event);
        return listeners ? listeners.length : 0;
    }

    /**
     * Obtiene todos los nombres de eventos registrados
     * @returns {string[]} Array de nombres de eventos
     */
    eventNames() {
        return Array.from(this._events.keys());
    }

    /**
     * Obtiene los listeners de un evento
     * @param {string} event - Nombre del evento
     * @returns {Function[]} Array de listeners
     */
    listeners(event) {
        const listeners = this._events.get(event);
        return listeners ? [...listeners] : [];
    }
}

export default EventEmitter;
