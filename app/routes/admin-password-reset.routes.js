/**
 * @fileoverview Rutas de recuperación de contraseña para el panel admin
 * Endpoint separado para no saturar admin.routes.js
 */

const express = require('express');
const { loginLimiter } = require('../middlewares/security');
const { schemas, validateBody } = require('../validation');
const logger = require('../config/logger');
const { SERVER_HOST } = require('../config/constants');
const adminUserService = require('../services/db/admin-user.service');
const passwordResetTokenService = require('../services/db/admin-password-reset-token.service');
const { sendAdminPasswordResetEmail } = require('../services/auth/admin-registration-email.service');
const { hashPassword } = require('../services/auth/password-hasher');

const router = express.Router();

function resolvePublicBaseUrl() {
    // Si llega una lista separada por comas (estilo CORS_ORIGIN), usar la primera
    const rawBaseUrl = String(process.env.PUBLIC_BASE_URL || SERVER_HOST || '')
        .split(',')[0]
        .trim();
    const fallbackBaseUrl = 'https://xiro.pro';
    const withProtocol = /^https?:\/\//i.test(rawBaseUrl)
        ? rawBaseUrl
        : `https://${rawBaseUrl || 'xiro.pro'}`;

    try {
        const parsedUrl = new URL(withProtocol);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('Invalid protocol');
        }
        return parsedUrl.origin;
    } catch (_error) {
        logger.warn('Invalid PUBLIC_BASE_URL/SERVER_HOST configuration. Using fallback URL.', {
            fallbackBaseUrl
        });
        return fallbackBaseUrl;
    }
}

const GENERIC_REQUEST_MESSAGE = 'Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.';

/**
 * Solicita el restablecimiento de contraseña (requiere confirmación por email).
 * Responde siempre el mismo mensaje genérico exista o no la cuenta, para no
 * permitir enumeración de usuarios por email.
 */
router.post('/api/admin-password-reset/request', loginLimiter, validateBody(schemas.passwordResetRequest), async (req, res) => {
    const { email } = req.body;

    try {
        const user = await adminUserService.getActiveUserByEmail(email);

        if (user) {
            const pending = await passwordResetTokenService.createPendingPasswordReset({
                userId: user.id
            });

            const resetUrl = `${resolvePublicBaseUrl()}/admin.html?reset_token=${encodeURIComponent(pending.token)}`;

            await sendAdminPasswordResetEmail({
                to: user.email,
                username: user.username,
                resetUrl
            });

            logger.auth('Admin panel password reset requested', {
                userId: user.id,
                ip: req.ip
            });
        }

        return res.status(202).json({
            success: true,
            message: GENERIC_REQUEST_MESSAGE,
            code: 'PASSWORD_RESET_REQUEST_SENT'
        });
    } catch (error) {
        if (error.code === 'SMTP_NOT_CONFIGURED') {
            return res.status(500).json({
                success: false,
                error: 'El correo SMTP no está configurado. Contacta con un administrador.',
                code: 'SMTP_NOT_CONFIGURED'
            });
        }

        logger.error('Admin password reset request failed', { error: error.message, ip: req.ip });
        return res.status(500).json({
            success: false,
            error: 'No se pudo procesar la solicitud de restablecimiento',
            code: 'PASSWORD_RESET_REQUEST_FAILED'
        });
    }
});

/**
 * Confirma el restablecimiento de contraseña con token de un solo uso.
 */
router.post('/api/admin-password-reset/confirm', loginLimiter, validateBody(schemas.passwordResetConfirm), async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const newPasswordHash = await hashPassword(newPassword);
        const user = await passwordResetTokenService.consumePasswordResetToken(token, newPasswordHash);

        logger.auth('Admin panel password reset confirmed', {
            userId: user.id,
            ip: req.ip
        });

        return res.json({
            success: true,
            message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
            code: 'PASSWORD_RESET_CONFIRMED'
        });
    } catch (error) {
        if (['TOKEN_INVALID', 'TOKEN_EXPIRED', 'TOKEN_ALREADY_USED'].includes(error.code)) {
            return res.status(400).json({
                success: false,
                error: 'El enlace de restablecimiento no es válido o ha expirado',
                code: 'CONFIRMATION_LINK_EXPIRED'
            });
        }

        logger.error('Admin password reset confirmation failed', { error: error.message, ip: req.ip });
        return res.status(500).json({
            success: false,
            error: 'No se pudo restablecer la contraseña',
            code: 'PASSWORD_RESET_CONFIRM_FAILED'
        });
    }
});

module.exports = router;
