/**
 * @fileoverview Rutas de administración (login, panic restart)
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { JWT_SECRET, JWT_EXPIRES_IN, SERVER_HOST } = require('../config/constants');
const { loginLimiter, resetLoginLimiter, panicRestartLimiter, accountMutationLimiter } = require('../middlewares/security');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const { schemas, validateBody } = require('../validation');
const logger = require('../config/logger');
const { pool } = require('../config/database');
const { questionBankCache } = require('../services/cache.service');
const pinCache = require('../services/pin-cache.service');
const { getCompleteMetrics } = require('../services/db-metrics.service');
const { checkDatabaseHealth } = require('../services/health-check.service');
const cacheMetricsService = require('../services/CacheMetricsService');
const AdminDisconnectService = require('../services/AdminDisconnectService');
const adminUserService = require('../services/db/admin-user.service');
const registrationTokenService = require('../services/db/admin-registration-token.service');
const emailChangeTokenService = require('../services/db/admin-email-change-token.service');
const adminDeletionTokenService = require('../services/db/admin-deletion-token.service');
const {
    sendAdminRegistrationConfirmationEmail,
    sendAdminEmailChangeConfirmationEmail,
    sendAdminEmailChangeAlertEmail,
    sendAdminDeletionConfirmationEmail
} = require('../services/auth/admin-registration-email.service');
const { hashPassword, verifyPassword } = require('../services/auth/password-hasher');

const router = express.Router();

function buildAuthToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username,
            role: user.role,
            timestamp: Date.now()
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Opciones estándar para la cookie de sesión admin (HttpOnly, Secure en prod).
 */
function buildCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000 // 12 h
    };
}

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

const PUBLIC_BASE_URL = resolvePublicBaseUrl();

/**
 * Estado de autenticación admin
 * Permite al frontend saber si debe mostrar el onboarding del primer admin.
 */
router.get('/api/admin-auth/status', loginLimiter, async (req, res) => {
    try {
        const hasUsers = await adminUserService.hasAnyUsers();
        res.json({
            success: true,
            hasUsers,
            setupRequired: !hasUsers
        });
    } catch (error) {
        logger.error('Error checking auth status', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'No se pudo verificar el estado de autenticación',
            code: 'ADMIN_AUTH_STATUS_FAILED'
        });
    }
});

/**
 * Información de la cuenta autenticada
 */
router.get('/api/admin/account/me', authenticateAdmin, async (req, res) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'Sesión inválida. Vuelve a iniciar sesión.',
            code: 'ADMIN_SESSION_INVALID'
        });
    }

    try {
        const user = await adminUserService.getActiveUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        return res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        logger.error('Error getting authenticated account', { error: error.message, userId });
        return res.status(500).json({
            success: false,
            error: 'No se pudo cargar la cuenta',
            code: 'ADMIN_ACCOUNT_LOAD_FAILED'
        });
    }
});

/**
 * Listado de usuarios del panel (solo admin)
 */
router.get('/api/admin/users', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const users = await adminUserService.listUsers();

        return res.json({
            success: true,
            users: users.map(user => ({
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                isActive: user.is_active,
                isVerified: user.is_verified,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            }))
        });
    } catch (error) {
        logger.error('Error listing admin users', { error: error.message, userId: req.user?.userId });
        return res.status(500).json({
            success: false,
            error: 'No se pudo cargar la lista de usuarios',
            code: 'ADMIN_USERS_LIST_FAILED'
        });
    }
});

/**
 * Elimina un usuario del panel (solo admin)
 */
