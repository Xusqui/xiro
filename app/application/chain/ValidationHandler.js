/**
 * @fileoverview Validation Handler - Valida datos de entrada
 * @module application/chain/ValidationHandler
 */

const Handler = require('./Handler');
const logger = require('../../config/logger');

class ValidationHandler extends Handler {
    /**
     * @param {Function} validateFn - Función de validación que recibe data/context y retorna {valid, value, error}
     * @param {Object} options - Opciones adicionales
     * @param {boolean} options.passFullContext - Si true, pasa context completo a validateFn, si false solo context.data
     * @param {boolean} options.requireSocket - Si true, valida que context.socket exista
     * @param {boolean} options.requireData - Si true, valida que context.data exista
     * @param {boolean} options.requirePlayerId - Si true, valida que context.playerId exista
     */
    constructor(validateFn, options = {}) {
        super();
        this.validateFn = validateFn;
        this.options = {
            passFullContext: options.passFullContext === true, // Default false (pasar solo data)
            requireSocket: options.requireSocket !== false, // Default true
            requireData: options.requireData !== false, // Default true  
            requirePlayerId: options.requirePlayerId !== false // Default true
        };
    }

    _validateRequiredContext(context) {
        if (this.options.requireSocket && !context?.socket) {
            return 'Socket is required';
        }

        if (this.options.requireData && !context?.data) {
            return 'Data is required';
        }

        if (this.options.requirePlayerId && !context?.playerId) {
            return 'PlayerId is required';
        }

        return null;
    }

    handle(context) {
        const missingRequirement = this._validateRequiredContext(context);
        if (missingRequirement) {
            return {
                success: false,
                reason: 'validation-failed',
                errors: [missingRequirement],
                error: missingRequirement
            };
        }

        // Decidir qué pasar a la función de validación
        const dataToValidate = this.options.passFullContext ? context : (context.data || context);

        // Validar los datos específicos usando la función de validación
        let validation;
        try {
            validation = this.validateFn(dataToValidate);
        } catch (err) {
            logger.error('ValidationHandler: validateFn threw an exception', {
                error: err.message,
                stack: err.stack
            });
            return {
                success: false,
                reason: 'validation-error',
                errors: ['Internal validation error'],
                error: 'Internal validation error',
                code: 'INTERNAL_VALIDATION_ERROR'
            };
        }

        logger.debug('ValidationHandler result', {
            valid: validation.valid,
            errors: validation.errors,
            answerType: dataToValidate?.answerType,
            hasSelectedIndices: Array.isArray(dataToValidate?.selectedIndices)
        });

        if (!validation.valid) {
            logger.warn('Validation failed', {
                errors: validation.errors || [validation.error],
                answerType: dataToValidate?.answerType,
                data: dataToValidate
            });
            return {
                success: false,
                reason: 'validation-failed',
                errors: validation.errors || [validation.error],
                error: (validation.errors || [validation.error]).join(', ')
            };
        }

        // Añadir datos validados al contexto
        context.validatedData = validation.value || context.data || context;

        return super.handle(context);
    }
}

module.exports = ValidationHandler;
