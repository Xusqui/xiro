/**
 * @fileoverview Métricas ligeras del sistema
 * Contadores en memoria con impacto mínimo en rendimiento
 */

const metrics = {
    // Sistema
    startTime: Date.now(),

    // HTTP
    totalRequests: 0,
    requestsPerMinute: 0,
    lastMinuteRequests: [],

    // WebSocket/Jugadores
    activePlayers: 0,
    totalConnectionsEver: 0,
    totalDisconnections: 0,

    // Juegos
    activeGames: 0,
    totalGamesCreated: 0,
    totalGamesCompleted: 0,

    // Base de datos
    totalDbQueries: 0,
    dbQueryTimes: [], // últimas 100 queries
    dbErrors: 0,

    // Errores
    totalErrors: 0,
    lastErrors: [], // últimos 10 errores

    // Submit-answer lock (worker local)
    answerLock: {
        attempts: 0,
        acquired: 0,
        lockMiss: 0,
        degradedFallback: 0
    },

    // Reconnect security (worker local)
    reconnectFailed: {
        total: 0,
        byReason: {},
        byActor: {}
    }
};

/**
 * Incrementar contador de requests HTTP
 */
function incrementHttpRequest() {
    metrics.totalRequests++;
    const now = Date.now();
    metrics.lastMinuteRequests.push(now);

    // Limpiar requests más viejos de 1 minuto
    const oneMinuteAgo = now - 60000;
    metrics.lastMinuteRequests = metrics.lastMinuteRequests.filter(t => t > oneMinuteAgo);
    metrics.requestsPerMinute = metrics.lastMinuteRequests.length;
}

/**
 * Incrementar jugadores activos
 */
function incrementPlayers() {
    metrics.activePlayers++;
    metrics.totalConnectionsEver++;
}

/**
 * Decrementar jugadores activos
 */
function decrementPlayers() {
    metrics.activePlayers = Math.max(0, metrics.activePlayers - 1);
    metrics.totalDisconnections++;
}

/**
 * Incrementar juegos activos
 */
function incrementGames() {
    metrics.activeGames++;
    metrics.totalGamesCreated++;
}

/**
 * Decrementar juegos activos
 */
function decrementGames() {
    metrics.activeGames = Math.max(0, metrics.activeGames - 1);
    metrics.totalGamesCompleted++;
}

/**
 * Registrar una query a la BD
 * @param {number} durationMs - Duración de la query en milisegundos
 */
function recordDbQuery(durationMs) {
    metrics.totalDbQueries++;
    metrics.dbQueryTimes.push(durationMs);

    // Mantener solo las últimas 100 queries
    if (metrics.dbQueryTimes.length > 100) {
        metrics.dbQueryTimes.shift();
    }
}

/**
 * Registrar un error de BD
 */
function recordDbError() {
    metrics.dbErrors++;
}

/**
 * Registrar un error general
 * @param {Error} error - El error ocurrido
 */
function recordError(error) {
    metrics.totalErrors++;
    metrics.lastErrors.push({
        message: error.message,
        timestamp: new Date().toISOString()
    });

    // Mantener solo los últimos 10 errores
    if (metrics.lastErrors.length > 10) {
        metrics.lastErrors.shift();
    }
}

/**
 * Registrar un intento de lock distribuido en submit-answer.
 * @param {Object} params
 * @param {boolean} params.acquired - true si se adquirió el lock
 * @param {boolean} params.degraded - true si se usó fallback por Redis no disponible
 */
function recordAnswerLockAttempt({ acquired, degraded }) {
    metrics.answerLock.attempts++;
    if (acquired) {
        metrics.answerLock.acquired++;
    } else {
        metrics.answerLock.lockMiss++;
    }

    if (degraded) {
        metrics.answerLock.degradedFallback++;
    }
}

/**
 * Registrar un reconnect-failed (worker local).
 * @param {Object} params
 * @param {string} params.reason - Reason devuelta al cliente
 * @param {string} params.actor - player|presenter
 */