router.delete('/api/admin/users/:userId', authenticateAdmin, authorizeAdmin, async (req, res) => {
    const targetUserId = Number.parseInt(req.params.userId, 10);
    const actorUserId = Number(req.user?.userId);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Identificador de usuario inválido',
            code: 'INVALID_USER_ID'
        });
    }

    if (targetUserId === actorUserId) {
        return res.status(400).json({
            success: false,
            error: 'No puedes eliminar tu propia cuenta',
            code: 'CANNOT_DELETE_OWN_ACCOUNT'
        });
    }

    try {
        const users = await adminUserService.listUsers();
        const targetUser = users.find(user => user.id === targetUserId);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        const activeAdminCount = users.filter(user => user.role === 'admin' && user.is_active).length;
        if (targetUser.role === 'admin' && targetUser.is_active && activeAdminCount <= 1) {
            return res.status(400).json({
                success: false,
                error: 'No puedes eliminar el último administrador activo',
                code: 'CANNOT_REMOVE_LAST_ADMIN'
            });
        }

        const deletedUser = await adminUserService.deleteUserById(targetUserId);
        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        logger.auth('Admin panel user deleted', {
            actorUserId,
            deletedUserId: deletedUser.id,
            deletedUsername: deletedUser.username,
            deletedRole: deletedUser.role,
            ip: req.ip
        });

        return res.json({
            success: true,
            message: 'Usuario eliminado correctamente',
            code: 'USER_DELETED'
        });
    } catch (error) {
        logger.error('Error deleting admin user', {
            error: error.message,
            actorUserId,
            targetUserId,
            ip: req.ip
        });

        return res.status(500).json({
            success: false,
            error: 'No se pudo eliminar el usuario',
            code: 'DELETE_USER_FAILED'
        });
    }
});

/**
 * Cambia el rol de un usuario del panel (solo admin)
 */
router.put('/api/admin/users/:userId/role', authenticateAdmin, authorizeAdmin, async (req, res) => {
    const targetUserId = Number.parseInt(req.params.userId, 10);
    const actorUserId = Number(req.user?.userId);
    const { role: newRole } = req.body;

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Identificador de usuario inválido',
            code: 'INVALID_USER_ID'
        });
    }

    if (!['admin', 'editor'].includes(newRole)) {
        return res.status(400).json({
            success: false,
            error: 'Rol inválido',
            code: 'INVALID_ROLE'
        });
    }

    if (targetUserId === actorUserId) {
        return res.status(400).json({
            success: false,
            error: 'No puedes cambiar tu propio rol',
            code: 'CANNOT_CHANGE_OWN_ROLE'
        });
    }

    try {
        const users = await adminUserService.listUsers();
        const targetUser = users.find(user => user.id === targetUserId);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        const activeAdminCount = users.filter(user => user.role === 'admin' && user.is_active).length;
        if (targetUser.role === 'admin' && newRole === 'editor' && activeAdminCount <= 1) {
            return res.status(400).json({
                success: false,
                error: 'No puedes degradar al último administrador activo',
                code: 'CANNOT_DEMOTE_LAST_ADMIN'
            });
        }

        const updatedUser = await adminUserService.updateUserRole(targetUserId, newRole);

        logger.auth('Admin panel user role changed', {
            actorUserId,
            targetUserId: updatedUser.id,
            targetUsername: updatedUser.username,
            oldRole: targetUser.role,
            newRole: updatedUser.role,
            ip: req.ip
        });

        return res.json({
            success: true,
            message: 'Rol actualizado correctamente',
            code: 'ROLE_UPDATED',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role
            }
        });
    } catch (error) {
        logger.error('Error changing admin user role', {
            error: error.message,
            actorUserId,
            targetUserId,
            newRole,
            ip: req.ip
        });

        return res.status(500).json({
            success: false,
            error: 'No se pudo cambiar el rol del usuario',
            code: 'CHANGE_ROLE_FAILED'
        });
    }
});

/**
 * Cambio de contraseña de la cuenta autenticada
 */
router.post('/api/admin/account/change-password', authenticateAdmin, accountMutationLimiter, validateBody(schemas.changePassword), async (req, res) => {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'Sesión inválida. Vuelve a iniciar sesión.',
            code: 'ADMIN_SESSION_INVALID'
        });
    }

    try {
        const user = await adminUserService.getActiveUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        const passwordOk = await verifyPassword(currentPassword, user.password_hash);
        if (!passwordOk) {
            return res.status(400).json({
                success: false,
                error: 'La contraseña actual no es correcta',
                code: 'CURRENT_PASSWORD_INCORRECT'
            });
        }

        const newPasswordHash = await hashPassword(newPassword);
        await adminUserService.updateUserPassword(user.id, newPasswordHash);

        logger.auth('Admin panel password changed', {
            userId: user.id,
            role: user.role,
            ip: req.ip
        });

        return res.json({
            success: true,
            message: 'Contraseña actualizada correctamente',
            code: 'PASSWORD_UPDATED'
        });
    } catch (error) {
        logger.error('Admin password change failed', { error: error.message, userId, ip: req.ip });
        return res.status(500).json({
            success: false,
            error: 'No se pudo cambiar la contraseña',
            code: 'CHANGE_PASSWORD_FAILED'
        });
    }
});

