/**
 * @fileoverview Clase base para comandos (CQRS pattern)
 * @module application/commands/Command
 * @description
 * Los comandos representan intenciones de cambiar el estado del sistema.
 * Siguen el principio de Command Query Responsibility Segregation (CQRS):
 * - Comandos: MODIFICAN estado (write operations)
 * - Queries: SOLO LEEN estado (read operations)
 */

/**
 * Clase base abstracta para todos los comandos
 * Un comando representa una intención de acción que modifica estado
 * 
 * @abstract
 */
class Command {
    /**
     * @param {Object} payload - Datos del comando
     */
    constructor(payload) {
        if (this.constructor === Command) {
            throw new Error('Command is an abstract class and cannot be instantiated directly');
        }
        this.payload = payload;
        this.timestamp = Date.now();
        this.commandId = `${this.constructor.name}-${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validar el comando antes de ejecutarlo
     * Debe ser implementado por cada comando concreto
     * @abstract
     * @returns {{valid: boolean, errors: string[]}}
     */
    validate() {
        throw new Error('validate() must be implemented by subclass');
    }

    /**
     * Ejecutar el comando
     * Debe ser implementado por cada comando concreto
     * @abstract
     * @returns {Promise<Object>} Resultado de la ejecución
     */
    execute() {
        return Promise.reject(new Error('execute() must be implemented by subclass'));
    }

    /**
     * Serializar comando para logging/debugging
     */
    toJSON() {
        return {
            commandId: this.commandId,
            commandType: this.constructor.name,
            timestamp: this.timestamp,
            payload: this.payload
        };
    }
}

module.exports = Command;