function recordReconnectFailedAttempt({ reason, actor }) {
    const safeReason = typeof reason === 'string' && reason.trim()
        ? reason.trim().toLowerCase()
        : 'unknown';
    const safeActor = typeof actor === 'string' && actor.trim()
        ? actor.trim().toLowerCase()
        : 'player';

    metrics.reconnectFailed.total++;
    metrics.reconnectFailed.byReason[safeReason] = (metrics.reconnectFailed.byReason[safeReason] || 0) + 1;
    metrics.reconnectFailed.byActor[safeActor] = (metrics.reconnectFailed.byActor[safeActor] || 0) + 1;
}

/**
 * Obtener snapshot de métricas actuales
 * @returns {Object} Métricas formateadas
 */
function getMetrics() {
    const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);

    // Calcular promedios de queries
    const avgQueryTime = metrics.dbQueryTimes.length > 0
        ? Math.round(metrics.dbQueryTimes.reduce((a, b) => a + b, 0) / metrics.dbQueryTimes.length)
        : 0;

    const maxQueryTime = metrics.dbQueryTimes.length > 0
        ? Math.max(...metrics.dbQueryTimes)
        : 0;

    const answerLockAttempts = metrics.answerLock.attempts;
    const answerLockMissRate = answerLockAttempts > 0
        ? Number(((metrics.answerLock.lockMiss / answerLockAttempts) * 100).toFixed(2))
        : 0;

    return {
        system: {
            uptime_seconds: uptimeSeconds,
            uptime_formatted: `${uptimeHours}h ${uptimeMinutes % 60}m`,
            memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            memory_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            cpu_percent: process.cpuUsage().system / 1000000 // Aproximado
        },
        http: {
            total_requests: metrics.totalRequests,
            requests_per_minute: metrics.requestsPerMinute
        },
        players: {
            active_now: metrics.activePlayers,
            total_connections_ever: metrics.totalConnectionsEver,
            total_disconnections: metrics.totalDisconnections
        },
        games: {
            active_now: metrics.activeGames,
            total_created: metrics.totalGamesCreated,
            total_completed: metrics.totalGamesCompleted
        },
        database: {
            total_queries: metrics.totalDbQueries,
            avg_query_time_ms: avgQueryTime,
            max_query_time_ms: maxQueryTime,
            errors: metrics.dbErrors,
            recent_query_times: metrics.dbQueryTimes.slice(-10) // Últimas 10
        },
        errors: {
            total: metrics.totalErrors,
            recent: metrics.lastErrors
        },
        answer_lock: {
            attempts: answerLockAttempts,
            acquired: metrics.answerLock.acquired,
            lock_miss: metrics.answerLock.lockMiss,
            degraded_fallback: metrics.answerLock.degradedFallback,
            miss_rate: answerLockMissRate
        },
        reconnect_failed: {
            total: metrics.reconnectFailed.total,
            invalid_secret: metrics.reconnectFailed.byReason['invalid-secret'] || 0,
            by_reason: metrics.reconnectFailed.byReason,
            by_actor: metrics.reconnectFailed.byActor
        },
        timestamp: new Date().toISOString()
    };
}

/**
 * Resetear métricas (útil para testing)
 */
function resetMetrics() {
    metrics.totalRequests = 0;
    metrics.requestsPerMinute = 0;
    metrics.lastMinuteRequests = [];
    metrics.activePlayers = 0;
    metrics.activeGames = 0;
    metrics.totalDbQueries = 0;
    metrics.dbQueryTimes = [];
    metrics.dbErrors = 0;
    metrics.totalErrors = 0;
    metrics.lastErrors = [];
    metrics.answerLock = {
        attempts: 0,
        acquired: 0,
        lockMiss: 0,
        degradedFallback: 0
    };
    metrics.reconnectFailed = {
        total: 0,
        byReason: {},
        byActor: {}
    };
}

module.exports = {
    incrementHttpRequest,
    incrementPlayers,
    decrementPlayers,
    incrementGames,
    decrementGames,
    recordDbQuery,
    recordDbError,
    recordError,
    recordAnswerLockAttempt,
    recordReconnectFailedAttempt,
    getMetrics,
    resetMetrics
};
