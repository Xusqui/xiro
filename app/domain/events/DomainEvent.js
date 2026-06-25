/**
 * @fileoverview Clase base para eventos de dominio
 * @module domain/events/DomainEvent
 */

/**
 * Clase base para todos los eventos de dominio
 * Garantiza estructura consistente y metadata
 */
class DomainEvent {
    /**
     * @param {string} eventName - Nombre del evento (ej: 'game.started')
     * @param {Object} payload - Datos del evento
     */
    constructor(eventName, payload) {
        this.eventName = eventName;
        this.timestamp = Date.now();
        this.eventId = `${eventName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.payload = payload;

        if (payload && typeof payload === 'object') {
            Object.keys(payload).forEach((key) => {
                if (this[key] === undefined) {
                    this[key] = payload[key];
                }
            });
        }
    }

    /**
     * Serializar evento para logging/debugging
     */
    toJSON() {
        return {
            eventName: this.eventName,
            eventId: this.eventId,
            timestamp: this.timestamp,
            payload: this.payload
        };
    }

    /**
     * Obtener representación string del evento
     */
    toString() {
        return `[${this.eventName}] ${JSON.stringify(this.payload)}`;
    }
}

module.exports = DomainEvent;
