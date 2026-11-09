/**
 * @fileoverview Cuenta del administrador autenticado: consulta de perfil y cambio de contraseña.
 * Montado desde routes/admin.routes.js. Las rutas, los códigos y las respuestas no cambian.
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { accountMutationLimiter } = require('../middlewares/security');
const { schemas, validateBody } = require('../validation');
const logger = require('../config/logger');
const adminUserService = require('../services/db/admin-user.service');
const { hashPassword, verifyPassword } = require('../services/auth/password-hasher');

const router = express.Router();

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
 * Cambio de contraseña de la cuenta autenticada
 */
router.post(
    '/api/admin/account/change-password',
    authenticateAdmin,
    accountMutationLimiter,
    validateBody(schemas.changePassword),
    async (req, res) => {
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
    }
);

module.exports = router;
