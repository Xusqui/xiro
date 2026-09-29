/**
 * @fileoverview Middlewares de autenticación y autorización JWT
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const adminUserService = require('../services/db/admin-user.service');

function shouldEnforceDbSessionValidation() {
    const explicit = String(process.env.AUTH_STRICT_DB_REVALIDATION || '').trim().toLowerCase();
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;

    return process.env.NODE_ENV !== 'test';
}

/**
 * Extrae el JWT del encabezado de la cookie (sin cookie-parser).
 * @param {string} cookieHeader - Valor del header Cookie
 * @returns {string|null}
 */
function parseCookieToken(cookieHeader) {
    const match = (cookieHeader || '').match(/(?:^|;\s*)adminToken=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Middleware de autenticación JWT para rutas admin.
 * Acepta el token desde la cookie HttpOnly (prioridad) o el header Authorization.
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
async function authenticateAdmin(req, res, next) {
    const cookieToken = parseCookieToken(req.headers.cookie);
    const authHeader = req.headers.authorization;
    const bearerToken =
        authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const token = cookieToken || bearerToken;

    if (!token) {
        const err = new Error('Token de autenticación requerido');
        err.status = 401;
        err.code = 'NO_TOKEN';
        return next(err);
    }

    let decoded;

    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
        const err = new Error(
            jwtErr.name === 'TokenExpiredError'
                ? 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
                : 'Token de autenticación inválido'
        );
        err.status = 401;
        err.code = jwtErr.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        return next(err);
    }

    if (!shouldEnforceDbSessionValidation()) {
        req.user = decoded;
        return next();
    }

    const userId = Number(decoded?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
        const err = new Error('Token de autenticación inválido');
        err.status = 401;
        err.code = 'TOKEN_INVALID';
        return next(err);
    }

    try {
        const activeUser = await adminUserService.getActiveUserById(userId);

        if (!activeUser) {
            const err = new Error('Tu sesión ya no es válida. Por favor, inicia sesión nuevamente.');
            err.status = 401;
            err.code = 'USER_INACTIVE_OR_NOT_FOUND';
            return next(err);
        }

        req.user = {
            ...decoded,
            userId: activeUser.id,
            username: activeUser.username,
            role: activeUser.role
        };

        return next();
    } catch (_dbError) {
        const err = new Error('No se pudo validar la sesión en este momento');
        err.status = 503;
        err.code = 'AUTH_BACKEND_UNAVAILABLE';
        return next(err);
    }
}

/**
 * Middleware de autorización por rol (solo admin)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
function authorizeAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        const err = new Error('No tienes permisos para realizar esta acción');
        err.status = 403;
        err.code = 'FORBIDDEN';
        return next(err);
    }
    next();
}

module.exports = {
    authenticateAdmin,
    authorizeAdmin
};
