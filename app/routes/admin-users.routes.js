/**
 * @fileoverview Gestión de usuarios del panel de administración: listar, eliminar y cambiar rol.
 * Montado desde routes/admin.routes.js. Las rutas, los códigos y las respuestas no cambian.
 */

const express = require('express');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const adminUserService = require('../services/db/admin-user.service');
const logger = require('../config/logger');

const { sendFailure } = require('./helpers/admin-auth-helpers');

const router = express.Router();

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
        return sendFailure(res, 500, 'No se pudo cargar la lista de usuarios', 'ADMIN_USERS_LIST_FAILED');
    }
});

/**
 * Elimina un usuario del panel (solo admin)
 */
router.delete('/api/admin/users/:userId', authenticateAdmin, authorizeAdmin, async (req, res) => {
    const targetUserId = Number.parseInt(req.params.userId, 10);
    const actorUserId = Number(req.user?.userId);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return sendFailure(res, 400, 'Identificador de usuario inválido', 'INVALID_USER_ID');
    }

    if (targetUserId === actorUserId) {
        return sendFailure(res, 400, 'No puedes eliminar tu propia cuenta', 'CANNOT_DELETE_OWN_ACCOUNT');
    }

    try {
        const users = await adminUserService.listUsers();
        const targetUser = users.find(user => user.id === targetUserId);

        if (!targetUser) {
            return sendFailure(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
        }

        const activeAdminCount = users.filter(user => user.role === 'admin' && user.is_active).length;
        if (targetUser.role === 'admin' && targetUser.is_active && activeAdminCount <= 1) {
            return sendFailure(
                res, 400, 'No puedes eliminar el último administrador activo', 'CANNOT_REMOVE_LAST_ADMIN'
            );
        }

        const deletedUser = await adminUserService.deleteUserById(targetUserId);
        if (!deletedUser) {
            return sendFailure(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
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

        return sendFailure(res, 500, 'No se pudo eliminar el usuario', 'DELETE_USER_FAILED');
    }
});

function roleUpdatedResponse({ id, username, email, role }) {
    return {
        success: true,
        message: 'Rol actualizado correctamente',
        code: 'ROLE_UPDATED',
        user: { id, username, email, role }
    };
}

/**
 * Cambia el rol de un usuario del panel (solo admin)
 */
router.put('/api/admin/users/:userId/role', authenticateAdmin, authorizeAdmin, async (req, res) => {
    const targetUserId = Number.parseInt(req.params.userId, 10);
    const actorUserId = Number(req.user?.userId);
    const { role: newRole } = req.body;

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return sendFailure(res, 400, 'Identificador de usuario inválido', 'INVALID_USER_ID');
    }

    if (!['admin', 'editor'].includes(newRole)) {
        return sendFailure(res, 400, 'Rol inválido', 'INVALID_ROLE');
    }

    if (targetUserId === actorUserId) {
        return sendFailure(res, 400, 'No puedes cambiar tu propio rol', 'CANNOT_CHANGE_OWN_ROLE');
    }

    try {
        const users = await adminUserService.listUsers();
        const targetUser = users.find(user => user.id === targetUserId);

        if (!targetUser) {
            return sendFailure(res, 404, 'Usuario no encontrado', 'USER_NOT_FOUND');
        }

        const activeAdminCount = users.filter(user => user.role === 'admin' && user.is_active).length;
        if (targetUser.role === 'admin' && newRole === 'editor' && activeAdminCount <= 1) {
            return sendFailure(
                res, 400, 'No puedes degradar al último administrador activo', 'CANNOT_DEMOTE_LAST_ADMIN'
            );
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

        return res.json(roleUpdatedResponse(updatedUser));
    } catch (error) {
        logger.error('Error changing admin user role', {
            error: error.message,
            actorUserId,
            targetUserId,
            newRole,
            ip: req.ip
        });

        return sendFailure(res, 500, 'No se pudo cambiar el rol del usuario', 'CHANGE_ROLE_FAILED');
    }
});

module.exports = router;