/**
 * Solicita cambio de correo (requiere confirmación por email)
 */
router.post('/api/admin/account/change-email/request', authenticateAdmin, accountMutationLimiter, validateBody(schemas.changeEmailRequest), async (req, res) => {
    const userId = req.user?.userId;
    const { currentPassword, newEmail } = req.body;

    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'Sesión inválida. Vuelve a iniciar sesión.',
            code: 'ADMIN_SESSION_INVALID'
        });
    }

    try {
        const user = await adminUserService.getActiveUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        const passwordOk = await verifyPassword(currentPassword, user.password_hash);
        if (!passwordOk) {
            return res.status(400).json({
                success: false,
                error: 'La contraseña actual no es correcta',
                code: 'CURRENT_PASSWORD_INCORRECT'
            });
        }

        const normalizedNewEmail = String(newEmail || '').trim().toLowerCase();
        if (normalizedNewEmail === String(user.email || '').trim().toLowerCase()) {
            return res.status(400).json({
                success: false,
                error: 'El nuevo correo debe ser distinto al actual',
                code: 'NEW_EMAIL_SAME_AS_CURRENT'
            });
        }

        const existingByEmail = await adminUserService.findUserByEmail(normalizedNewEmail);
        if (existingByEmail && existingByEmail.id !== user.id) {
            return res.status(409).json({
                success: false,
                error: 'El correo ya está en uso por otra cuenta',
                code: 'EMAIL_ALREADY_IN_USE'
            });
        }

        const pending = await emailChangeTokenService.createPendingEmailChange({
            userId: user.id,
            oldEmail: user.email,
            newEmail: normalizedNewEmail
        });

        const confirmationUrl = `${PUBLIC_BASE_URL}/admin.html?verify_email_token=${encodeURIComponent(pending.token)}`;

        await sendAdminEmailChangeConfirmationEmail({
            to: normalizedNewEmail,
            username: user.username,
            confirmationUrl
        });

        await sendAdminEmailChangeAlertEmail({
            to: user.email,
            username: user.username,
            newEmail: normalizedNewEmail
        });

        logger.auth('Admin panel email change requested', {
            userId: user.id,
            oldEmail: user.email,
            newEmail: normalizedNewEmail,
            ip: req.ip
        });

        return res.status(202).json({
            success: true,
            requiresConfirmation: true,
            message: 'Hemos enviado un enlace de confirmación al nuevo correo.',
            code: 'EMAIL_CHANGE_CONFIRMATION_SENT'
        });
    } catch (error) {
        if (error.code === 'SMTP_NOT_CONFIGURED') {
            return res.status(500).json({
                success: false,
                error: 'El correo SMTP no está configurado. Contacta con un administrador.',
                code: 'SMTP_NOT_CONFIGURED'
            });
        }

        logger.error('Admin email change request failed', { error: error.message, userId, ip: req.ip });
        return res.status(500).json({
            success: false,
            error: 'No se pudo solicitar el cambio de correo',
            code: 'EMAIL_CHANGE_REQUEST_FAILED'
        });
    }
});

/**
 * Confirma cambio de correo con token de un solo uso
 */
router.get('/api/admin/account/change-email/confirm', async (req, res) => {
    const token = String(req.query.token || '').trim();

    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Token de confirmación inválido',
            code: 'CONFIRMATION_TOKEN_INVALID'
        });
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
            return res.status(400).json({
                success: false,
                error: 'El enlace de confirmación no es válido o ha expirado',
                code: 'CONFIRMATION_LINK_EXPIRED'
            });
        }

        if (error.code === 'EMAIL_ALREADY_IN_USE') {
            return res.status(409).json({
                success: false,
                error: 'El correo ya está en uso por otra cuenta',
                code: 'EMAIL_ALREADY_IN_USE'
            });
        }

        logger.error('Admin email change confirmation failed', { error: error.message });
        return res.status(500).json({
            success: false,
            error: 'No se pudo confirmar el cambio de correo',
            code: 'EMAIL_CHANGE_CONFIRM_FAILED'
        });
    }
});

/**
 * Solicita borrado de cuenta (requiere confirmación por email)
 */
