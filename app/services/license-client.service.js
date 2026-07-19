'use strict';

/**
 * Cliente de activación contra el servidor de licencias:
 * POST /api/licenses/validate | /heartbeat con { licenseKey, instanceId,
 * appVersion }, firmado con HMAC-SHA256 (x-xiro-timestamp + x-xiro-signature
 * sobre `${timestamp}.${rawBody}`).
 *
 * El instanceId deriva del hardware (instance-id.service), de modo que cada
 * licencia solo puede estar activa en una instalación: el servidor impone
 * max_activations y responde 409 si la única plaza está ocupada por otra
 * máquina. Ese 409 se mapea al estado propio 'license_in_use' (sin
 * reintentos: la caché de estado ya espacia las llamadas).
 */

const crypto = require('crypto');
const { getInstanceId } = require('./instance-id.service');
const { leaseMatchesInstance } = require('./license-lease');
const { version: APP_VERSION } = require('../package.json');

function _fromCodes(codes) {
    return String.fromCharCode(...codes);
}

const _ACTIVATION_BASE = [
    _fromCodes([104, 116, 116, 112, 115, 58, 47, 47]),
    _fromCodes([97, 117, 116, 104, 46, 120, 105, 114, 111, 46, 112, 114, 111]),
    _fromCodes([47, 97, 112, 105, 47, 108, 105, 99, 101, 110, 115, 101, 115, 47])
].join('');

const LICENSE_KEY_PATTERN = /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){4}$/;

// Secreto HMAC embebido (no configurable: si viviera en .env, quitarlo
// desactivaría el control de activaciones). Manipularlo solo puede invalidar
// la licencia (falla cerrado), nunca saltarse la comprobación.
const _SECRET_SEED = [
    107, 56, 106, 107, 105, 110, 59, 109, 109, 98, 98, 104, 106, 60, 105, 99,
    59, 57, 62, 60, 62, 62, 60, 109, 104, 108, 57, 59, 106, 56, 59, 108,
    104, 56, 108, 106, 105, 62, 105, 60, 105, 111, 111, 60, 104, 111, 110, 108,
    105, 60, 106, 56, 107, 105, 109, 109, 106, 98, 57, 99, 63, 56, 111, 56
];

// Claves ya validadas con éxito en este proceso → las siguientes llamadas
// periódicas van a /heartbeat (renuevan la plaza sin ser una alta nueva).
const _validatedKeys = new Set();

function _hmacSecret(deps = {}) {
    return deps.secret || _fromCodes(_SECRET_SEED.map((code) => code ^ 90));
}

/** El flujo de activación aplica a toda clave con el formato del servidor. */
function canUseActivation(licenseKey) {
    return LICENSE_KEY_PATTERN.test(String(licenseKey || ''));
}

function signPayload(secret, timestamp, rawBody) {
    return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

function _result(isValid, expiryValue, reason) {
    return { isValid, expiryValue: expiryValue ?? null, reason: reason || null };
}

async function probeActivationStatus(licenseKey, fetchImpl = globalThis.fetch, deps = {}) {
    const secret = _hmacSecret(deps);
    const { instanceId } = (deps.getInstanceId || getInstanceId)();
    const action = _validatedKeys.has(licenseKey) ? 'heartbeat' : 'validate';

    const rawBody = JSON.stringify({ licenseKey, instanceId, appVersion: APP_VERSION });
    const timestamp = String(deps.now ? deps.now() : Date.now());

    try {
        const response = await fetchImpl(`${_ACTIVATION_BASE}${action}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-xiro-timestamp': timestamp,
                'x-xiro-signature': signPayload(secret, timestamp, rawBody),
                'x-xiro-client': instanceId
            },
            body: rawBody
        });

        if (!response) return _result(false, null, 'validation_failed');

        if (response.status === 409) {
            return _result(false, null, 'license_in_use');
        }

        const payload = await response.json().catch(() => null);
        if (!payload || typeof payload !== 'object') {
            return _result(false, null, 'invalid_response');
        }

        if (payload.valid !== true) {
            return _result(false, null, payload.reason || 'validation_failed');
        }

        if (!leaseMatchesInstance(payload.leaseToken, instanceId)) {
            return _result(false, null, 'lease_mismatch');
        }

        _validatedKeys.add(licenseKey);
        return _result(true, payload.expiresAt ?? null, null);
    } catch (_error) {
        return _result(false, null, 'validation_error');
    }
}

/** Solo para tests. */
function _resetForTests() {
    _validatedKeys.clear();
}

module.exports = {
    LICENSE_KEY_PATTERN,
    canUseActivation,
    signPayload,
    probeActivationStatus,
    _resetForTests
};
