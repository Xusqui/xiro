/**
 * @fileoverview Módulo de graceful shutdown completo
 * @module infrastructure/shutdown/GracefulShutdown
 *
 * Orquesta el apagado ordenado de todos los subsistemas:
 * 1. Marcar como "shutting down" (health checks devuelven 503)
 * 2. Dejar de aceptar nuevas conexiones
 * 3. Notificar clientes conectados
 * 4. Limpiar timers y recursos en memoria
 * 5. Cerrar Socket.IO, Redis, PostgreSQL
 * 6. Cerrar servidor HTTP
 * 7. Forzar salida si excede timeout
 */

const logger = require('../../config/logger');
const healthCheckService = require('../health/HealthCheckService');
const { getWorkerContext } = require('../../config/log-context');
const timerManager = require('../../services/timer.manager');
const { closeRedisClient } = require('../../config/redis');

const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 6000;
const NOTIFY_WAIT_MS = Number(process.env.SHUTDOWN_NOTIFY_WAIT_MS) || 200;
const CLOSE_TIMEOUT_MS = Number(process.env.SHUTDOWN_CLOSE_TIMEOUT_MS) || 600;
let isShuttingDown = false;
let storedDeps = null; // Guardar deps para shutdown manual (ej: botón PANIC)

/**
 * Registrar handlers de shutdown en el proceso
 * @param {Object} deps - Dependencias inyectadas
 * @param {http.Server} deps.server - Servidor HTTP
 * @param {Object} deps.io - Instancia Socket.IO
 * @param {Object} deps.pool - Pool de PostgreSQL
 * @param {Object} deps.ackManager - AckManager (opcional)
 */
function registerShutdownHandlers(deps) {
    storedDeps = deps; // Almacenar para triggerShutdown()
    const handler = () => shutdown(deps);

    process.on('SIGTERM', handler);
    process.on('SIGINT', handler);

    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', { error: error.message, stack: error.stack });
        shutdown(deps, 'uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled promise rejection', { reason: String(reason) });
        // No salir: solo registrar
    });

    logger.info('Graceful shutdown handlers registered', getWorkerContext());
}

/**
 * Ejecutar shutdown ordenado
 */
async function shutdown(deps, reason = 'signal') {
    if (isShuttingDown) {
        logger.warn('Shutdown already in progress, ignoring');
        return;
    }
    isShuttingDown = true;

    const startTime = Date.now();
    logger.warn(`Graceful shutdown initiated (reason: ${reason})`);

    // Forzar salida si excede timeout
    const forceTimer = setTimeout(() => {
        logger.error(`Forced shutdown after ${SHUTDOWN_TIMEOUT_MS}ms timeout`);
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    try {
        // 1. Marcar como shutting down → /ready y /live devuelven 503
        healthCheckService.markShuttingDown();
        healthCheckService.stop();
        logger.info('Step 1/6: Health checks marked as shutting down');

        // 2. Notificar clientes conectados
        await notifyClients(deps.io);
        logger.info('Step 2/6: Clients notified');

        // 3. Limpiar AckManager
        if (deps.ackManager) {
            deps.ackManager.cleanup();
            logger.info('Step 3/6: AckManager cleaned up');
        }

        // 4. Limpiar timers activos
        cleanupTimers();
        logger.info('Step 4/6: Timers cleaned up');

        // 5. Cerrar Socket.IO
        await closeSocketIO(deps.io);
        logger.info('Step 5/6: Socket.IO closed');

        // 6. Cerrar conexiones de datos
        await closeDataConnections(deps.pool);
        logger.info('Step 6/6: Data connections closed');

        // Cerrar servidor HTTP
        await closeHttpServer(deps.server);

        const elapsed = Date.now() - startTime;
        logger.info(`Graceful shutdown completed in ${elapsed}ms`);

        clearTimeout(forceTimer);
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        clearTimeout(forceTimer);
        process.exit(1);
    }
}

// ===== FUNCIONES INTERNAS =====

async function notifyClients(io) {
    if (!io?.sockets) return;

    const count = io.sockets.sockets.size;
    if (count === 0) return;

    logger.info(`Notifying ${count} connected clients about shutdown`);
    io.emit('server-restarting', {
        message: 'El servidor se está reiniciando. Reconectando automáticamente...',
        reconnectIn: 5000
    });

    // Dar tiempo a que el mensaje llegue
    await new Promise(resolve => setTimeout(resolve, NOTIFY_WAIT_MS));
}

function cleanupTimers() {
    try {
        const stats = timerManager.getStats();
        timerManager.clearAll();
        logger.info(`Cleaned up ${stats.total} active timer(s)`, {
            byType: stats.byType,
            byRoom: Object.keys(stats.byRoom).length
        });
    } catch (error) {
        logger.warn('Timer cleanup skipped', { error: error.message });
    }
}

function closeSocketIO(io) {
    if (!io) return;
    return new Promise((resolve) => {
        io.close(() => resolve());
        // Si no cierra rapido, seguir adelante
        setTimeout(resolve, CLOSE_TIMEOUT_MS);
    });
}

async function closeDataConnections(pool) {
    // Cerrar Redis (singleton)
    try {
        await closeRedisClient();
        logger.info('Redis client closed');
    } catch (error) {
        logger.warn('Redis close skipped', { error: error.message });
    }

    // Cerrar PostgreSQL pool
    if (pool) {
        try {
            await pool.end();
            logger.info('PostgreSQL pool closed');
        } catch (error) {
            logger.warn('PostgreSQL close error', { error: error.message });
        }
    }
}

function closeHttpServer(server) {
    if (!server) return;
    return new Promise((resolve) => {
        server.close(() => resolve());
        setTimeout(resolve, CLOSE_TIMEOUT_MS);
    });
}

/**
 * Trigger manual del graceful shutdown (para botón PANIC, etc.)
 * @param {string} reason - Razón del shutdown (ej: 'panic-button', 'admin-request')
 * @returns {Promise<void>}
 */
async function triggerShutdown(reason = 'manual') {
    if (!storedDeps) {
        logger.error('Cannot trigger shutdown: dependencies not initialized');
        throw new Error('Shutdown system not initialized');
    }

    logger.warn(`Manual shutdown triggered: ${reason}`);
    await shutdown(storedDeps, reason);
}

module.exports = { registerShutdownHandlers, triggerShutdown };
