'use strict';

/**
 * Estado de licencia individual por usuario, con caché en proceso.
 * Espejo del patrón de site-state.service pero por usuario, y con
 * resolución del propietario de un contenido a partir de su PIN.
 */

const userLicenseDb = require('./db/user-license.service');
const { validatePinInDatabase } = require('./db/pin.service');
const { getResourceOwner } = require('./db/resource-ownership.service');
const { probeRemoteStatus } = require('./site-probe.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_SYNC_MS = 60 * 1000;
const OWNER_CACHE_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

const _VALIDATION_KEYS = [
    String.fromCharCode(118, 97, 108, 105, 100),
    String.fromCharCode(101, 120, 112, 105, 114, 101, 115, 65, 116),
    String.fromCharCode(114, 101, 97, 115, 111, 110)
];

const _statusByUser = new Map();
const _ownerByPin = new Map();

function _normalizeUserId(userId) {
    const parsed = Number(userId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function _readValidationField(validation, keyIndex, fallback = null) {
    if (!validation || typeof validation !== 'object') return fallback;
    const key = _VALIDATION_KEYS[keyIndex];
    return validation[key] !== undefined ? validation[key] : fallback;
}

function _isExpired(expiryValue, nowMs) {
    if (!expiryValue) return false;
    const expiryMs = new Date(expiryValue).getTime();
    if (Number.isNaN(expiryMs)) return false;
    return expiryMs <= nowMs;
}

function _toPublicStatus(state, nowMs) {
    const expiredNow = state.licensed === true && _isExpired(state.expiresAt, nowMs);
    return {
        licensed: state.licensed === true && !expiredNow,
        checkedAt: state.checkedAt,
        expiresAt: state.expiresAt ?? null,
        reason: expiredNow ? 'expired' : (state.reason || null)
    };
}

function _boundedSet(map, key, value) {
    if (map.size >= MAX_CACHE_ENTRIES && !map.has(key)) {
        map.clear();
    }
    map.set(key, value);
}

async function _refreshUserStatus(userId, nowMs, source) {
    let state;

    if (!source.license) {
        state = {
            licensed: false, checkedAt: nowMs, expiresAt: null, reason: 'missing_license'
        };
    } else {
        const validation = await probeRemoteStatus(source.license);
        const remoteValid = _readValidationField(validation, 0, false) === true;
        const expiryValue = _readValidationField(validation, 1, null);
        let reason = _readValidationField(validation, 2, null);
        let licensed = remoteValid;

        if (remoteValid && _isExpired(expiryValue, nowMs)) {
            licensed = false;
            reason = 'expired';
        }
        if (!remoteValid && !reason) {
            reason = 'invalid';
        }

        state = { licensed, checkedAt: nowMs, expiresAt: expiryValue, reason };
    }

    const entry = {
        ...state,
        sourceLicense: source.license,
        sourceUpdatedAtMs: source.updatedAtMs,
        sourceCheckedAt: nowMs
    };
    _boundedSet(_statusByUser, userId, entry);
    return _toPublicStatus(entry, nowMs);
}

/**
 * Estado de la licencia individual de un usuario (caché 24h,
 * relectura de la clave en BD como mucho cada SOURCE_SYNC_MS).
 * @param {number} userId - ID del usuario (admin_users.id)
 * @returns {Promise<{licensed: boolean, checkedAt: number, expiresAt: *, reason: string|null}>}
 */
async function getUserLicenseStatus(userId) {
    const uid = _normalizeUserId(userId);
    const nowMs = Date.now();
    if (!uid) {
        return { licensed: false, checkedAt: nowMs, expiresAt: null, reason: 'no_user' };
    }

    const entry = _statusByUser.get(uid);
    const fresh = entry && nowMs - entry.checkedAt < DAY_MS;
    if (fresh && nowMs - entry.sourceCheckedAt < SOURCE_SYNC_MS) {
        return _toPublicStatus(entry, nowMs);
    }

    try {
        const source = await userLicenseDb.getUserLicenseWithMeta(uid);
        const sourceUnchanged = fresh
            && source.license === entry.sourceLicense
            && source.updatedAtMs === entry.sourceUpdatedAtMs;

        if (sourceUnchanged) {
            entry.sourceCheckedAt = nowMs;
            return _toPublicStatus(entry, nowMs);
        }

        return await _refreshUserStatus(uid, nowMs, source);
    } catch (_error) {
        if (entry) {
            return _toPublicStatus(entry, nowMs);
        }
        return { licensed: false, checkedAt: nowMs, expiresAt: null, reason: 'status_unavailable' };
    }
}

async function _resolveOwner(pin) {
    const nowMs = Date.now();
    const cached = _ownerByPin.get(pin);
    if (cached && nowMs - cached.checkedAt < OWNER_CACHE_MS) {
        return cached.owner;
    }

    const pinInfo = await validatePinInDatabase(pin);
    let owner = null;
    if (pinInfo.valid && pinInfo.type && pinInfo.id) {
        owner = await getResourceOwner(pinInfo.type, pinInfo.id);
    }

    _boundedSet(_ownerByPin, pin, { owner, checkedAt: nowMs });
    return owner;
}

/**
 * Desbloqueo por propietario del contenido asociado a un PIN.
 * Solo tiene sentido con licencia de sitio válida: el contenido de
 * administradores o sin propietario (legado) queda desbloqueado por la
 * propia licencia de sitio; el de editores exige su licencia individual.
 * @param {string} pinValue - PIN del contenido (banco/custom/trivial/quiz/juego)
 * @returns {Promise<{licensed: boolean, reason: string|null}>}
 */
async function getOwnerLicenseStatusByPin(pinValue) {
    const pin = String(pinValue || '').trim().toUpperCase();
    if (!pin) {
        return { licensed: false, reason: 'no_pin' };
    }

    try {
        const owner = await _resolveOwner(pin);
        if (!owner || !owner.userId) {
            return { licensed: true, reason: 'no_owner' };
        }
        if (owner.role !== 'editor') {
            return { licensed: true, reason: 'admin_owner' };
        }
        return await getUserLicenseStatus(owner.userId);
    } catch (_error) {
        return { licensed: false, reason: 'owner_unavailable' };
    }
}

/**
 * Invalida la caché de un usuario (p.ej. tras guardar una clave nueva).
 * @param {number} userId - ID del usuario
 */
function invalidateUserLicenseStatus(userId) {
    const uid = _normalizeUserId(userId);
    if (uid) _statusByUser.delete(uid);
}

function clearUserLicenseCaches() {
    _statusByUser.clear();
    _ownerByPin.clear();
}

module.exports = {
    getUserLicenseStatus,
    getOwnerLicenseStatusByPin,
    invalidateUserLicenseStatus,
    clearUserLicenseCaches
};
