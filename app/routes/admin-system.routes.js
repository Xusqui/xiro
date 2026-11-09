/**
 * @fileoverview Utilidades de sistema del panel de administración: métricas y salud de la BD,
 * métricas y limpieza de caché, y borrado de logs. Montado desde routes/admin.routes.js.
 * Las rutas, los códigos y las respuestas no cambian.
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const logger = require('../config/logger');
const { questionBankCache } = require('../services/cache.service');
const pinCache = require('../services/pin-cache.service');
const { getCompleteMetrics } = require('../services/db-metrics.service');
const { checkDatabaseHealth } = require('../services/health-check.service');
const cacheMetricsService = require('../services/CacheMetricsService');

const router = express.Router();

/**
 * Endpoint de métricas de base de datos
 * GET /api/admin/db-metrics
 * Requiere: autenticación admin
 */
router.get('/api/admin/db-metrics', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const metrics = await getCompleteMetrics();
        res.json({
            success: true,
            metrics
        });
    } catch (error) {
        logger.error('Error getting DB metrics', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Error al obtener métricas de base de datos',
            code: 'DB_METRICS_FAILED'
        });
    }
});

/**
 * Endpoint de health check de base de datos
 * GET /api/admin/db-health
 * Requiere: autenticación admin
 */
router.get('/api/admin/db-health', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const health = await checkDatabaseHealth();
        res.json({
            success: true,
            health
        });
    } catch (error) {
        logger.error('Error checking DB health', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Error al verificar salud de base de datos',
            code: 'DB_HEALTH_CHECK_FAILED'
        });
    }
});

/**
 * Endpoint de métricas de caché
 * GET /api/admin/cache-metrics
 * Requiere: autenticación admin
 * Retorna: métricas agregadas de todos los cachés del sistema
 */
router.get('/api/admin/cache-metrics', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const metrics = await cacheMetricsService.aggregateMetrics();
        res.json({
            success: true,
            metrics
        });
    } catch (error) {
        logger.error('Error getting cache metrics', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: 'Error al obtener métricas de caché',
            code: 'CACHE_METRICS_FAILED'
        });
    }
});

/**
 * Endpoint para limpiar la caché de juegos
 * POST /api/admin/clear-cache
 * Requiere: autenticación admin
 * Limpia: questionBankCache (bancos y juegos completos de la base de datos)
 */
router.post('/api/admin/clear-cache', authenticateAdmin, authorizeAdmin, (req, res) => {
    try {
        // Obtener stats antes de limpiar (de este worker)
        const statsBeforeQuestions = questionBankCache.getStats();
        const statsPinBefore = pinCache.getStats();

        // Limpia este worker y avisa a los demás (services/cache-invalidation-bus.js)
        questionBankCache.invalidateAll();
        pinCache.clear();

        logger.info('Game cache cleared by admin (all workers)', {
            user: req.user.role,
            questionBanksBefore: statsBeforeQuestions.size,
            pinsBefore: statsPinBefore.size
        });

        res.json({
            success: true,
            message: 'Caché de juegos limpiada exitosamente en todos los workers',
            code: 'CACHE_CLEARED',
            cleared: {
                games: statsBeforeQuestions.size,
                pins: statsPinBefore.size
            }
        });
    } catch (error) {
        logger.error('Error clearing game cache', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: 'Error al limpiar la caché de juegos',
            code: 'CLEAR_CACHE_FAILED'
        });
    }
});

/**
 * Borra el contenido de todos los archivos .log del directorio de logs
 * POST /api/admin/clear-logs
 */
router.post('/api/admin/clear-logs', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const logsDir = path.join(__dirname, '../logs');
        const entries = await fs.readdir(logsDir);
        const logFiles = entries.filter(f => f.endsWith('.log')).map(f => path.join(logsDir, f));

        const results = [];
        for (const logFile of logFiles) {
            try {
                await fs.writeFile(logFile, '');
                results.push({ file: path.basename(logFile), cleared: true });
            } catch (err) {
                results.push({ file: path.basename(logFile), cleared: false, error: err.message });
            }
        }

        logger.info('Log files cleared by admin', { results, user: req.user });
        res.json({ success: true, results });
    } catch (error) {
        logger.error('Error clearing log files', { error: error.message });
        res.status(500).json({ success: false, error: 'Error al borrar los logs', code: 'CLEAR_LOGS_FAILED' });
    }
});

module.exports = router;
