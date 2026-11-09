/**
 * @fileoverview Funciones de validación y middlewares Express/Socket.IO sobre los esquemas Joi.
 * Reexportado desde validation/index.js.
 */

// ===== FUNCIONES DE VALIDACIÓN =====

/**
 * Valida datos contra un esquema Joi
 * @param {Object} schema - Esquema Joi
 * @param {Object} data - Datos a validar
 * @returns {{ value: Object, error: string|null }}
 */
function validate(schema, data) {
    const { value, error } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const messages = error.details.map(d => d.message).join('. ');
        return { value: null, error: messages };
    }

    return { value, error: null };
}

const SENSITIVE_LOG_KEY_PATTERN = /(password|token|secret|authorization|cookie|smtp|jwt|api[_-]?key|passphrase)/i;

/**
 * Copia un valor para los logs ocultando, de forma recursiva, los campos con nombre sensible.
 * @param {*} value - Valor
 * @param {string} [key=''] - Nombre del campo
 * @returns {*} Valor saneado; '[REDACTED]' en campos sensibles
 */
function sanitizeForLogs(value, key = '') {
    if (SENSITIVE_LOG_KEY_PATTERN.test(String(key))) {
        return '[REDACTED]';
    }

    if (value === null || value === undefined) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(item => sanitizeForLogs(item, key));
    }

    if (typeof value === 'object') {
        const sanitized = {};
        for (const [entryKey, entryValue] of Object.entries(value)) {
            sanitized[entryKey] = sanitizeForLogs(entryValue, entryKey);
        }
        return sanitized;
    }

    return value;
}

/**
 * Middleware Express para validar body
 * @param {Object} schema - Esquema Joi
 */
function validateBody(schema) {
    return (req, res, next) => {
        const { value, error } = validate(schema, req.body);
        if (error) {
            const logger = require('../config/logger');
            logger.warn('Validation error in request body', {
                endpoint: req.path,
                method: req.method,
                error: error,
                body: sanitizeForLogs(req.body)
            });
            return res.status(400).json({
                error: 'Datos inválidos',
                message: error,
                details: error.split('. ') // Desglosar los errores for debugging
            });
        }
        req.body = value; // Usar datos sanitizados
        next();
    };
}

/**
 * Middleware Express para validar query params
 * @param {Object} schema - Esquema Joi
 */
function validateQuery(schema) {
    return (req, res, next) => {
        const { value, error } = validate(schema, req.query);
        if (error) {
            return res.status(400).json({
                error: 'Parámetros inválidos',
                message: error
            });
        }
        req.query = value;
        next();
    };
}

/**
 * Middleware Express para validar params de URL
 * @param {Object} schema - Esquema Joi
 */
function validateParams(schema) {
    return (req, res, next) => {
        const { value, error } = validate(schema, req.params);
        if (error) {
            return res.status(400).json({
                error: 'Parámetros de URL inválidos',
                message: error
            });
        }
        req.params = value;
        next();
    };
}

/**
 * Valida datos de WebSocket y retorna resultado
 * @param {Object} schema - Esquema Joi
 * @param {Object} data - Datos del evento
 * @returns {{ valid: boolean, value: Object|null, error: string|null }}
 */
function validateSocket(schema, data) {
    const { value, error } = validate(schema, data);
    return {
        valid: !error,
        value,
        error
    };
}

module.exports = { validate, sanitizeForLogs, validateBody, validateQuery, validateParams, validateSocket };
