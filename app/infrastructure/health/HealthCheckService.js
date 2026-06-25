/**
 * @fileoverview Servicio central de health checks con tracking de dependencias
 * @module infrastructure/health/HealthCheckService
 *
 * Realiza checks periódicos de DB, Redis y Socket.IO.
 * Expone estado global: healthy | degraded | unhealthy.
 * Módulo ligero (< 150 líneas).
 */

const { checkDatabase, checkRedis, checkSocketIO } = require('./DependencyChecker');
const logger = require('../../config/logger');
const { getWorkerContext } = require('../../config/log-context');

class HealthCheckService {
    constructor({ checkIntervalMs = 30000 } = {}) {
        /** @type {Map<string, {status, latencyMs, lastCheck, error?, details?}>} */
        this.dependencies = new Map();
        this.checkIntervalMs = checkIntervalMs;
        this._intervalId = null;
        this._io = null;
        this._shuttingDown = false;
        this._startedAt = Date.now();
    }

    /**
     * Inyectar instancia de Socket.IO (se hace post-init)
     */
    setIO(io) {
        this._io = io;
    }

    /**
     * Marcar que el servidor se está apagando
     */
    markShuttingDown() {
        this._shuttingDown = true;
    }

    /**
     * Iniciar checks periódicos
     */
    start() {
        // Check inicial inmediato
        this.runChecks().catch(err =>
            logger.warn('Initial health check failed', { error: err.message })
        );

        this._intervalId = setInterval(() => {
            this.runChecks().catch(err =>
                logger.warn('Periodic health check failed', { error: err.message })
            );
        }, this.checkIntervalMs);

        // No bloquear el event loop para shutdown
        if (this._intervalId.unref) this._intervalId.unref();

        logger.info('HealthCheckService started', {
            ...getWorkerContext(),
            intervalMs: this.checkIntervalMs
        });
    }

    /**
     * Detener checks periódicos
     */
    stop() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    /**
     * Ejecutar todos los checks
     */
    async runChecks() {
        const now = new Date().toISOString();

        const [db, redis] = await Promise.allSettled([
            checkDatabase(),
            checkRedis()
        ]);

        const socketIO = checkSocketIO(this._io);

        this.dependencies.set('database', { ...unwrapResult(db), lastCheck: now });
        this.dependencies.set('redis', { ...unwrapResult(redis), lastCheck: now });
        this.dependencies.set('socketio', { ...socketIO, lastCheck: now });
    }

    // ===== ENDPOINTS =====

    /**
     * /live — ¿El proceso está vivo? (no bloqueado)
     * Solo comprueba que el event loop responde.
     */
    getLiveness() {
        if (this._shuttingDown) {
            return { status: 'shutting_down', code: 503 };
        }
        return { status: 'alive', uptime: Math.floor((Date.now() - this._startedAt) / 1000), code: 200 };
    }

    /**
     * /ready — ¿Puede atender tráfico? (DB + Socket.IO deben estar healthy)
     */
    getReadiness() {
        if (this._shuttingDown) {
            return { status: 'shutting_down', code: 503 };
        }
        const db = this.dependencies.get('database');
        const sio = this.dependencies.get('socketio');

        const dbOk = db && db.status !== 'unhealthy';
        const sioOk = sio && sio.status !== 'unhealthy';

        if (dbOk && sioOk) {
            return { status: 'ready', code: 200 };
        }
        return {
            status: 'not_ready',
            code: 503,
            issues: {
                ...((!dbOk) && { database: db?.error || db?.status }),
                ...((!sioOk) && { socketio: sio?.error || sio?.status })
            }
        };
    }

    /**
     * /health — Dashboard completo de todas las dependencias
     */
    getHealth() {
        const deps = {};
        for (const [name, info] of this.dependencies) {
            deps[name] = info;
        }

        const overall = this._computeOverallStatus();

        return {
            status: overall,
            uptime: Math.floor((Date.now() - this._startedAt) / 1000),
            timestamp: new Date().toISOString(),
            dependencies: deps,
            pid: process.pid
        };
    }

    /**
     * Calcular estado global
     */
    _computeOverallStatus() {
        if (this._shuttingDown) return 'shutting_down';
        if (this.dependencies.size === 0) return 'initializing';

        let hasUnhealthy = false;
        let hasDegraded = false;

        for (const [, info] of this.dependencies) {
            if (info.status === 'unhealthy') hasUnhealthy = true;
            if (info.status === 'degraded') hasDegraded = true;
        }

        if (hasUnhealthy) return 'unhealthy';
        if (hasDegraded) return 'degraded';
        return 'healthy';
    }
}

/** Unwrap Promise.allSettled result */
function unwrapResult(settled) {
    if (settled.status === 'fulfilled') return settled.value;
    return { status: 'unhealthy', latencyMs: 0, error: settled.reason?.message || 'unknown' };
}

// Singleton
const healthCheckService = new HealthCheckService();

module.exports = healthCheckService;
