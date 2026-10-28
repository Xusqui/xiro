/**
 * @fileoverview Métricas de todo el clúster PM2 desde un solo scrape.
 *
 * PM2 reparte el puerto de métricas entre workers, así que cada scrape lo atiende
 * uno cualquiera. Para que Prometheus vea todos, cada worker publica su registro
 * en Redis cada 10 s (clave por NODE_APP_INSTANCE, con TTL) y el worker que
 * atiende el scrape junta el suyo, en vivo, con los de los demás.
 * Un worker reiniciado reutiliza su clave, así que nunca aparece dos veces.
 */

const { AggregatorRegistry } = require('prom-client');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');
const { registry, clusterWorkers } = require('./metrics-registry');

const KEY_PREFIX = 'metrics:worker:';

class ClusterMetrics {
    constructor({
        getClient = getRedisClient,
        source = registry,
        workerId = process.env.NODE_APP_INSTANCE || '0',
        intervalMs = 10000,
        ttlSeconds = 35
    } = {}) {
        this._getClient = getClient;
        this._source = source;
        this._key = `${KEY_PREFIX}${workerId}`;
        this._intervalMs = intervalMs;
        this._ttlSeconds = ttlSeconds;
        this._intervalId = null;
    }

    /** Publica ya y cada intervalo; un fallo de Redis se reintenta en el siguiente. */
    async start() {
        if (this._intervalId) return;
        const publishSafely = () =>
            this.publish().catch(error => logger.warn('Cluster metrics publish failed', { error: error.message }));
        this._intervalId = setInterval(publishSafely, this._intervalMs);
        if (this._intervalId.unref) this._intervalId.unref();
        await publishSafely();
    }

    stop() {
        clearInterval(this._intervalId);
        this._intervalId = null;
    }

    async publish() {
        const client = await this._getClient();
        const snapshot = await this._source.getMetricsAsJSON();
        await client.setEx(this._key, this._ttlSeconds, JSON.stringify(snapshot));
    }

    /**
     * Registro con las métricas de este worker y de los demás workers vivos.
     * Si Redis falla, devuelve solo las de este worker (xiro_cluster_workers = 1).
     * @returns {Promise<import('prom-client').Registry>}
     */
    async collect() {
        const own = await this._source.getMetricsAsJSON();
        const others = await this._readOthers();
        const merged = AggregatorRegistry.aggregate([own, ...others]);
        clusterWorkers.set(1 + others.length);
        merged.registerMetric(clusterWorkers);
        return merged;
    }

    async _readOthers() {
        try {
            const client = await this._getClient();
            const keys = [];
            for await (const key of client.scanIterator({ MATCH: `${KEY_PREFIX}*`, COUNT: 100 })) {
                if (key !== this._key) keys.push(key);
            }
            if (keys.length === 0) return [];
            const raws = await client.mGet(keys);
            return raws.map(parseSnapshot).filter(Boolean);
        } catch (error) {
            logger.warn('Cluster metrics read failed; serving this worker only', { error: error.message });
            return [];
        }
    }
}

function parseSnapshot(raw) {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

module.exports = { ClusterMetrics, KEY_PREFIX };
