/** @fileoverview Actualizaciones desde el panel: aviso de versión nueva (Docker Hub, comprobación cacheada una hora)
 *  y botón para que el contenedor «updater» descargue e instale la versión nueva. Solo administradores. */
'use strict';
const express = require('express');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const { activeGames, lobbyPlayers } = require('../state/globalState');
const GetActiveSessionsQuery = require('../application/queries/GetActiveSessionsQuery');
const { getUpdateInfo } = require('../services/update-check.service');
const { getUpdaterHealth, getUpdaterStatus, startUpdate } = require('../services/updater-client.service');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Cuenta sesiones activas
 * @returns {Promise<number>} Número de sesiones activas
 */
async function countActiveSessions() {
    const result = await new GetActiveSessionsQuery({}).execute({ activeGames, lobbyPlayers });
    return Array.isArray(result.sessions) ? result.sessions.length : 0;
}

/**
 * Verifica si se puede iniciar una actualización
 * @param {Object} req - Petición HTTP
 * @returns {Promise<Object>} Objeto con error o info de actualización
 */
async function checkCanStart(req) {
    const info = await getUpdateInfo();
    if (!info.updateAvailable) {
        return {
            error: {
                status: 409,
                body: { success: false, code: 'NO_UPDATE', error: 'No hay ninguna versión nueva' }
            }
        };
    }

    const updater = await getUpdaterHealth();
    if (!updater.available) {
        return {
            error: {
                status: 503,
                body: {
                    success: false,
                    code: 'UPDATER_UNAVAILABLE',
                    reason: updater.reason,
                    error: 'El actualizador no está disponible'
                }
            }
        };
    }

    const activeSessions = await countActiveSessions();
    if (activeSessions > 0 && (req.body || {}).force !== true) {
        return {
            error: {
                status: 409,
                body: { success: false, code: 'ACTIVE_SESSIONS', activeSessions, error: 'Hay partidas en curso' }
            }
        };
    }

    return { info };
}

/**
 * GET /api/admin/update/status
 * Devuelve información sobre actualizaciones disponibles y estado del updater
 */
router.get('/api/admin/update/status', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const force = req.query.refresh === '1';
        const [info, updater, activeSessions] = await Promise.all([
            getUpdateInfo({ force }),
            getUpdaterHealth(),
            countActiveSessions()
        ]);
        const progress = updater.available ? await getUpdaterStatus() : null;

        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            ...info,
            mode: updater.available ? 'button' : 'manual',
            updaterReason: updater.reason,
            updaterDetail: updater.detail,
            activeSessions,
            progress
        });
    } catch (err) {
        logger.error('Error en GET /api/admin/update/status', { error: err.message });
        res.status(500).json({
            success: false,
            code: 'UPDATE_STATUS_FAILED',
            error: 'No se pudo comprobar si hay actualizaciones'
        });
    }
});

/**
 * GET /api/admin/update/progress
 * Devuelve el progreso actual de una actualización en curso
 */
router.get('/api/admin/update/progress', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json({ success: true, progress: await getUpdaterStatus() });
    } catch (err) {
        logger.error('Error en GET /api/admin/update/progress', { error: err.message });
        res.status(500).json({
            success: false,
            code: 'UPDATE_PROGRESS_FAILED',
            error: 'No se pudo obtener el progreso de actualización'
        });
    }
});

/**
 * POST /api/admin/update/start
 * Inicia una actualización del backend
 */
router.post('/api/admin/update/start', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const checkResult = await checkCanStart(req);
        if (checkResult.error) {
            return res.status(checkResult.error.status).json(checkResult.error.body);
        }

        const { info } = checkResult;
        const result = await startUpdate(info.latest);

        if (!result.ok) {
            return res.status(result.status === 409 ? 409 : 502).json({
                success: false,
                code: result.status === 409 ? 'UPDATE_RUNNING' : 'UPDATER_ERROR',
                error: result.error || 'El actualizador no aceptó la petición'
            });
        }

        logger.info('Actualización iniciada desde el panel', {
            from: info.current,
            to: info.latest,
            user: req.user && req.user.username,
            activeSessions: await countActiveSessions()
        });

        res.status(202).json({ success: true, targetVersion: info.latest });
    } catch (err) {
        logger.error('Error en POST /api/admin/update/start', { error: err.message });
        res.status(500).json({
            success: false,
            code: 'UPDATE_START_FAILED',
            error: 'No se pudo iniciar la actualización'
        });
    }
});

module.exports = router;
