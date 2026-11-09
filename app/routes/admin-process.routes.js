/**
 * @fileoverview Control de procesos PM2 desde el panel de administración: reinicio completo del
 * contenedor (panic-restart) y recarga suave de los workers (reload-server).
 * Montado desde routes/admin.routes.js. Las rutas, los códigos y las respuestas no cambian.
 */

const express = require('express');
const { exec } = require('child_process');
const { panicRestartLimiter } = require('../middlewares/security');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Endpoint para reiniciar el contenedor Docker completo - SOLO ADMIN
 * Estrategia: pm2 kill mata el daemon PM2 → pm2-runtime (proceso principal del
 * contenedor) termina → Docker lo reinicia automáticamente por restart: unless-stopped.
 */
router.post('/api/panic-restart', panicRestartLimiter, authenticateAdmin, authorizeAdmin, (req, res) => {
    logger.warn('PANIC RESTART (full container restart) triggered by admin', {
        role: req.user.role,
        user: req.user.username
    });

    // Responder inmediatamente antes de matar el proceso
    res.json({
        success: true,
        message: 'Killing PM2 daemon. Docker will restart the container automatically in a few seconds.',
        code: 'PANIC_RESTART_TRIGGERED'
    });

    // Dar tiempo para que la respuesta HTTP se envíe
    setTimeout(() => {
        logger.info('Executing pm2 kill to trigger full container restart...');

        exec('pm2 kill', (error, stdout, stderr) => {
            // pm2 kill termina el daemon y todos los workers;
            // el proceso pm2-runtime muere y Docker reinicia el contenedor.
            // Es normal que este callback no llegue a ejecutarse.
            if (error) {
                logger.error('pm2 kill failed', {
                    error: error.message,
                    stderr: stderr?.trim(),
                    code: error.code
                });
                return;
            }
            logger.info('pm2 kill completed', { stdout: stdout?.trim() });
        });
    }, 200);
});

/**
 * Endpoint para recarga suave del servidor (pm2 reload all)
 * A diferencia de panic-restart, no mata Docker: recarga los workers uno a uno.
 */
router.post('/api/admin/reload-server', panicRestartLimiter, authenticateAdmin, authorizeAdmin, (req, res) => {
    logger.warn('Soft server reload triggered by admin', { user: req.user.username });
    res.json({ success: true, message: 'Recargando workers PM2...', code: 'SOFT_RELOAD_TRIGGERED' });
    setTimeout(() => {
        exec('pm2 reload all', (error, stdout, stderr) => {
            if (error) {
                logger.error('pm2 reload failed', { error: error.message, stderr: stderr?.trim() });
                return;
            }
            logger.info('pm2 reload completed', { stdout: stdout?.trim() });
        });
    }, 200);
});

module.exports = router;
