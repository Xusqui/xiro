/**
 * @fileoverview Clase base para queries (CQRS pattern)
 * @module application/queries/Query
 * @description
 * Las queries representan peticiones de lectura de estado del sistema.
 * Siguen el principio CQRS:
 * - NO modifican estado (read-only)
 * - Pueden hacer caching
 * - Pueden optimizar estructuras de datos para lectura
 */

/**
 * Clase base abstracta para todas las queries
 * Una query representa una petición de datos SIN modificar estado
 * 
 * @abstract
 */
class Query {
    /**
     * @param {Object} params - Parámetros de la query
     */
    constructor(params) {
        if (this.constructor === Query) {
            throw new Error('Query is an abstract class and cannot be instantiated directly');
        }
        this.params = params;
        this.timestamp = Date.now();
        this.queryId = `${this.constructor.name}-${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validar parámetros de la query
     * @abstract
     * @returns {{valid: boolean, errors: string[]}}
     */
    validate() {
        throw new Error('validate() must be implemented by subclass');
    }

    /**
     * Ejecutar la query (solo lectura)
     * @abstract
     * @returns {Promise<Object>} Datos solicitados
     */
    execute() {
        return Promise.reject(new Error('execute() must be implemented by subclass'));
    }

    /**
     * Serializar query para logging/debugging
     */
    toJSON() {
        return {
            queryId: this.queryId,
            queryType: this.constructor.name,
            timestamp: this.timestamp,
            params: this.params
        };
    }
}

module.exports = Query;
