/**
 * @fileoverview Rutas para métricas del sistema
 * Endpoint para consultar estadísticas en tiempo real
 */

const express = require('express');
const router = express.Router();
const metrics = require('../state/metrics');
const { pool } = require('../config/database');
const { getDistributedAnswerLockMetrics } = require('../application/commands/submit-answer/lockMetrics');
const { getDistributedReconnectFailedMetrics } = require('../sockets/handlers/reconnectMetrics');
const { players } = require('../state/globalState');

/**
 * GET /api/metrics
 * Obtiene snapshot de métricas del sistema
 */
router.get('/api/metrics', async (req, res) => {
    try {
        const metricsData = metrics.getMetrics();
        const roomId = req.query?.roomId;
        const distributedAnswerLock = await getDistributedAnswerLockMetrics({ roomId });
        const distributedReconnectFailed = await getDistributedReconnectFailedMetrics({ actor: 'player' });

        const legacyPlayersWithoutSecret = Array.from(players.values()).filter(player => {
            if (!player) return false;
            if (player.role === 'presenter') return false;
            return !player.sessionSecret;
        }).length;

        // Agregar métricas de pool de BD
        const poolStatus = {
            total_count: pool.totalCount,
            idle_count: pool.idleCount,
            waiting_count: pool.waitingCount
        };

        res.json({
            ...metricsData,
            database: {
                ...metricsData.database,
                pool: poolStatus
            },
            answer_lock_distributed: distributedAnswerLock,
            reconnect_failed_distributed: distributedReconnectFailed,
            reconnect_security: {
                legacy_players_without_secret: legacyPlayersWithoutSecret
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error retrieving metrics',
            code: 'METRICS_RETRIEVAL_FAILED',
            message: error.message
        });
    }
});

module.exports = router;