router.post('/api/admin/account/delete/request', authenticateAdmin, accountMutationLimiter, async (req, res) => {
    const userId = req.user?.userId;
    const { currentPassword } = req.body;

    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'Sesión inválida. Vuelve a iniciar sesión.',
            code: 'ADMIN_SESSION_INVALID'
        });
    }

    if (!currentPassword) {
        return res.status(400).json({
            success: false,
            error: 'La contraseña es requerida para eliminar la cuenta.',
            code: 'PASSWORD_REQUIRED_FOR_DELETION'
        });
    }

    try {
        const user = await adminUserService.getActiveUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        const passwordOk = await verifyPassword(currentPassword, user.password_hash);
        if (!passwordOk) {
            return res.status(400).json({
                success: false,
                error: 'La contraseña actual no es correcta',
                code: 'CURRENT_PASSWORD_INCORRECT'
            });
        }

        const activeAdminCount = (await adminUserService.listUsers()).filter(u => u.role === 'admin' && u.is_active).length;
        if (user.role === 'admin' && activeAdminCount <= 1) {
            return res.status(400).json({
                success: false,
                error: 'No puedes eliminar el último administrador activo',
                code: 'CANNOT_REMOVE_LAST_ADMIN'
            });
        }

        const pending = await adminDeletionTokenService.createPendingDeletion({
            userId: user.id
        });

        const confirmationUrl = `${PUBLIC_BASE_URL}/api/admin/account/delete/confirm?token=${encodeURIComponent(pending.token)}`;

        await sendAdminDeletionConfirmationEmail({
            to: user.email,
            username: user.username,
            confirmationUrl
        });

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
            return res.status(500).json({
                success: false,
                error: 'El correo SMTP no está configurado. Contacta con un administrador.',
                code: 'SMTP_NOT_CONFIGURED'
            });
        }

        logger.error('Admin deletion request failed', { error: error.message, userId, ip: req.ip });
        return res.status(500).json({
            success: false,
            error: 'No se pudo solicitar la eliminación de la cuenta',
            code: 'DELETION_REQUEST_FAILED'
        });
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

/**
 * Registro de usuarios del panel.
 * El primer usuario registrado se crea automáticamente con rol admin.
 */
router.post('/api/admin-register', loginLimiter, validateBody(schemas.register), async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const existing = await adminUserService.findExistingUserByUsernameOrEmail(username, email);

        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'El nombre de usuario o email ya existe',
                code: 'USERNAME_OR_EMAIL_TAKEN'
            });
        }

        const passwordHash = await hashPassword(password);

        // Atomic path for the very first account: no email confirmation required.
        const firstAdminUser = await adminUserService.createFirstAdminUser(username, email, passwordHash);

        if (firstAdminUser) {
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

        // Race guard: if another request just created this username/email, stop here.
        const existingAfterFirstAttempt = await adminUserService.findExistingUserByUsernameOrEmail(username, email);
        if (existingAfterFirstAttempt) {
            return res.status(409).json({
                success: false,
                error: 'El nombre de usuario o email ya existe',
                code: 'USERNAME_OR_EMAIL_TAKEN'
            });
        }

        const pending = await registrationTokenService.createPendingRegistration({
            username,
            email,
            passwordHash
        });

        const confirmationUrl = `${PUBLIC_BASE_URL}/admin.html?verify_token=${encodeURIComponent(pending.token)}`;
        await sendAdminRegistrationConfirmationEmail({
            to: email,
            username,
            confirmationUrl
        });

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
            return res.status(409).json({
                success: false,
                error: 'El nombre de usuario o email ya existe',
                code: 'USERNAME_OR_EMAIL_TAKEN'
            });
        }

        if (error.code === 'SMTP_NOT_CONFIGURED') {
            return res.status(500).json({
                success: false,
                error: 'El correo SMTP no está configurado. Contacta con un administrador.',
                code: 'SMTP_NOT_CONFIGURED'
            });
        }

        logger.error('Admin panel registration failed', { error: error.message, ip: req.ip });
        return res.status(500).json({
            success: false,
            error: 'No se pudo registrar el usuario',
            code: 'REGISTER_FAILED'
        });
    }
});

