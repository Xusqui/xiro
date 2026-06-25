/**
 * @fileoverview IdempotencyHandler - Handler para validar y cachear requests duplicados
 * @module application/chain/IdempotencyHandler
 * 
 * Funciona en el Chain of Responsibility ANTES de ejecutar el comando.
 * Si el requestId ya fue procesado, retorna resultado cacheado.
 * Si no, continúa la cadena y cachea el resultado.
 */

const Handler = require('./Handler');
const logger = require('../../config/logger');

class IdempotencyHandler extends Handler {
    /**
     * @param {IdempotencyService} idempotencyService - Servicio de idempotencia
     */
    constructor(idempotencyService, contextName = 'unknown') {
        super();

        if (!idempotencyService) {
            throw new Error('IdempotencyHandler requires IdempotencyService');
        }

        this.idempotencyService = idempotencyService;
        this.contextName = contextName;

        logger.debug('IdempotencyHandler initialized', {
            context: this.contextName,
            pid: process.pid
        });
    }

    /**
     * Maneja el request en la cadena
     * @param {Object} context - Contexto de ejecución (debe contener data.requestId)
     * @returns {Promise<Object>} Resultado (cacheado o nuevo)
     */
    async handle(context) {
        const requestId = context?.data?.requestId;
        const logScope = {
            requestId,
            context: this.contextName,
            pid: process.pid
        };

        // Si no hay requestId, continuar sin cache (retrocompatibilidad)
        if (!requestId) {
            logger.debug('No requestId provided, skipping idempotency check', {
                context: this.contextName,
                pid: process.pid
            });
            return super.handle(context);
        }

        // Verificar si ya fue procesado
        const cached = await this.idempotencyService.isProcessed(requestId);

        if (cached) {
            logger.info('Returning cached result for duplicate request', {
                ...logScope,
                cachedAt: cached._cachedAt
            });

            // Marcar en contexto que vino de cache
            context.fromCache = true;
            context.cachedAt = cached._cachedAt;

            return cached;
        }

        // No está en cache: procesar
        logger.debug('Request not in cache, processing', logScope);

        try {
            // Continuar cadena de handlers
            const result = await super.handle(context);

            // Cachear resultado solo si fue exitoso
            if (result && result.success !== false) {
                await this.idempotencyService.markProcessed(requestId, result);

                // Marcar en contexto que fue cacheado
                context.cached = true;
            } else {
                // No cachear errores de lógica de negocio
                logger.debug('Not caching failed result', {
                    ...logScope,
                    reason: result?.reason
                });
            }

            return result;
        } catch (error) {
            // No cachear errores de sistema
            logger.error('Error in IdempotencyHandler', {
                ...logScope,
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = IdempotencyHandler;
