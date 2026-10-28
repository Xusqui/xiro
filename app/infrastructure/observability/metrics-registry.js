/**
 * @fileoverview Métricas Prometheus de este worker.
 *
 * Cada worker PM2 tiene su propio registro con la etiqueta `worker`
 * (NODE_APP_INSTANCE). cluster-metrics.js junta los registros de todos los
 * workers vía Redis, y como la etiqueta los distingue, nunca se suman entre sí:
 * la agregación se hace en las consultas de Prometheus.
 *
 * Las etiquetas tienen valores acotados (rutas Express, nombres de comando, una
 * lista fija de eventos de socket) para que un cliente no pueda disparar la
 * cardinalidad.
 */

const client = require('prom-client');
const { version } = require('../../package.json');

const registry = new client.Registry();
registry.setDefaultLabels({ worker: process.env.NODE_APP_INSTANCE || '0' });

client.collectDefaultMetrics({ register: registry, eventLoopMonitoringPrecision: 20 });

const HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30];
const FAST_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const httpRequestDuration = new client.Histogram({
    name: 'xiro_http_request_duration_seconds',
    help: 'Duración de las peticiones HTTP, por ruta Express',
    labelNames: ['method', 'route', 'status_code'],
    buckets: HTTP_BUCKETS,
    registers: [registry]
});

const socketEvents = new client.Counter({
    name: 'xiro_socket_events_total',
    help: 'Eventos Socket.IO recibidos de los clientes',
    labelNames: ['event'],
    registers: [registry]
});

const commandDuration = new client.Histogram({
    name: 'xiro_command_duration_seconds',
    help: 'Duración de los comandos de la cadena (unirse, responder…)',
    labelNames: ['command', 'outcome'],
    buckets: FAST_BUCKETS,
    registers: [registry]
});

const dbQueryDuration = new client.Histogram({
    name: 'xiro_db_query_duration_seconds',
    help: 'Duración de las consultas a PostgreSQL',
    labelNames: ['kind', 'outcome'],
    buckets: FAST_BUCKETS,
    registers: [registry]
});

const buildInfo = new client.Gauge({
    name: 'xiro_build_info',
    help: 'Versión de Xiro! en ejecución',
    labelNames: ['version'],
    registers: [registry]
});
buildInfo.set({ version }, 1);

const clusterWorkers = new client.Gauge({
    name: 'xiro_cluster_workers',
    help: 'Workers con métricas recientes en Redis (lo calcula el worker que atiende el scrape)',
    registers: []
});

/**
 * Mide una promesa en un histograma y la devuelve sin cambiarla.
 * @param {client.Histogram} histogram
 * @param {Object} labels - etiquetas fijas; `outcome` se añade (ok|error)
 * @param {Function} fn - devuelve una promesa
 */
async function timeAsync(histogram, labels, fn) {
    const end = histogram.startTimer(labels);
    try {
        const result = await fn();
        end({ outcome: 'ok' });
        return result;
    } catch (error) {
        end({ outcome: 'error' });
        throw error;
    }
}

module.exports = {
    client,
    registry,
    httpRequestDuration,
    socketEvents,
    commandDuration,
    dbQueryDuration,
    clusterWorkers,
    timeAsync
};
