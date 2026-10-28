/**
 * @fileoverview Servidor HTTP de métricas Prometheus (GET /metrics).
 *
 * Escucha en su propio puerto (METRICS_PORT), que no se publica en el host ni
 * pasa por el proxy: solo lo alcanza Prometheus por la red interna de Docker.
 * Con METRICS_TOKEN, además exige `Authorization: Bearer <token>`.
 * Sin METRICS_PORT no arranca nada (ni servidor ni publicación en Redis).
 */

const http = require('http');
const crypto = require('crypto');
const logger = require('../../config/logger');
const { ClusterMetrics } = require('./cluster-metrics');

function tokenMatches(header, token) {
    const expected = Buffer.from(`Bearer ${token}`);
    const received = Buffer.from(typeof header === 'string' ? header : '');
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

/**
 * @param {Object} options
 * @param {ClusterMetrics} options.cluster
 * @param {string} [options.token]
 * @returns {http.Server}
 */
function createMetricsServer({ cluster, token }) {
    return http.createServer(async (req, res) => {
        if (req.method !== 'GET' || req.url.split('?')[0] !== '/metrics') {
            res.writeHead(404).end();
            return;
        }
        if (token && !tokenMatches(req.headers.authorization, token)) {
            res.writeHead(401, { 'WWW-Authenticate': 'Bearer' }).end();
            return;
        }
        try {
            const merged = await cluster.collect();
            res.writeHead(200, { 'Content-Type': merged.contentType });
            res.end(await merged.metrics());
        } catch (error) {
            logger.error('Metrics scrape failed', { error: error.message });
            res.writeHead(500).end();
        }
    });
}

/**
 * Arranca la publicación en Redis y el servidor si METRICS_PORT está definido.
 * @param {Object} [env]
 * @returns {Promise<{server: http.Server, cluster: ClusterMetrics}|null>}
 */
async function startMetricsServer(env = process.env) {
    const port = parseInt(env.METRICS_PORT, 10);
    if (!port) return null;

    const cluster = new ClusterMetrics();
    await cluster.start();

    const server = createMetricsServer({ cluster, token: env.METRICS_TOKEN || '' });
    server.on('error', error => logger.error('Metrics server error', { error: error.message, port }));
    server.listen(port, () => logger.info('Prometheus metrics listening', { port }));
    // No retiene el proceso durante el apagado ordenado.
    server.unref();
    return { server, cluster };
}

module.exports = { startMetricsServer, createMetricsServer };
