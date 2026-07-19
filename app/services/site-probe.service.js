'use strict';

const activationClient = require('./license-client.service');

function _fromCodes(charCodes) {
    return String.fromCharCode(...charCodes);
}

const _FIELD_INDEX = {
    VALID: 0,
    EXPIRES: 1,
    REASON: 2
};

const _REMOTE_PAYLOAD_FIELDS = [
    _fromCodes([118, 97, 108, 105, 100]),
    _fromCodes([101, 120, 112, 105, 114, 101, 115, 65, 116]),
    _fromCodes([114, 101, 97, 115, 111, 110])
];

const _REMOTE_ENTRY_SEED = [
    _fromCodes([104, 116, 116, 112, 115, 58, 47, 47]),
    _fromCodes([97, 117, 116, 104, 46, 120, 105, 114, 111, 46, 112, 114, 111]),
    _fromCodes([47, 97, 112, 105, 47, 99, 104, 101, 99, 107, 47])
].join('');

function _buildValidationResult(isValid, expiryValue, reason) {
    return {
        [_REMOTE_PAYLOAD_FIELDS[_FIELD_INDEX.VALID]]: isValid,
        [_REMOTE_PAYLOAD_FIELDS[_FIELD_INDEX.EXPIRES]]: expiryValue,
        ...(reason ? { [_REMOTE_PAYLOAD_FIELDS[_FIELD_INDEX.REASON]]: reason } : {})
    };
}

function normalizeSiteToken(tokenValue) {
    return String(tokenValue || '').trim();
}

async function probeRemoteStatus(tokenValue, fetchImpl = globalThis.fetch) {
    const normalizedToken = normalizeSiteToken(tokenValue);

    if (!normalizedToken) {
        return _buildValidationResult(false, null, 'empty');
    }

    if (typeof fetchImpl !== 'function') {
        return _buildValidationResult(false, null, 'validation_unavailable');
    }

    // Flujo de activación (una instalación por licencia) para toda clave con
    // el formato del servidor; la comprobación legacy queda solo para tokens
    // con formatos antiguos.
    if (activationClient.canUseActivation(normalizedToken)) {
        const activation = await activationClient.probeActivationStatus(normalizedToken, fetchImpl);
        return _buildValidationResult(activation.isValid, activation.expiryValue, activation.reason);
    }

    try {
        const response = await fetchImpl(`${_REMOTE_ENTRY_SEED}${encodeURIComponent(normalizedToken)}`);
        if (!response || !response.ok) {
            return _buildValidationResult(false, null, 'validation_failed');
        }

        const payload = await response.json();
        if (!payload || typeof payload !== 'object') {
            return _buildValidationResult(false, null, 'invalid_response');
        }

        const isValid = payload[_REMOTE_PAYLOAD_FIELDS[_FIELD_INDEX.VALID]] === true;
        const expiryValue = payload[_REMOTE_PAYLOAD_FIELDS[_FIELD_INDEX.EXPIRES]] ?? null;
        const reason = payload[_REMOTE_PAYLOAD_FIELDS[_FIELD_INDEX.REASON]];

        return _buildValidationResult(isValid, expiryValue, reason);
    } catch (_error) {
        return _buildValidationResult(false, null, 'validation_error');
    }
}

module.exports = {
    normalizeSiteToken,
    probeRemoteStatus
};
