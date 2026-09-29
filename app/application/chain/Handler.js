/**
 * @fileoverview Base Handler para Chain of Responsibility pattern
 * @module application/chain/Handler
 * 
 * Permite crear pipelines de procesamiento modulares donde cada handler
 * puede procesar la request y decidir si pasa al siguiente handler.
 */

const logger = require('../../config/logger');

class Handler {
    constructor() {
        this.nextHandler = null;
    }

    /**
     * Establecer el siguiente handler en la cadena
     * @param {Handler} handler - Siguiente handler
     * @returns {Handler} El handler pasado (para encadenamiento)
     */
    setNext(handler) {
        this.nextHandler = handler;
        return handler;
    }

    /**
     * Procesar la request
     * Debe ser implementado por subclases
     * @param {Object} context - Contexto de la request
     * @returns {Promise<Object>} Resultado del procesamiento
     */
    async handle(context) {
        if (this.nextHandler) {
            const result = await this.nextHandler.handle(context);
            if (result === undefined || result === null) {
                logger.error('Handler returned undefined/null', { handler: this.nextHandler.constructor.name });
                return { success: false, reason: 'internal-error' };
            }
            return result;
        }
        return { success: true };
    }
}

module.exports = Handler;
