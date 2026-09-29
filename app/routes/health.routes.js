/**
 * @fileoverview Endpoints de health check: /live, /ready, /api/health, /api/health/performance
 */

const express = require('express');
const os = require('os');
const { monitorEventLoopDelay } = require('perf_hooks');
const { pool } = require('../config/database');
const { players, socketToPlayer, activeGames, lobbyPlayers, teamConfigs } = require('../state/globalState');
const { MAX_TOTAL_PLAYERS, MAX_ACTIVE_LOBBIES, MAX_PLAYERS_PER_GAME } = require('../config/constants');
const { questionBankCache, fileCacheService } = require('../services/cache.service');
const timerManager = require('../services/timer.manager');
const metrics = require('../state/metrics');
const { rateLimiter } = require('../middlewares/rateLimiter');
const healthCheckService = require('../infrastructure/health/HealthCheckService');
const workerRegistry = require('../infrastructure/health/WorkerRegistry');
const { getLogsBufferService } = require('../services/logs-buffer.service');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');

// ── Event loop lag histogram (resolución 20 ms) ──────────────────────────────
const _elHistogram = monitorEventLoopDelay({ resolution: 20 });
_elHistogram.enable();

// ── CPU usage delta entre llamadas consecutivas ──────────────────────────────
let _lastCpuUsage = process.cpuUsage();
let _lastCpuCheck = Date.now();

function getCpuPercent() {
    const now = Date.now();
    const usage = process.cpuUsage(_lastCpuUsage);
    const elapsedUs = (now - _lastCpuCheck) * 1000; // ms → µs
    const cpuUs = usage.user + usage.system;
    const percent = elapsedUs > 0 ? Math.min(100, parseFloat((cpuUs / elapsedUs * 100).toFixed(1))) : 0;
    _lastCpuUsage = process.cpuUsage();
    _lastCpuCheck = now;
    return percent;
}

const router = express.Router();

/**
 * Obtiene estadísticas de uso de memoria de los Maps
 * @returns {Object}
 */
function getMemoryStats() {
    return {
        players: players.size,
        maxPlayers: MAX_TOTAL_PLAYERS,
        maxPlayersPerGame: MAX_PLAYERS_PER_GAME,
        socketToPlayer: socketToPlayer.size,
        activeLobbies: lobbyPlayers.size,
        maxLobbies: MAX_ACTIVE_LOBBIES,
        activeGames: activeGames.size,
        teamConfigs: teamConfigs.size
    };
}

function calculateCacheHitRate(cacheStats) {
    const totalCacheRequests = cacheStats.hits + cacheStats.misses;
    if (totalCacheRequests === 0) {
        return 0;
    }
    return ((cacheStats.hits / totalCacheRequests) * 100).toFixed(2);
}

function deriveDbHealthFromDependencies(depHealth) {
    let dbStatus = 'unknown';
    let dbLatency = 0;
    let dbError = null;

    const depDb = depHealth.dependencies?.database;
    if (!depDb) {
        return { dbStatus, dbLatency, dbError };
    }

    dbLatency = typeof depDb.latencyMs === 'number' ? depDb.latencyMs : dbLatency;

    if (depDb.status === 'unhealthy') {
        dbStatus = 'error';
    } else if (depDb.status === 'degraded') {
        dbStatus = 'slow';
    } else if (depDb.status && depDb.status !== 'healthy') {
        dbStatus = depDb.status;
    } else if (typeof dbLatency === 'number' && dbLatency >= 0) {
        dbStatus = dbLatency < 100 ? 'healthy' : 'slow';
    }

    if (depDb.error) {
        dbError = depDb.error;
    }

    return { dbStatus, dbLatency, dbError };
}

async function runDirectDbHealthCheck(dbHealth) {
    const dbCheckStart = Date.now();

    try {
        await pool.query('SELECT 1');
        if (dbHealth.dbStatus === 'unknown') {
            dbHealth.dbLatency = Date.now() - dbCheckStart;
            dbHealth.dbStatus = dbHealth.dbLatency < 100 ? 'healthy' : 'slow';
        }
    } catch (error) {
        dbHealth.dbStatus = 'error';
        dbHealth.dbError = error.message;
    }
}

