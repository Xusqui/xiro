/**
 * @fileoverview Utilidades compartidas por las rutas de autenticación y cuenta del panel de administración:
 * token de sesión, opciones de la cookie de sesión y URL pública para los enlaces de email.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN, SERVER_HOST } = require('../../config/constants');
const logger = require('../../config/logger');

/**
 * Firma el JWT de sesión del panel.
 * @param {{id: number, username: string, role: string}} user - Usuario
 * @returns {string} Token
 */
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

/**
 * URL pública base para los enlaces de los correos: primer valor de PUBLIC_BASE_URL o SERVER_HOST. Si no es válida lo
 * registra y usa https://xiro.pro.
 * @returns {string} Origen
 */
function resolvePublicBaseUrl() {
    // Si llega una lista separada por comas (estilo CORS_ORIGIN), usar la primera
    const rawBaseUrl = String(process.env.PUBLIC_BASE_URL || SERVER_HOST || '')
        .split(',')[0]
        .trim();
    const fallbackBaseUrl = 'https://xiro.pro';
    const withProtocol = /^https?:\/\//i.test(rawBaseUrl) ? rawBaseUrl : `https://${rawBaseUrl || 'xiro.pro'}`;

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

/**
 * Responde un error de las rutas del panel con la forma común { success: false, error, code }.
 * @param {import("express").Response} res - Respuesta
 * @param {number} status - Código HTTP
 * @param {string} error - Mensaje
 * @param {string} code - Código de error
 * @returns {import("express").Response}
 */
function sendFailure(res, status, error, code) {
    return res.status(status).json({ success: false, error, code });
}

module.exports = { buildAuthToken, buildCookieOptions, resolvePublicBaseUrl, sendFailure };
