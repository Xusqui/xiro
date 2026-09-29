'use strict';

/**
 * Utilidades puras para el leaseToken (JWT) que emite el servidor de
 * licencias. El cliente no puede verificar la firma (el secreto de firma es
 * solo del servidor): decodifica el payload y comprueba que el lease fue
 * emitido para esta instancia. La autenticidad de la respuesta la aporta el
 * canal HMAC de la propia petición.
 */

function decodeJwtPayload(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const json = Buffer.from(parts[1], 'base64url').toString('utf8');
        const payload = JSON.parse(json);
        return payload && typeof payload === 'object' ? payload : null;
    } catch (_error) {
        return null;
    }
}

/**
 * true solo si el token decodifica y su claim `instanceId` coincide con el
 * id propio de la máquina. Ante cualquier otra cosa, el lease se descarta.
 */
function leaseMatchesInstance(token, instanceId) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) return false;
    const payload = decodeJwtPayload(token);
    return payload !== null && payload.instanceId === instanceId;
}

module.exports = { decodeJwtPayload, leaseMatchesInstance };
