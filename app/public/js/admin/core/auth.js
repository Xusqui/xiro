/**
 * @fileoverview Gestión de autenticación y sesiones de admin
 * Funciones extraídas 1:1 del original admin.js
 */

const ADMIN_SESSION_KEY = 'adminSession';
const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_ROLE_KEY = 'adminRole';
const ADMIN_USER_ID_KEY = 'adminUserId';
const ADMIN_USERNAME_KEY = 'adminUsername';
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function decodeJwtPayload(token) {
    try {
        const parts = String(token || '').split('.');
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
        const json = atob(padded);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function isAdminSessionValid() {
    try {
        const stored = localStorage.getItem(ADMIN_SESSION_KEY);
        if (!stored) return false;
        const parsed = JSON.parse(stored);
        return parsed.expires && parsed.expires > Date.now();
    } catch { return false; }
}

function startAdminSession(token, role, username = null) {
    const expires = Date.now() + ADMIN_SESSION_TTL_MS;
    const payload = decodeJwtPayload(token);
    const userId = Number(payload?.userId);
    const payloadUsername = payload?.username;

    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ expires }));
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_ROLE_KEY, role);

    if (Number.isInteger(userId) && userId > 0) {
        localStorage.setItem(ADMIN_USER_ID_KEY, String(userId));
    }

    const finalUsername = String(username || payloadUsername || '').trim();
    if (finalUsername) {
        localStorage.setItem(ADMIN_USERNAME_KEY, finalUsername);
    }
}

function getAuthToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function getUserRole() {
    return localStorage.getItem(ADMIN_ROLE_KEY);
}

function getCurrentUserId() {
    const stored = Number(localStorage.getItem(ADMIN_USER_ID_KEY));
    if (Number.isInteger(stored) && stored > 0) return stored;

    const payload = decodeJwtPayload(getAuthToken());
    const decodedId = Number(payload?.userId);
    if (Number.isInteger(decodedId) && decodedId > 0) {
        localStorage.setItem(ADMIN_USER_ID_KEY, String(decodedId));
        return decodedId;
    }

    return null;
}

function getCurrentUsername() {
    const stored = String(localStorage.getItem(ADMIN_USERNAME_KEY) || '').trim();
    if (stored) return stored;

    const payload = decodeJwtPayload(getAuthToken());
    const decodedUsername = String(payload?.username || '').trim();
    if (decodedUsername) {
        localStorage.setItem(ADMIN_USERNAME_KEY, decodedUsername);
        return decodedUsername;
    }

    return null;
}

function isAdmin() {
    return getUserRole() === 'admin';
}

function clearAdminSession() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_ROLE_KEY);
    localStorage.removeItem(ADMIN_USER_ID_KEY);
    localStorage.removeItem(ADMIN_USERNAME_KEY);
}

function handleUnauthorized() {
    clearAdminSession();
    if (typeof mostrarModalConfirmacion === 'function') {
        mostrarModalConfirmacion(
            _t('admin.auth.expired_title', null, 'Sesión expirada'),
            _t('admin.auth.expired_message', null, 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'),
            () => location.reload(),
            () => location.reload(),
            _t('admin.auth.login_btn', null, 'Iniciar sesión'),
            _t('admin.common.close', null, 'Cerrar')
        );
    } else {
        location.reload();
    }
}
