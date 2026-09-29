'use strict';

/**
 * Compra integrada de licencias de usuario contra el servicio remoto.
 * El mapeo pedido→usuario vive en Redis para funcionar entre workers.
 */

const { getRedisClient } = require('../config/redis');

const _REMOTE_API_BASE = [
    String.fromCharCode(104, 116, 116, 112, 115, 58, 47, 47),
    String.fromCharCode(97, 117, 116, 104, 46, 120, 105, 114, 111, 46, 112, 114, 111),
    String.fromCharCode(47, 97, 112, 105, 47, 112, 117, 98, 108, 105, 99)
].join('');

const CHECKOUT_KEY_PREFIX = 'license:checkout:';
const CHECKOUT_TTL_SECONDS = 7200;
const REQUEST_TIMEOUT_MS = 10000;

function _buildRequestError(message, status = 502) {
    const err = new Error(message);
    err.status = status;
    err.code = 'LICENSE_SERVICE_ERROR';
    return err;
}

async function _remoteRequest(path, options = {}, fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== 'function') {
        throw _buildRequestError('Servicio de licencias no disponible');
    }

    let response;
    try {
        response = await fetchImpl(`${_REMOTE_API_BASE}${path}`, {
            ...options,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
    } catch (_error) {
        throw _buildRequestError('No se pudo contactar con el servicio de licencias');
    }

    let payload = null;
    try {
        payload = await response.json();
    } catch (_error) {
        payload = null;
    }

    if (!response.ok) {
        const message = payload?.message || payload?.error || 'El servicio de licencias rechazó la petición';
        throw _buildRequestError(message, response.status === 400 ? 400 : 502);
    }

    return payload;
}

/**
 * Lista los planes activos publicados por el servicio de licencias.
 * @returns {Promise<Array>}
 */
async function listPlans(fetchImpl) {
    const payload = await _remoteRequest('/plans', {}, fetchImpl);
    return Array.isArray(payload?.plans) ? payload.plans : [];
}

/**
 * Crea un pedido PayPal en el servicio de licencias con retorno a Xiro.
 * @returns {Promise<{orderId, paypalOrderId, status, approveUrl}>}
 */
function createCheckoutOrder({ planCode, customerEmail, returnUrl, cancelUrl }, fetchImpl) {
    return _remoteRequest('/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode, customerEmail, returnUrl, cancelUrl })
    }, fetchImpl);
}

/**
 * Captura un pedido PayPal ya aprobado (idempotente en el servicio remoto).
 * @returns {Promise<Object>} Resultado con la licencia emitida si se completó
 */
function captureCheckoutOrder(paypalOrderId, fetchImpl) {
    return _remoteRequest('/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paypalOrderId })
    }, fetchImpl);
}

/**
 * Asocia un pedido PayPal pendiente con el usuario que lo inició.
 */
async function savePendingCheckout(paypalOrderId, userId) {
    const redisClient = await Promise.resolve(getRedisClient());
    await redisClient.set(
        `${CHECKOUT_KEY_PREFIX}${paypalOrderId}`,
        JSON.stringify({ userId }),
        { EX: CHECKOUT_TTL_SECONDS }
    );
}

/**
 * Recupera el usuario asociado a un pedido pendiente, o null.
 */
async function getPendingCheckout(paypalOrderId) {
    const redisClient = await Promise.resolve(getRedisClient());
    const raw = await redisClient.get(`${CHECKOUT_KEY_PREFIX}${paypalOrderId}`);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        const userId = Number(parsed?.userId);
        return Number.isInteger(userId) && userId > 0 ? { userId } : null;
    } catch (_error) {
        return null;
    }
}

module.exports = {
    listPlans,
    createCheckoutOrder,
    captureCheckoutOrder,
    savePendingCheckout,
    getPendingCheckout
};