router.get('/api/admin-register/confirm', async (req, res) => {
    const token = String(req.query.token || '').trim();

    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Token de confirmación inválido',
            code: 'CONFIRMATION_TOKEN_INVALID'
        });
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
            return res.status(400).json({
                success: false,
                error: 'El enlace de confirmación no es válido o ha expirado',
                code: 'CONFIRMATION_LINK_EXPIRED'
            });
        }

        if (error.code === 'USER_ALREADY_EXISTS') {
            return res.status(409).json({
                success: false,
                error: 'La cuenta ya existe o ya fue activada',
                code: 'ACCOUNT_ALREADY_EXISTS_OR_ACTIVE'
            });
        }

        logger.error('Registration confirmation failed', { error: error.message });
        return res.status(500).json({
            success: false,
            error: 'No se pudo confirmar la cuenta',
            code: 'REGISTRATION_CONFIRM_FAILED'
        });
    }
});

/**
 * Endpoint de login con JWT y rate limiting
 */
router.post('/api/admin-login', loginLimiter, validateBody(schemas.login), async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await adminUserService.getActiveUserByUsername(username);

        if (!user) {
            logger.security('Login failed - unknown user', { username, ip: req.ip });
            return res.status(401).json({
                success: false,
                error: 'Usuario o contraseña incorrectos',
                code: 'ADMIN_LOGIN_INVALID_CREDENTIALS'
            });
        }

        const passwordOk = await verifyPassword(password, user.password_hash);
        if (!passwordOk) {
            logger.security('Login failed - invalid password', { userId: user.id, ip: req.ip });
            return res.status(401).json({
                success: false,
                error: 'Usuario o contraseña incorrectos',
                code: 'ADMIN_LOGIN_INVALID_CREDENTIALS'
            });
        }

        const token = buildAuthToken(user);

        logger.auth('Login successful', { userId: user.id, role: user.role, ip: req.ip });

        resetLoginLimiter(req);

        res.cookie('adminToken', token, buildCookieOptions());
        return res.json({
            success: true,
            token,
            role: user.role,
            username: user.username,
            expiresIn: JWT_EXPIRES_IN
        });
    } catch (error) {
        logger.error('Admin login failed unexpectedly', { error: error.message, ip: req.ip });
        return res.status(500).json({
            success: false,
            error: 'Error interno durante el login',
            code: 'ADMIN_LOGIN_INTERNAL_ERROR'
        });
    }
});

/**
 * Cierra la sesión del admin eliminando la cookie HttpOnly.
 * No requiere autenticación: solo limpia la cookie.
 */
router.post('/api/admin-logout', (req, res) => {
    res.clearCookie('adminToken', buildCookieOptions());
    logger.auth('Admin logout', { ip: req.ip });
    return res.json({ success: true });
});

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

/**
 * Endpoint para listar archivos JSON disponibles en /data/
 */
