/**
 * @fileoverview Middleware centralizado para manejo de errores
 */

const path = require('path');
const logger = require('../config/logger');

// Mapa de códigos HTTP a páginas HTML de error
const ERROR_PAGES = {
    400: path.resolve(__dirname, '../public/error/400.html'),
    401: path.resolve(__dirname, '../public/error/401.html'),
    403: path.resolve(__dirname, '../public/error/403.html'),
    404: path.resolve(__dirname, '../public/error/404.html'),
    410: path.resolve(__dirname, '../public/error/410.html'),
    429: path.resolve(__dirname, '../public/error/429.html'),
    500: path.resolve(__dirname, '../public/error/500.html'),
    503: path.resolve(__dirname, '../public/error/503.html'),
};

/**
 * Determina si el cliente espera una respuesta HTML (navegador)
 * en lugar de JSON (llamada API).
 * @param {Object} req - Request object
 * @returns {boolean}
 */
function clientWantsHtml(req) {
    return !req.path.startsWith('/api/') && req.accepts(['json', 'html']) === 'html';
}

/**
 * Construye el payload JSON de error, añadiendo code/params solo en errores
 * 4xx cuando el error de origen los lleva (no exponer detalles en 5xx).
 * @param {number} status - Código de estado HTTP
 * @param {Error} err - Error object
 * @param {string} errorMessage - Mensaje ya resuelto para el campo "error"
 * @returns {Object}
 */
function buildErrorPayload(status, err, errorMessage) {
    const payload = {
        error: errorMessage,
        ...(status >= 500 && { message: 'Ocurrió un error inesperado' })
    };

    if (status < 500 && err.code) {
        payload.code = err.code;
        if (err.params) {
            payload.params = err.params;
        }
    }

    return payload;
}

/**
 * Middleware de manejo de errores global
 * Debe colocarse al final de todas las rutas
 * @param {Error} err - Error object
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
function errorHandler(err, req, res, _next) {
    logger.error('Error no capturado:', err);

    // Errores de PostgreSQL (códigos de 5 caracteres alfanuméricos, ej. '23505')
    if (err.code && /^[0-9A-Z]{5}$/.test(err.code)) {
        switch (err.code) {
            case '23505': // Unique violation
                return res.status(400).json({
                    error: 'Conflicto de datos',
                    message: 'El registro ya existe'
                });
            case '23503': // Foreign key violation
                return res.status(400).json({
                    error: 'Violación de integridad',
                    message: 'El registro está siendo referenciado por otros datos'
                });
            default:
                if (clientWantsHtml(req)) {
                    return res.status(500).sendFile(ERROR_PAGES[500]);
                }
                return res.status(500).json({
                    error: 'Error de base de datos',
                    message: 'Ocurrió un error al procesar tu solicitud'
                });
        }
    }

    const status = err.status || err.statusCode || 500;

    // Servir página HTML si el cliente es un navegador
    if (clientWantsHtml(req)) {
        const page = ERROR_PAGES[status] || ERROR_PAGES[500];
        return res.status(status).sendFile(page);
    }

    // Respuesta JSON para clientes API
    // Los errores 5xx no exponen detalles internos
    const errorMessage = status < 500
        ? (err.message || 'Error de solicitud')
        : 'Error interno del servidor';

    res.status(status).json(buildErrorPayload(status, err, errorMessage));
}

/**
 * Middleware para rutas no encontradas (404)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
function notFoundHandler(req, res) {
    if (clientWantsHtml(req)) {
        return res.status(404).sendFile(ERROR_PAGES[404]);
    }
    res.status(404).json({
        error: 'Ruta no encontrada',
        message: `La ruta ${req.method} ${req.path} no existe`,
        code: 'ROUTE_NOT_FOUND',
        params: { method: req.method, path: req.path }
    });
}

module.exports = {
    errorHandler,
    notFoundHandler
};
