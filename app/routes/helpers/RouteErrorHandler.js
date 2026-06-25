/**
 * @fileoverview Helper consolidado para manejo de errores en rutas
 * Elimina duplicación en game.routes.js
 */

const logger = require('../../config/logger');

/**
 * Maneja errores de ruta devolviendo JSON apropiado.
 * Los errores 5xx devuelven un mensaje genérico para evitar fugas de información.
 * @param {Error} err - Error capturado
 * @param {Object} res - Response object
 * @param {number} [statusCode=null] - Código de estado HTTP
 */
function handleRouteError(err, res, statusCode = null) {
    const resolvedStatus = statusCode || err?.status || 500;
    const isServerError = resolvedStatus >= 500;

    if (isServerError) {
        logger.error('Route error', { error: err.message, stack: err.stack });
    }

    const message = isServerError
        ? 'Error interno del servidor'
        : (err.message || 'Error de solicitud');

    const payload = { error: message };

    if (!isServerError && err?.code) {
        payload.code = err.code;
        if (err.params) {
            payload.params = err.params;
        }
    }

    res.status(resolvedStatus).json(payload);
}

/**
 * Maneja respuesta de no encontrado (404)
 * @param {Object} res - Response object
 * @param {string} [message='No encontrado'] - Mensaje de error
 * @param {string} [code=null] - Código i18n estable, opcional
 */
function handleNotFound(res, message = 'No encontrado', code = null) {
    res.status(404).json({ error: message, ...(code && { code }) });
}

/**
 * Maneja respuesta de error de negocio (400)
 * @param {Object} res - Response object
 * @param {string} error - Mensaje de error
 * @param {string} [code=null] - Código i18n estable, opcional
 * @param {Object} [params=null] - Parámetros de interpolación, opcional
 */
function handleBusinessError(res, error, code = null, params = null) {
    res.status(400).json({ error, ...(code && { code }), ...(params && { params }) });
}

module.exports = {
    handleRouteError,
    handleNotFound,
    handleBusinessError
};
