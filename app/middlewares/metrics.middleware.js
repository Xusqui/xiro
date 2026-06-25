/**
 * @fileoverview Middleware para registrar métricas HTTP
 */

const metrics = require('../state/metrics');

/**
 * Middleware que incrementa el contador de requests
 */
function metricsMiddleware(req, res, next) {
    metrics.incrementHttpRequest();
    next();
}

module.exports = metricsMiddleware;
