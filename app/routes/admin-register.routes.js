/**
 * @fileoverview Registro de usuarios del panel de administración: alta (el primer usuario queda activo
 * como admin; los siguientes reciben un correo de confirmación) y confirmación con token de un solo uso.
 * Montado desde routes/admin.routes.js. Las rutas, los códigos y las respuestas no cambian.
 */

const express = require('express');
const { JWT_EXPIRES_IN } = require('../config/constants');
const { LEGAL_TERMS_VERSION } = require('../config/legal');
const { loginLimiter } = require('../middlewares/security');
const { schemas, validateBody } = require('../validation');
const logger = require('../config/logger');
const adminUserService = require('../services/db/admin-user.service');
const registrationTokenService = require('../services/db/admin-registration-token.service');
const { sendAdminRegistrationConfirmationEmail } = require('../services/auth/admin-registration-email.service');
const { hashPassword } = require('../services/auth/password-hasher');
const {
    buildAuthToken,
    buildCookieOptions,
    resolvePublicBaseUrl,
    sendFailure
} = require('./helpers/admin-auth-helpers');

const router = express.Router();

function respondFirstAdminCreated(req, res, firstAdminUser) {
    const token = buildAuthToken(firstAdminUser);

    logger.auth('First admin user registered', {
        userId: firstAdminUser.id,
        role: firstAdminUser.role,
        ip: req.ip
    });

    res.cookie('adminToken', token, buildCookieOptions());
    return res.status(201).json({
        success: true,
        token,
        role: firstAdminUser.role,
        username: firstAdminUser.username,
        email: firstAdminUser.email,
        expiresIn: JWT_EXPIRES_IN,
        isFirstUser: true
    });
}

async function sendRegistrationConfirmation({ username, email, passwordHash }) {
    const pending = await registrationTokenService.createPendingRegistration({
        username,
        email,
        passwordHash,
        termsVersion: LEGAL_TERMS_VERSION
    });
    const confirmationUrl = `${resolvePublicBaseUrl()}/admin.html?verify_token=${encodeURIComponent(pending.token)}`;

    await sendAdminRegistrationConfirmationEmail({ to: email, username, confirmationUrl });
}

/**
 * Registro de usuarios del panel.
 * El primer usuario registrado se crea automáticamente con rol admin.
 */
router.post('/api/admin-register', loginLimiter, validateBody(schemas.register), async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const existing = await adminUserService.findExistingUserByUsernameOrEmail(username, email);

        if (existing) {
            return sendFailure(res, 409, 'El nombre de usuario o email ya existe', 'USERNAME_OR_EMAIL_TAKEN');
        }

        const passwordHash = await hashPassword(password);

        // Atomic path for the very first account: no email confirmation required.
        const firstAdminUser = await adminUserService.createFirstAdminUser(
            username,
            email,
            passwordHash,
            LEGAL_TERMS_VERSION
        );

        if (firstAdminUser) {
            return respondFirstAdminCreated(req, res, firstAdminUser);
        }

        // Race guard: if another request just created this username/email, stop here.
        const existingAfterFirstAttempt = await adminUserService.findExistingUserByUsernameOrEmail(username, email);
        if (existingAfterFirstAttempt) {
            return sendFailure(res, 409, 'El nombre de usuario o email ya existe', 'USERNAME_OR_EMAIL_TAKEN');
        }

        await sendRegistrationConfirmation({ username, email, passwordHash });

        logger.auth('Admin panel registration email sent', {
            username,
            email,
            ip: req.ip
        });

        return res.status(202).json({
            success: true,
            requiresConfirmation: true,
            message: 'Te hemos enviado un correo de confirmación para activar tu cuenta.',
            code: 'REGISTRATION_CONFIRMATION_SENT'
        });
    } catch (error) {
        if (error.code === 'USERNAME_TAKEN' || error.code === 'USER_ALREADY_EXISTS') {
            return sendFailure(res, 409, 'El nombre de usuario o email ya existe', 'USERNAME_OR_EMAIL_TAKEN');
        }

        if (error.code === 'SMTP_NOT_CONFIGURED') {
            return sendFailure(
                res, 500, 'El correo SMTP no está configurado. Contacta con un administrador.', 'SMTP_NOT_CONFIGURED'
            );
        }

        logger.error('Admin panel registration failed', { error: error.message, ip: req.ip });
        return sendFailure(res, 500, 'No se pudo registrar el usuario', 'REGISTER_FAILED');
    }
});

router.get('/api/admin-register/confirm', async (req, res) => {
    const token = String(req.query.token || '').trim();

    if (!token) {
        return sendFailure(res, 400, 'Token de confirmación inválido', 'CONFIRMATION_TOKEN_INVALID');
    }

    try {
        const user = await registrationTokenService.consumeRegistrationToken(token);

        logger.auth('Admin panel user confirmed by email', {
            userId: user.id,
            username: user.username,
            role: user.role
        });

        return res.json({
            success: true,
            message: 'Cuenta confirmada. Ya puedes iniciar sesión.',
            code: 'REGISTRATION_CONFIRMED',
            username: user.username
        });
    } catch (error) {
        if (['TOKEN_INVALID', 'TOKEN_EXPIRED', 'TOKEN_ALREADY_USED'].includes(error.code)) {
            return sendFailure(
                res, 400, 'El enlace de confirmación no es válido o ha expirado', 'CONFIRMATION_LINK_EXPIRED'
            );
        }

        if (error.code === 'USER_ALREADY_EXISTS') {
            return sendFailure(res, 409, 'La cuenta ya existe o ya fue activada', 'ACCOUNT_ALREADY_EXISTS_OR_ACTIVE');
        }

        logger.error('Registration confirmation failed', { error: error.message });
        return sendFailure(res, 500, 'No se pudo confirmar la cuenta', 'REGISTRATION_CONFIRM_FAILED');
    }
});

module.exports = router;