function buildApiHealthPayload({
    depHealth,
    processMemory,
    memStats,
    cacheStats,
    cacheHitRate,
    appMetrics,
    rateLimitStats,
    timerStats,
    activeWorkers,
    workerList,
    dbHealth
}) {
    return {
        status: depHealth.status,
        uptime: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        timestamp: new Date().toISOString(),
        dependencies: depHealth.dependencies,
        memory: {
            heap: {
                usedMB: Math.round(processMemory.heapUsed / 1024 / 1024),
                totalMB: Math.round(processMemory.heapTotal / 1024 / 1024),
                percentUsed: ((processMemory.heapUsed / processMemory.heapTotal) * 100).toFixed(2)
            },
            rss: {
                usedMB: Math.round(processMemory.rss / 1024 / 1024)
            },
            external: {
                usedMB: Math.round(processMemory.external / 1024 / 1024)
            }
        },
        database: {
            status: dbHealth.dbStatus,
            latencyMs: dbHealth.dbLatency,
            pool: {
                total: pool.totalCount || 0,
                idle: pool.idleCount || 0,
                waiting: pool.waitingCount || 0
            },
            ...(dbHealth.dbError && { error: dbHealth.dbError })
        },
        cache: {
            questionBanks: {
                entries: cacheStats.size,
                maxSize: cacheStats.maxSize,
                hits: cacheStats.hits,
                misses: cacheStats.misses,
                hitRate: `${cacheHitRate}%`,
                evictions: cacheStats.evictions
            }
        },
        games: {
            active: memStats.activeGames,
            lobbies: memStats.activeLobbies,
            maxLobbies: memStats.maxLobbies,
            teamGames: memStats.teamConfigs,
            totalGamesCreated: appMetrics.gamesCreated,
            totalGamesCompleted: appMetrics.gamesCompleted
        },
        players: {
            connected: memStats.players,
            maxPlayers: memStats.maxPlayers,
            maxPlayersPerGame: memStats.maxPlayersPerGame,
            maxTotalPlayers: memStats.maxPlayers,
            utilizationPercent: ((memStats.players / memStats.maxPlayers) * 100).toFixed(2),
            socketMappings: memStats.socketToPlayer,
            totalConnections: appMetrics.players?.total_connections_ever || 0
        },
        rateLimiting: {
            trackedSockets: rateLimitStats.trackedSockets,
            limits: rateLimitStats.limits
        },
        timers: {
            active: timerStats.activeTimers,
            byType: timerStats.byType,
            byRoom: timerStats.byRoom,
            intervals: timerStats.intervals,
            timeouts: timerStats.timeouts
        },
        workers: {
            active: activeWorkers,
            list: workerList,
            instance: process.env.NODE_APP_INSTANCE || null,
            pid: process.pid
        },
        performance: {
            avgDbQueryMs: appMetrics.database?.avg_query_time_ms || 0,
            maxDbQueryMs: appMetrics.database?.max_query_time_ms || 0,
            dbErrors: appMetrics.database?.errors || 0,
            totalDbQueries: appMetrics.database?.total_queries || 0
        }
    };
}

// ===== ENDPOINTS LIGEROS: /live y /ready =====

/**
 * Liveness — ¿El proceso está vivo?
 * Respuesta ultra-rápida, sin I/O.
 */
router.get('/live', (req, res) => {
    const result = healthCheckService.getLiveness();
    res.status(result.code).json(result);
});

/**
 * Readiness — ¿Puede atender tráfico? (DB + Socket.IO ok)
 */
router.get('/ready', (req, res) => {
    const result = healthCheckService.getReadiness();
    res.status(result.code).json(result);
});

// ===== DASHBOARD COMPLETO =====

/**
 * Health check endpoint (requiere sesión de administrador)
 * Dashboard completo de salud del sistema
 */
router.get('/api/health', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const memStats = getMemoryStats();
        const processMemory = process.memoryUsage();
        const cacheStats = questionBankCache.getStats();
        const rateLimitStats = rateLimiter.getStats();
        const appMetrics = metrics.getMetrics();
        const activeWorkers = await workerRegistry.getActiveCount();
        const workerList = await workerRegistry.listActiveWorkers();
        const timerStats = timerManager.getStats();
        const depHealth = healthCheckService.getHealth();
        const cacheHitRate = calculateCacheHitRate(cacheStats);
        const dbHealth = deriveDbHealthFromDependencies(depHealth);

        await runDirectDbHealthCheck(dbHealth);

        const payload = buildApiHealthPayload({
            depHealth,
            processMemory,
            memStats,
            cacheStats,
            cacheHitRate,
            appMetrics,
            rateLimitStats,
            timerStats,
            activeWorkers,
            workerList,
            dbHealth
        });

        res.status(200)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(payload, null, 2));
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

/**
 * Formatea el uptime en formato legible
 * @param {number} seconds - Segundos de uptime
 * @returns {string}
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
}

/**
 * Performance endpoint - Métricas de optimizaciones Fase 1 y Fase 2
 * Incluye: cache, timers, memoria, sockets por room
 */
