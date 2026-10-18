'use strict';

/**
 * Política ante fallos de la comprobación remota de licencia del sitio.
 *
 * Un fallo transitorio (red, timeout, 5xx, rate limit, auto-alta caída…) no
 * es una respuesta del servidor sobre la licencia: no debe retirar una
 * licencia ya validada ni quedarse cacheado el día entero que dura un
 * resultado normal. Cada worker PM2 tiene su propia caché, así que un fallo
 * cacheado en uno solo hacía aparecer el distintivo «sin licencia» de forma
 * intermitente según el worker que atendiera la petición.
 *
 * Los motivos definitivos (license_not_found, license_expired,
 * license_revoked, license_in_use, lease_mismatch, expired, empty…) se
 * aplican al momento, igual que antes.
 */

// Reintento tras un fallo transitorio (en vez de esperar 24 h).
const RETRY_MS = 2 * 60 * 1000;

// Tiempo máximo que se conserva la última validación buena mientras el
// servidor de licencias no responde (el lease que emite dura 24 h).
const GRACE_MS = 72 * 60 * 60 * 1000;

const TRANSIENT_REASONS = new Set([
    'validation_error',
    'validation_failed',
    'validation_unavailable',
    'invalid_response',
    'rate_limited',
    'status_unavailable'
]);

function isTransientReason(reason) {
    return TRANSIENT_REASONS.has(reason);
}

/** Sin licencia guardada: solo es definitivo si el auto-alta está desactivado. */
function isTransientProvisionFailure(provisioned) {
    return !provisioned || provisioned.reason !== 'auto_provision_disabled';
}

/**
 * true si ante un fallo transitorio se debe mantener el estado licenciado
 * cacheado: la licencia es la misma y la última validación buena es reciente.
 */
function keepsPreviousGrant(cache, sourceLicense, nowMs) {
    if (!cache || cache.licensed !== true) return false;
    if (cache.sourceLicense !== sourceLicense) return false;
    return nowMs - (cache.lastValidAt || 0) < GRACE_MS;
}

module.exports = {
    RETRY_MS,
    GRACE_MS,
    isTransientReason,
    isTransientProvisionFailure,
    keepsPreviousGrant
};
