'use strict';

const siteSettingsService = require('./db/site-settings.service');
const { probeRemoteStatus, tryAutoProvision } = require('./site-probe.service');
const policy = require('./site-state-policy');
const logger = require('../config/logger');

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_TICK_MS = 60 * 60 * 1000;
const SOURCE_SYNC_MS = 5 * 1000;

const _VALIDATION_KEYS = [
    String.fromCharCode(118, 97, 108, 105, 100),
    String.fromCharCode(101, 120, 112, 105, 114, 101, 115, 65, 116),
    String.fromCharCode(114, 101, 97, 115, 111, 110)
];

function _emptyCache() {
    return {
        hasResult: false,
        licensed: false,
        checkedAt: 0,
        expiresAt: null,
        reason: 'not_checked',
        sourceLicense: '',
        sourceUpdatedAtMs: 0,
        sourceCheckedAt: 0,
        lastValidAt: 0,
        retryAt: 0
    };
}

let _cache = _emptyCache();
let _inflight = null;
let _refreshTimer = null;

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

function _toPublicStatus(state) {
    const nowMs = Date.now();
    const expiredNow = state.licensed === true && _isExpired(state.expiresAt, nowMs);
    const licensed = state.licensed === true && !expiredNow;
    return {
        licensed,
        checkedAt: state.checkedAt,
        expiresAt: state.expiresAt ?? null,
        reason: expiredNow ? 'expired' : (state.reason || null)
    };
}

function _updateCache(nextState) {
    _cache = {
        ..._cache,
        ...nextState,
        hasResult: true
    };
    return _toPublicStatus(_cache);
}

/**
 * Guarda un resultado. Un fallo transitorio se reintenta en RETRY_MS y, si
 * la misma licencia estaba validada hace poco, no retira el estado licenciado.
 */
function _settle(nextState, nowMs, transient) {
    if (nextState.licensed === true) {
        return _updateCache({ ...nextState, lastValidAt: nowMs, retryAt: 0 });
    }
    if (!transient) {
        return _updateCache({ ...nextState, retryAt: 0 });
    }

    const keep = policy.keepsPreviousGrant(_cache, nextState.sourceLicense, nowMs);
    logger.warn('License check failed transiently', { reason: nextState.reason, keptPreviousGrant: keep });

    if (keep) {
        return _updateCache({ sourceCheckedAt: nowMs, retryAt: nowMs + policy.RETRY_MS });
    }
    return _updateCache({ ...nextState, retryAt: nowMs + policy.RETRY_MS });
}

function _isStale(nowMs) {
    if (!_cache.hasResult) return true;
    if (_cache.retryAt > 0 && nowMs >= _cache.retryAt) return true;
    return nowMs - _cache.checkedAt >= DAY_MS;
}

function _normalizeSourceState(sourceState) {
    const source = sourceState || {};
    return {
        license: String(source.license || '').trim(),
        updatedAtMs: Number.isFinite(source.updatedAtMs) ? source.updatedAtMs : 0
    };
}

async function _readSourceState() {
    if (typeof siteSettingsService.getSiteLicenseWithMeta === 'function') {
        const source = await siteSettingsService.getSiteLicenseWithMeta();
        return _normalizeSourceState(source);
    }

    const license = await siteSettingsService.getSiteLicense();
    return _normalizeSourceState({ license, updatedAtMs: 0 });
}

function _sourceChanged(source) {
    if (!_cache.hasResult) return true;
    if (source.license !== _cache.sourceLicense) return true;
    if (source.updatedAtMs > 0 && source.updatedAtMs !== _cache.sourceUpdatedAtMs) return true;
    return false;
}

function _markSourceChecked(nowMs) {
    _cache = {
        ..._cache,
        sourceCheckedAt: nowMs
    };
}

async function _refreshFromSource(nowMs, sourceState) {
    const source = sourceState || await _readSourceState();
    let license = source.license;
    let sourceUpdatedAtMs = source.updatedAtMs;
    let provisioned = null;

    // Instalación sin licenseKey todavía: intenta auto-alta antes de darla
    // por no licenciada. Si el servidor la tiene desactivada (403) o falla,
    // sigue el flujo normal (missing_license → pantalla de licencia manual).
    if (!license) {
        provisioned = await tryAutoProvision();
        if (provisioned.success) {
            license = await siteSettingsService.setSiteLicense(provisioned.licenseKey);
            sourceUpdatedAtMs = nowMs;
        }
    }

    const base = { checkedAt: nowMs, sourceLicense: license, sourceUpdatedAtMs, sourceCheckedAt: nowMs };

    if (!license) {
        const missing = { ...base, licensed: false, expiresAt: null, reason: 'missing_license' };
        return _settle(missing, nowMs, policy.isTransientProvisionFailure(provisioned));
    }

    const validation = await probeRemoteStatus(license);
    const remoteValid = _readValidationField(validation, 0, false) === true;
    const expiryValue = _readValidationField(validation, 1, null);
    const validationReason = _readValidationField(validation, 2, null);

    let licensed = remoteValid;
    let reason = validationReason || null;

    if (remoteValid && _isExpired(expiryValue, nowMs)) {
        licensed = false;
        reason = 'expired';
    }

    if (!remoteValid && !reason) {
        reason = 'invalid';
    }

    const transient = !licensed && policy.isTransientReason(reason);
    return _settle({ ...base, licensed, expiresAt: expiryValue, reason }, nowMs, transient);
}

async function _checkSource(nowMs, force) {
    try {
        const source = await _readSourceState();
        if (!force && !_isStale(nowMs) && !_sourceChanged(source)) {
            _markSourceChecked(nowMs);
            return _toPublicStatus(_cache);
        }

        return await _refreshFromSource(nowMs, source);
    } catch (_error) {
        if (_cache.hasResult) {
            return _toPublicStatus(_cache);
        }

        return _settle({
            licensed: false,
            checkedAt: nowMs,
            expiresAt: null,
            reason: 'status_unavailable',
            sourceLicense: '',
            sourceUpdatedAtMs: 0,
            sourceCheckedAt: nowMs
        }, nowMs, true);
    }
}

async function getPublicLicenseStatus(options = {}) {
    const nowMs = Date.now();
    const force = options.force === true;

    if (!force && _cache.hasResult && !_isStale(nowMs)) {
        const recentlySyncedSource = nowMs - _cache.sourceCheckedAt <= SOURCE_SYNC_MS;
        if (recentlySyncedSource) {
            return _toPublicStatus(_cache);
        }
    }

    // Peticiones simultáneas comparten una sola comprobación: evita ráfagas
    // contra el servidor de licencias (rate limit, firmas repetidas).
    if (!_inflight) {
        _inflight = _checkSource(nowMs, force).finally(() => { _inflight = null; });
    }
    return await _inflight;
}

function clearLicenseStatusCache() {
    _cache = _emptyCache();
    _inflight = null;
}

function _startDailyRefresh() {
    if (_refreshTimer || process.env.NODE_ENV === 'test') return;

    _refreshTimer = setInterval(() => {
        getPublicLicenseStatus().catch(() => { });
    }, REFRESH_TICK_MS);

    if (typeof _refreshTimer.unref === 'function') {
        _refreshTimer.unref();
    }
}

_startDailyRefresh();

module.exports = {
    getPublicLicenseStatus,
    clearLicenseStatusCache
};