router.get('/api/banks/list-files', async (req, res) => {
    try {
        const dataDir = path.join(__dirname, '../public/data');
        const files = await fs.readdir(dataDir);

        // Filtrar solo archivos .json válidos, excluyendo schema.json y archivos temporales
        const jsonFiles = files
            .filter(file =>
                file.endsWith('.json') &&
                file !== 'schema.json' &&
                !file.startsWith('.') &&
                !file.startsWith('._')
            )
            .map(file => ({
                filename: file,
                path: `data/${file}`,
                name: file.replace('.json', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            }));

        res.json({ success: true, files: jsonFiles });
    } catch (error) {
        logger.error('Error listing JSON files', { error: error.message });
        res.status(500).json({ success: false, error: 'Error al listar archivos', code: 'LIST_FILES_FAILED' });
    }
});

/**
 * Endpoint para limpiar archivos huérfanos en /uploads/ - SOLO ADMIN
 */
router.post('/api/uploads/cleanup', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, '../public/uploads');

        // Obtener todos los archivos en uploads
        const files = await fs.readdir(uploadsDir);

        // Filtrar archivos (excluir .gitignore y directorios)
        const uploadedFiles = [];
        for (const file of files) {
            if (file === '.gitignore') continue;

            const filePath = path.join(uploadsDir, file);
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
                uploadedFiles.push(file);
            }
        }

        // Obtener todos los archivos referenciados en la base de datos (4 fuentes)
        const [questionsResult, slidesResult, questionImagesResult, optionImagesResult] = await Promise.all([
            pool.query('SELECT DISTINCT url_recurso AS ref FROM questions WHERE url_recurso IS NOT NULL'),
            pool.query('SELECT DISTINCT slide_image AS ref FROM custom_game_questions WHERE slide_image IS NOT NULL'),
            pool.query('SELECT DISTINCT question_image_url AS ref FROM questions WHERE question_image_url IS NOT NULL'),
            pool.query('SELECT DISTINCT option_image_url AS ref FROM options WHERE option_image_url IS NOT NULL')
        ]);

        const referencedFiles = new Set();
        [...questionsResult.rows, ...slidesResult.rows, ...questionImagesResult.rows, ...optionImagesResult.rows].forEach(row => {
            if (row.ref) {
                // Extraer el nombre del archivo de la URL (formato: /uploads/filename)
                const filename = row.ref.replace('/uploads/', '');
                referencedFiles.add(filename);
            }
        });

        // Identificar archivos huérfanos
        const orphanedFiles = uploadedFiles.filter(file => !referencedFiles.has(file));

        // Eliminar archivos huérfanos
        const deletedFiles = [];
        for (const file of orphanedFiles) {
            const filePath = path.join(uploadsDir, file);
            await fs.unlink(filePath);
            deletedFiles.push(file);
            logger.info('Orphaned file deleted', { file, admin: req.user.role });
        }

        res.json({
            success: true,
            deleted: deletedFiles.length,
            files: deletedFiles,
            message: `${deletedFiles.length} archivo(s) huérfano(s) eliminado(s)`,
            code: 'ORPHANED_FILES_CLEANED',
            params: { count: deletedFiles.length }
        });
    } catch (error) {
        logger.error('Error cleaning orphaned files', { error: error.message });
        res.status(500).json({ success: false, error: 'Error al limpiar archivos huérfanos', code: 'CLEANUP_ORPHANED_FILES_FAILED' });
    }
});

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
router.post('/api/admin/clear-cache', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        // Obtener stats antes de limpiar (de este worker)
        const statsBeforeQuestions = questionBankCache.getStats();
        const statsPinBefore = pinCache.getStats();

        // Limpiar caché en este worker inmediatamente
        questionBankCache.invalidateAll();
        pinCache.clear();

        // Propagar a todos los demás workers vía Redis pub/sub
        const { RedisSyncBus } = require('../sockets/sync/RedisSyncBus');
        const redisSyncBus = RedisSyncBus.getInstance();
        try {
            await redisSyncBus.publish('cache-invalidate-all', { originWorkerId: process.pid });
        } catch (redisErr) {
            logger.warn('Redis broadcast for cache-invalidate-all failed (solo se limpió este worker)', { error: redisErr.message });
        }

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
            return res.status(403).json({
                success: false,
                error: 'Este endpoint solo está disponible en modo desarrollo',
                code: 'DEV_ONLY_ENDPOINT'
            });
        }

        const { action, pin, nickname } = req.body;

        // Validar parámetros
        if (!action || !pin) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: action, pin',
                code: 'MISSING_REQUIRED_PARAMS'
            });
        }

        if (!['disconnect', 'disconnect-all', 'list'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'Action inválido. Usar: disconnect, disconnect-all, list',
                code: 'INVALID_ACTION'
            });
        }

        if (action === 'disconnect' && !nickname) {
            return res.status(400).json({
                success: false,
                error: 'Nickname requerido para action=disconnect',
                code: 'NICKNAME_REQUIRED'
            });
        }

        // Obtener io desde app
        const io = req.app.get('io');
        if (!io) {
            return res.status(500).json({
                success: false,
                error: 'Socket.IO no está inicializado',
                code: 'SOCKET_IO_NOT_INITIALIZED'
            });
        }

        const disconnectService = new AdminDisconnectService(io);

        let result;

        switch (action) {
            case 'disconnect':
                result = await disconnectService.disconnectPlayer(pin, nickname);
                break;

            case 'disconnect-all':
                result = await disconnectService.disconnectAll(pin);
                break;

            case 'list':
                result = await disconnectService.getConnectedPlayers(pin);
                break;
        }

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
        res.status(500).json({
            success: false,
            error: 'Error al procesar desconexión',
            code: 'FORCE_DISCONNECT_FAILED'
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
        const logFiles = entries
            .filter(f => f.endsWith('.log'))
            .map(f => path.join(logsDir, f));

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