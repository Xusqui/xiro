/**
 * @fileoverview Rutas de control remoto para administradores
 * Endpoint separado para no saturar admin.routes.js
 */

const express = require('express');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const { activeGames, lobbyPlayers } = require('../state/globalState');
const GetActiveSessionsQuery = require('../application/queries/GetActiveSessionsQuery');
const { terminateExpiredPresenterSession } = require('../sockets/utils/GameUtils');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/admin/active-sessions
 * Devuelve la lista de juegos en curso y lobbys con jugadores.
 * Requiere JWT con rol admin.
 */
router.get(
    '/api/admin/active-sessions',
    authenticateAdmin,
    authorizeAdmin,
    async (req, res, next) => {
        try {
            const query = new GetActiveSessionsQuery({});
            const result = await query.execute({ activeGames, lobbyPlayers });
            res.json(result);
        } catch (err) {
            logger.error('Error in GET /api/admin/active-sessions', { error: err.message });
            next(err);
        }
    }
);

/**
 * POST /api/admin/terminate-session
 * Fuerza el cierre inmediato de una sesión activa (juego o lobby).
 * Notifica a todos los jugadores, limpia el estado y sincroniza workers.
 * Requiere JWT con rol admin.
 * Body: { sessionId: string }
 */
router.post(
    '/api/admin/terminate-session',
    authenticateAdmin,
    authorizeAdmin,
    async (req, res, next) => {
        try {
            const { sessionId } = req.body;
            if (!sessionId || typeof sessionId !== 'string') {
                return res.status(400).json({ success: false, error: 'sessionId requerido', code: 'SESSION_ID_REQUIRED' });
            }

            const io = req.app.get('io');
            if (!io) {
                return res.status(500).json({ success: false, error: 'Socket.IO no disponible', code: 'SOCKET_IO_NOT_INITIALIZED' });
            }

            const inMemory = activeGames.has(sessionId) || lobbyPlayers.has(sessionId);

            logger.warn('Admin force-terminate session', {
                sessionId,
                inMemory,
                admin: req.user?.role
            });

            await terminateExpiredPresenterSession(sessionId, io);

            res.json({
                success: true,
                message: `Sesión ${sessionId} terminada`,
                code: 'SESSION_TERMINATED',
                params: { sessionId },
                sessionId
            });
        } catch (err) {
            logger.error('Error in POST /api/admin/terminate-session', { error: err.message });
            next(err);
        }
    }
);

module.exports = router;
