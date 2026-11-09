/**
 * @fileoverview Eliminación de la cuenta del administrador: solicitud (con confirmación por email)
 * y confirmación con token de un solo uso. Montado desde routes/admin.routes.js.
 * Las rutas, los códigos y las respuestas no cambian.
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { accountMutationLimiter } = require('../middlewares/security');
const logger = require('../config/logger');
const adminUserService = require('../services/db/admin-user.service');
const adminDeletionTokenService = require('../services/db/admin-deletion-token.service');
const { sendAdminDeletionConfirmationEmail } = require('../services/auth/admin-registration-email.service');
const { verifyPassword } = require('../services/auth/password-hasher');
const { buildCookieOptions, resolvePublicBaseUrl, sendFailure } = require('./helpers/admin-auth-helpers');

const router = express.Router();

async function sendDeletionConfirmation(user) {
    const pending = await adminDeletionTokenService.createPendingDeletion({ userId: user.id });
    const confirmationUrl = `${resolvePublicBaseUrl()}/api/admin/account/delete/confirm?token=${encodeURIComponent(pending.token)}`;

    await sendAdminDeletionConfirmationEmail({
        to: user.email,
        username: user.username,
        confirmationUrl
    });
}

/**
 * Solicita borrado de cuenta (requiere confirmación por email)
 */
router.post('/api/admin/account/delete/request', authenticateAdmin, accountMutationLimiter, async (req, res) => {
    const userId = req.user?.userId;
    const { currentPassword } = req.body;

    if (!userId) {
        return sendFailure(res, 401, 'Sesión inválida. Vuelve a iniciar sesión.', 'ADMIN_SESSION_INVALID');
    }

    if (!currentPassword) {
        return sendFailure(
            res, 400, 'La contraseña es requerida para eliminar la cuenta.', 'PASSWORD_REQUIRED_FOR_DELETION'
        );
    }

    try {
        const user = await adminUserService.getActiveUserById(userId);
        if (!user) {
            return sendFailure(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
        }

        const passwordOk = await verifyPassword(currentPassword, user.password_hash);
        if (!passwordOk) {
            return sendFailure(res, 400, 'La contraseña actual no es correcta', 'CURRENT_PASSWORD_INCORRECT');
        }

        const activeAdminCount = (await adminUserService.listUsers()).filter(
            u => u.role === 'admin' && u.is_active
        ).length;
        if (user.role === 'admin' && activeAdminCount <= 1) {
            return sendFailure(
                res, 400, 'No puedes eliminar el último administrador activo', 'CANNOT_REMOVE_LAST_ADMIN'
            );
        }

        await sendDeletionConfirmation(user);

        logger.auth('Admin panel deletion requested', {
            userId: user.id,
            email: user.email,
            ip: req.ip
        });

        return res.status(202).json({
            success: true,
            requiresConfirmation: true,
            message: 'Hemos enviado un enlace de confirmación a tu correo.',
            code: 'DELETION_CONFIRMATION_SENT'
        });
    } catch (error) {
        if (error.code === 'SMTP_NOT_CONFIGURED') {
            return sendFailure(
                res, 500, 'El correo SMTP no está configurado. Contacta con un administrador.', 'SMTP_NOT_CONFIGURED'
            );
        }

        logger.error('Admin deletion request failed', { error: error.message, userId, ip: req.ip });
        return sendFailure(res, 500, 'No se pudo solicitar la eliminación de la cuenta', 'DELETION_REQUEST_FAILED');
    }
});

/**
 * Confirma eliminación de cuenta con token de un solo uso
 */
router.get('/api/admin/account/delete/confirm', async (req, res) => {
    const token = String(req.query.token || '').trim();

    if (!token) {
        return res.status(400).send('Token de confirmación inválido');
    }

    try {
        const result = await adminDeletionTokenService.consumeDeletionToken(token);

        logger.auth('Admin panel user deleted via email confirmation', {
            userId: result.user.id,
            email: result.user.email
        });

        res.clearCookie('adminToken', buildCookieOptions());
        return res.redirect('/account-deleted.html');
    } catch (error) {
        if (['TOKEN_INVALID', 'TOKEN_EXPIRED', 'TOKEN_ALREADY_USED'].includes(error.code)) {
            return res.status(400).send('El enlace de confirmación no es válido o ha expirado.');
        }

        logger.error('Admin deletion confirmation failed', { error: error.message });
        return res.status(500).send('No se pudo confirmar la eliminación de la cuenta.');
    }
});

module.exports = router;
