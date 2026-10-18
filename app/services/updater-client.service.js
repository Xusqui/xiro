/** @fileoverview Cliente del contenedor «updater» (red interna de Docker). El backend le pide que actualice
 *  backend y backup; se autentica con UPDATER_TOKEN, compartido por los dos a través del .env. */
'use strict';

const MIN_TOKEN_LENGTH = 32;
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Obtiene la configuración del updater desde variables de entorno
 * @returns {Object} Configuración del updater
 */
function getConfig() {
    return {
        url: String(process.env.UPDATER_URL || '').replace(/\/+$/, ''),
        token: String(process.env.UPDATER_TOKEN || '')
    };
}

/**
 * Realiza una solicitud HTTP al contenedor updater
 * @param {string} path - Ruta de la API
 * @param {Object} options - Opciones de la solicitud
 * @param {Function} [options.fetchImpl] - Implementación de fetch a usar (para testing)
 * @returns {Promise<{status: number, data: Object}>} Resultado de la solicitud
 */
async function request(path, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const { url, token } = getConfig();

    if (!url) {
        return { status: 404, data: {} };
    }

    try {
        const res = await fetchImpl(url + path, {
            method: options.method || 'GET',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        const data = await res.json().catch(() => ({}));
        return { status: res.status, data };
    } catch (err) {
        return { status: 0, data: { error: err.message } };
    }
}

/**
 * Obtiene el estado de salud del contenedor updater
 * @param {Object} options - Opciones de la solicitud
 * @param {Function} [options.fetchImpl] - Implementación de fetch a usar (para testing)
 * @returns {Promise<{available: boolean, reason: string|null, detail: string|null}>} Estado de salud
 * @description Devuelve `available: false` con `reason: 'source_install'` si el backend se ejecuta desde código fuente
 */
async function getUpdaterHealth(options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const { url, token } = getConfig();

    if (process.env.XIRO_INSTALL === 'source') {
        return { available: false, reason: 'source_install', detail: null };
    }

    if (!url) {
        return { available: false, reason: 'not_installed', detail: null };
    }

    try {
        const res = await fetchImpl(url + '/health', {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        if (!res.ok) {
            return { available: false, reason: 'updater_unreachable', detail: null };
        }

        const body = await res.json();
        if (body.tokenConfigured !== true) {
            return { available: false, reason: 'updater_token_missing', detail: null };
        }

        if (token.length < MIN_TOKEN_LENGTH) {
            return { available: false, reason: 'backend_token_missing', detail: null };
        }

        if (body.ready !== true) {
            return {
                available: false,
                reason: 'updater_not_ready',
                detail: body.setupError || null
            };
        }

        return { available: true, reason: null, detail: null };
    } catch (err) {
        return { available: false, reason: 'updater_unreachable', detail: null };
    }
}

/**
 * Obtiene el estado actual del contenedor updater
 * @param {Object} options - Opciones de la solicitud
 * @param {Function} [options.fetchImpl] - Implementación de fetch a usar (para testing)
 * @returns {Promise<Object|null>} Estado del updater o null si no disponible
 */
async function getUpdaterStatus(options = {}) {
    const { status, data } = await request('/status', options);
    return status === 200 ? data : null;
}

/**
 * Inicia una actualización en el contenedor updater
 * @param {string} version - Versión a actualizar
 * @param {Object} options - Opciones de la solicitud
 * @param {Function} [options.fetchImpl] - Implementación de fetch a usar (para testing)
 * @returns {Promise<{ok: boolean, status: number, error: string|null}>} Resultado de la actualización
 */
async function startUpdate(version, options = {}) {
    const { status, data } = await request('/update', {
        method: 'POST',
        body: { version },
        ...options
    });

    return {
        ok: status === 202,
        status,
        error: data.error || null
    };
}

module.exports = {
    getUpdaterHealth,
    getUpdaterStatus,
    startUpdate,
    MIN_TOKEN_LENGTH
};
