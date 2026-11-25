/**
 * @fileoverview Worker registry using Redis TTL keys
 *
 * Tracks active worker processes for health reporting.
 */

const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

class WorkerRegistry {
    constructor({ prefix = 'worker:presence:', ttlSeconds = 60, refreshIntervalSeconds = 20 } = {}) {
        this.prefix = prefix;
        this.ttlSeconds = ttlSeconds;
        this.refreshIntervalSeconds = refreshIntervalSeconds;
        this._client = null;
        this._intervalId = null;
        this._startedAt = new Date().toISOString();
        this._statsProvider = null;
    }

    /**
     * Registra la función que aporta las estadísticas de carga de este worker.
     * @param {(() => Object)|null} provider - Ver infrastructure/health/worker-stats.js
     */
    setStatsProvider(provider) {
        this._statsProvider = typeof provider === 'function' ? provider : null;
    }

    /**
     * Publica ya la presencia y estadísticas de este worker, sin esperar al intervalo.
     * Se usa antes de leer el agregado para que el worker que responde no aporte datos de hace 20 s.
     * @returns {Promise<boolean>} true si se publicó; false si el registro no está iniciado o Redis falló
     */
    async refreshNow() {
        if (!this._client) return false;
        try {
            await this._refresh();
            return true;
        } catch (error) {
            logger.warn('Worker registry immediate refresh failed', { error: error.message });
            return false;
        }
    }

    async start() {
        if (this._intervalId) return;

        try {
            this._client = await getRedisClient();
        } catch (error) {
            logger.warn('Worker registry disabled (Redis unavailable)', { error: error.message });
            return;
        }

        await this._refresh();

        this._intervalId = setInterval(() => {
            this._refresh().catch(error => {
                logger.warn('Worker registry refresh failed', { error: error.message });
            });
        }, this.refreshIntervalSeconds * 1000);

        if (this._intervalId.unref) this._intervalId.unref();
    }

    stop() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }

        this._client = null;
    }

    async getActiveCount() {
        try {
            // Si el registry no fue iniciado, evitar conexiones Redis on-demand
            if (!this._client) {
                return null;
            }
            const client = this._client;
            let count = 0;

            for await (const _ of client.scanIterator({
                MATCH: `${this.prefix}*`,
                COUNT: 100
            })) {
                count += 1;
            }

            return count;
        } catch (error) {
            logger.warn('Worker registry count failed', { error: error.message });
            return null;
        }
    }

    async listActiveWorkers() {
        try {
            // Si el registry no fue iniciado, evitar conexiones Redis on-demand
            if (!this._client) {
                return null;
            }
            const client = this._client;
            const workers = [];

            for await (const key of client.scanIterator({
                MATCH: `${this.prefix}*`,
                COUNT: 100
            })) {
                try {
                    const raw = await client.get(key);
                    if (!raw) continue;
                    const payload = JSON.parse(raw);
                    workers.push(payload);
                } catch (error) {
                    logger.warn('Worker registry entry unreadable', { key, error: error.message });
                }
            }

            return workers;
        } catch (error) {
            logger.warn('Worker registry list failed', { error: error.message });
            return null;
        }
    }

    async _refresh() {
        const client = this._client || (await getRedisClient());
        await client.setEx(this._key(), this.ttlSeconds, JSON.stringify(this._payload()));
    }

    _key() {
        return `${this.prefix}${process.pid}`;
    }

    _payload() {
        const payload = {
            pid: process.pid,
            instance: process.env.NODE_APP_INSTANCE || null,
            startedAt: this._startedAt
        };
        const stats = this._collectStats();
        if (stats) payload.stats = stats;
        return payload;
    }

    _collectStats() {
        if (!this._statsProvider) return null;
        try {
            return this._statsProvider();
        } catch (error) {
            // Sin estadísticas el worker sigue contando como vivo; el agregado lo marca como no informado
            logger.warn('Worker stats provider failed', { error: error.message });
            return null;
        }
    }
}

module.exports = new WorkerRegistry();
