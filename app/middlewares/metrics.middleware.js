/**
 * @fileoverview Middleware para registrar métricas HTTP
 */

const metrics = require('../state/metrics');
const { httpRequestDuration } = require('../infrastructure/observability/metrics-registry');

/**
 * Etiqueta de ruta con cardinalidad acotada: el patrón Express (`/api/games/:pin`),
 * nunca la URL real. Lo que no pasó por un router es estático o no encontrado.
 * @param {Object} req
 * @param {number} statusCode
 * @returns {string}
 */
function routeLabel(req, statusCode) {
    if (req.route?.path) return `${req.baseUrl || ''}${req.route.path}`;
    return statusCode === 404 ? 'not_found' : 'static';
}

/**
 * Middleware que incrementa el contador de requests y mide su duración
 */
function metricsMiddleware(req, res, next) {
    metrics.incrementHttpRequest();
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        end({ method: req.method, route: routeLabel(req, res.statusCode), status_code: String(res.statusCode) });
    });
    next();
}

module.exports = metricsMiddleware;
module.exports.routeLabel = routeLabel;
