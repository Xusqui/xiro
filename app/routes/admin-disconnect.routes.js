/**
 * @fileoverview Desconexión forzada de jugadores desde el panel de administración (solo modo desarrollo).
 * Montado desde routes/admin.routes.js. La ruta, los códigos y las respuestas no cambian.
 */

const express = require('express');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const AdminDisconnectService = require('../services/AdminDisconnectService');
const logger = require('../config/logger');

const { sendFailure } = require('./helpers/admin-auth-helpers');

const router = express.Router();

function runDisconnectAction(disconnectService, { action, pin, nickname }) {
    if (action === 'disconnect') return disconnectService.disconnectPlayer(pin, nickname);
    if (action === 'disconnect-all') return disconnectService.disconnectAll(pin);
    return disconnectService.getConnectedPlayers(pin);
}

/**
 * Endpoint para desconexión forzada de jugadores (reemplaza disconnect-helper.js)
 * POST /api/admin/force-disconnect
 * Requiere: autenticación admin (dev mode)
 * Body: {action: 'disconnect'|'disconnect-all'|'list', pin: string, nickname?: string}
 *
 * IMPORTANTE: Solo funciona en modo desarrollo
 * SEGURIDAD: Usar con precaución, afecta jugadores reales
 */
router.post('/api/admin/force-disconnect', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        // Verificar modo desarrollo
        if (process.env.NODE_ENV === 'production') {
            return sendFailure(res, 403, 'Este endpoint solo está disponible en modo desarrollo', 'DEV_ONLY_ENDPOINT');
        }

        const { action, pin, nickname } = req.body;

        // Validar parámetros
        if (!action || !pin) {
            return sendFailure(res, 400, 'Parámetros requeridos: action, pin', 'MISSING_REQUIRED_PARAMS');
        }

        if (!['disconnect', 'disconnect-all', 'list'].includes(action)) {
            return sendFailure(res, 400, 'Action inválido. Usar: disconnect, disconnect-all, list', 'INVALID_ACTION');
        }

        if (action === 'disconnect' && !nickname) {
            return sendFailure(res, 400, 'Nickname requerido para action=disconnect', 'NICKNAME_REQUIRED');
        }

        // Obtener io desde app
        const io = req.app.get('io');
        if (!io) {
            return sendFailure(res, 500, 'Socket.IO no está inicializado', 'SOCKET_IO_NOT_INITIALIZED');
        }

        const disconnectService = new AdminDisconnectService(io);

        const result = await runDisconnectAction(disconnectService, { action, pin, nickname });

        logger.info('Force disconnect action', {
            action,
            pin,
            nickname,
            result: result.success,
            user: req.user
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        logger.error('Error in force-disconnect endpoint', {
            error: error.message,
            stack: error.stack
        });
        sendFailure(res, 500, 'Error al procesar desconexión', 'FORCE_DISCONNECT_FAILED');
    }
});

module.exports = router;
