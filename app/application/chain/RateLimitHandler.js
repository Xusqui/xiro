/**
 * @fileoverview Rate Limit Handler - Previene spam
 * @module application/chain/RateLimitHandler
 */

const Handler = require('./Handler');
const logger = require('../../config/logger');

class RateLimitHandler extends Handler {
    /**
     * @param {Object} rateLimiter - Instancia del rate limiter
     * @param {string} operation - Nombre de la operación
     */
    constructor(rateLimiter, operation) {
        super();
        this.rateLimiter = rateLimiter;
        this.operation = operation;
    }

    async handle(context) {
        const { socket } = context;

        // Si no hay socket, saltar rate limiting (será validado en ValidationHandler)
        if (!socket || !socket.id) {
            return super.handle(context);
        }

        let isAllowed;
        try {
            isAllowed = await Promise.resolve(
                this.rateLimiter.checkLimit(socket.id, this.operation)
            );
        } catch (err) {
            logger.error('RateLimitHandler: checkLimit threw an exception', {
                socketId: socket.id,
                operation: this.operation,
                error: err.message
            });
            return { success: false, reason: 'rate-limit-error' };
        }

        logger.debug('RateLimitHandler check', {
            socketId: socket.id,
            operation: this.operation,
            isAllowed
        });

        if (!isAllowed) {
            logger.warn('Rate limit exceeded', {
                socketId: socket.id,
                operation: this.operation
            });
            return {
                success: false,
                reason: 'rate-limit-exceeded',
                message: 'Demasiadas peticiones. Espera un momento.',
                code: 'RATE_LIMIT_EXCEEDED'
            };
        }

        return super.handle(context);
    }
}

module.exports = RateLimitHandler;
