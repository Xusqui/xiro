/**
 * @fileoverview Cambio de correo de la cuenta del administrador: solicitud (con confirmación por email
 * al nuevo correo y aviso al actual) y confirmación con token de un solo uso.
 * Montado desde routes/admin.routes.js. Las rutas, los códigos y las respuestas no cambian.
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { accountMutationLimiter } = require('../middlewares/security');
const { schemas, validateBody } = require('../validation');
const logger = require('../config/logger');
const adminUserService = require('../services/db/admin-user.service');
const emailChangeTokenService = require('../services/db/admin-email-change-token.service');
const {
    sendAdminEmailChangeConfirmationEmail,
    sendAdminEmailChangeAlertEmail
} = require('../services/auth/admin-registration-email.service');
const { verifyPassword } = require('../services/auth/password-hasher');
const { resolvePublicBaseUrl, sendFailure } = require('./helpers/admin-auth-helpers');

const router = express.Router();

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

function logEmailChangeRequested(user, newEmail, ip) {
    logger.auth('Admin panel email change requested', {
        userId: user.id,
        oldEmail: user.email,
        newEmail,
        ip
    });
}

async function sendEmailChangeMessages(user, newEmail) {
    const pending = await emailChangeTokenService.createPendingEmailChange({
        userId: user.id,
        oldEmail: user.email,
        newEmail
    });
    const confirmationUrl = `${resolvePublicBaseUrl()}/admin.html?verify_email_token=${encodeURIComponent(pending.token)}`;

    await sendAdminEmailChangeConfirmationEmail({ to: newEmail, username: user.username, confirmationUrl });
    await sendAdminEmailChangeAlertEmail({ to: user.email, username: user.username, newEmail });
}

/**
 * Solicita cambio de correo (requiere confirmación por email)
 */
router.post(
    '/api/admin/account/change-email/request',
    authenticateAdmin,
    accountMutationLimiter,
    validateBody(schemas.changeEmailRequest),
    async (req, res) => {
        const userId = req.user?.userId;
        const { currentPassword, newEmail } = req.body;

        if (!userId) {
            return sendFailure(res, 401, 'Sesión inválida. Vuelve a iniciar sesión.', 'ADMIN_SESSION_INVALID');
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

            const normalizedNewEmail = normalizeEmail(newEmail);
            if (normalizedNewEmail === normalizeEmail(user.email)) {
                return sendFailure(
                    res, 400, 'El nuevo correo debe ser distinto al actual', 'NEW_EMAIL_SAME_AS_CURRENT'
                );
            }

            const existingByEmail = await adminUserService.findUserByEmail(normalizedNewEmail);
            if (existingByEmail && existingByEmail.id !== user.id) {
                return sendFailure(res, 409, 'El correo ya está en uso por otra cuenta', 'EMAIL_ALREADY_IN_USE');
            }

            await sendEmailChangeMessages(user, normalizedNewEmail);

            logEmailChangeRequested(user, normalizedNewEmail, req.ip);

            return res.status(202).json({
                success: true,
                requiresConfirmation: true,
                message: 'Hemos enviado un enlace de confirmación al nuevo correo.',
                code: 'EMAIL_CHANGE_CONFIRMATION_SENT'
            });
        } catch (error) {
            if (error.code === 'SMTP_NOT_CONFIGURED') {
                return sendFailure(
                    res,
                    500,
                    'El correo SMTP no está configurado. Contacta con un administrador.',
                    'SMTP_NOT_CONFIGURED'
                );
            }

            logger.error('Admin email change request failed', { error: error.message, userId, ip: req.ip });
            return sendFailure(res, 500, 'No se pudo solicitar el cambio de correo', 'EMAIL_CHANGE_REQUEST_FAILED');
        }
    }
);

/**
 * Confirma cambio de correo con token de un solo uso
 */
router.get('/api/admin/account/change-email/confirm', async (req, res) => {
    const token = String(req.query.token || '').trim();

    if (!token) {
        return sendFailure(res, 400, 'Token de confirmación inválido', 'CONFIRMATION_TOKEN_INVALID');
    }

    try {
        const result = await emailChangeTokenService.consumeEmailChangeToken(token);

        logger.auth('Admin panel email change confirmed', {
            userId: result.user.id,
            oldEmail: result.oldEmail,
            newEmail: result.newEmail
        });

        return res.json({
            success: true,
            message: 'Correo actualizado correctamente. Ya puedes iniciar sesión con tu cuenta habitual.',
            code: 'EMAIL_CHANGE_CONFIRMED',
            email: result.user.email
        });
    } catch (error) {
        if (['TOKEN_INVALID', 'TOKEN_EXPIRED', 'TOKEN_ALREADY_USED'].includes(error.code)) {
            return sendFailure(
                res, 400, 'El enlace de confirmación no es válido o ha expirado', 'CONFIRMATION_LINK_EXPIRED'
            );
        }

        if (error.code === 'EMAIL_ALREADY_IN_USE') {
            return sendFailure(res, 409, 'El correo ya está en uso por otra cuenta', 'EMAIL_ALREADY_IN_USE');
        }

        logger.error('Admin email change confirmation failed', { error: error.message });
        return sendFailure(res, 500, 'No se pudo confirmar el cambio de correo', 'EMAIL_CHANGE_CONFIRM_FAILED');
    }
});

module.exports = router;