router.get('/api/health/performance', authenticateAdmin, authorizeAdmin, (req, res) => {
    const io = req.app.get('io'); // Socket.io instance desde app
    const memStats = getMemoryStats();
    const processMemory = process.memoryUsage();
    const cacheStats = fileCacheService.getStats();
    const timerStats = timerManager.getStats();
    const orphanTimers = timerManager.detectOrphans();

    // Sockets por room con análisis de segregación
    const roomStats = {};
    const roomAnalysis = {
        totalRooms: 0,
        playerRooms: 0,
        presenterRooms: 0,
        systemRooms: 0,
        totalPlayersInRooms: 0,
        totalPresentersInRooms: 0,
        averagePlayersPerGame: 0
    };

    if (io && io.sockets && io.sockets.adapter && io.sockets.adapter.rooms) {
        io.sockets.adapter.rooms.forEach((sockets, roomName) => {
            // Filtrar rooms de Socket.io internos (socket IDs propios)
            if (!sockets.has(roomName)) {
                roomStats[roomName] = sockets.size;
                roomAnalysis.totalRooms++;

                // Analizar tipo de room
                if (roomName.endsWith(':players')) {
                    roomAnalysis.playerRooms++;
                    roomAnalysis.totalPlayersInRooms += sockets.size;
                } else if (roomName.endsWith(':presenter')) {
                    roomAnalysis.presenterRooms++;
                    roomAnalysis.totalPresentersInRooms += sockets.size;
                } else {
                    roomAnalysis.systemRooms++;
                }
            }
        });

        // Calcular promedio de jugadores por juego
        if (roomAnalysis.playerRooms > 0) {
            roomAnalysis.averagePlayersPerGame =
                (roomAnalysis.totalPlayersInRooms / roomAnalysis.playerRooms).toFixed(1);
        }
    }

    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        cache: {
            hitRate: cacheStats.hitRate,
            hits: cacheStats.hits,
            misses: cacheStats.misses,
            size: cacheStats.size,
            maxSize: cacheStats.maxSize,
            items: cacheStats.items
        },
        timers: {
            total: timerStats.total,
            byType: timerStats.byType,
            byRoom: timerStats.byRoom,
            orphans: orphanTimers.length,
            orphanDetails: orphanTimers.map(t => ({
                type: t.type,
                roomId: t.roomId,
                ageMs: Date.now() - t.createdAt
            }))
        },
        sockets: {
            total: io ? io.sockets.sockets.size : 0,
            byRoom: roomStats,
            analysis: roomAnalysis,
            segregation: {
                enabled: true,
                description: 'Rooms segregated with :players and :presenter suffixes',
                playersReceiveSanitizedPayloads: true,
                presentersReceiveFullData: true
            }
        },
        memory: {
            heapUsedMB: Math.round(processMemory.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(processMemory.heapTotal / 1024 / 1024),
            externalMB: Math.round(processMemory.external / 1024 / 1024),
            rssMB: Math.round(processMemory.rss / 1024 / 1024),
            players: `${memStats.players}/${memStats.maxPlayers}`,
            activeLobbies: `${memStats.activeLobbies}/${memStats.maxLobbies}`,
            activeGames: memStats.activeGames
        },
        system: {
            cpuPercent: getCpuPercent(),
            cpuCount: os.cpus().length,
            loadavg: os.loadavg().map(v => parseFloat(v.toFixed(2))),
            freememMB: Math.round(os.freemem() / 1024 / 1024),
            totalMemMB: Math.round(os.totalmem() / 1024 / 1024)
        },
        eventLoop: {
            p50Ms: parseFloat((_elHistogram.percentile(50) / 1e6).toFixed(2)),
            p95Ms: parseFloat((_elHistogram.percentile(95) / 1e6).toFixed(2)),
            p99Ms: parseFloat((_elHistogram.percentile(99) / 1e6).toFixed(2)),
            meanMs: parseFloat((_elHistogram.mean / 1e6).toFixed(2)),
            maxMs: parseFloat((_elHistogram.max / 1e6).toFixed(2))
        }
    });
});

/**
 * Logs en vivo - GET /api/health/logs
 * Obtiene logs almacenados en buffer con filtros opcionales
 * Query params:
 * - level: error|warn|info|http|debug|all (default: all)
 * - search: búsqueda de texto libre
 * - limit: número máximo de resultados (default: 1000)
 */
router.get('/api/health/logs', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const logsBuffer = getLogsBufferService();

        const options = {
            level: req.query.level || 'all',
            search: req.query.search || '',
            limit: parseInt(req.query.limit) || 1000
        };

        const [logs, stats, logsMetrics] = await Promise.all([
            logsBuffer.getLogs(options),
            logsBuffer.getStats(),
            logsBuffer.getMetrics()
        ]);

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            logs,
            stats,
            metrics: logsMetrics
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error al obtener logs',
            code: 'GET_LOGS_FAILED',
            error: error.message
        });
    }
});

module.exports = router;
