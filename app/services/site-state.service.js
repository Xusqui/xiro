'use strict';

const siteSettingsService = require('./db/site-settings.service');
const { probeRemoteStatus } = require('./site-probe.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_TICK_MS = 60 * 60 * 1000;
const SOURCE_SYNC_MS = 5 * 1000;

const _VALIDATION_KEYS = [
    String.fromCharCode(118, 97, 108, 105, 100),
    String.fromCharCode(101, 120, 112, 105, 114, 101, 115, 65, 116),
    String.fromCharCode(114, 101, 97, 115, 111, 110)
];

let _cache = {
    hasResult: false,
    licensed: false,
    checkedAt: 0,
    expiresAt: null,
    reason: 'not_checked',
    sourceLicense: '',
    sourceUpdatedAtMs: 0,
    sourceCheckedAt: 0
};

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

function _isStale(nowMs) {
    if (!_cache.hasResult) return true;
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
    const license = source.license;
    if (!license) {
        return _updateCache({
            licensed: false,
            checkedAt: nowMs,
            expiresAt: null,
            reason: 'missing_license',
            sourceLicense: source.license,
            sourceUpdatedAtMs: source.updatedAtMs,
            sourceCheckedAt: nowMs
        });
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

    return _updateCache({
        licensed,
        checkedAt: nowMs,
        expiresAt: expiryValue,
        reason,
        sourceLicense: source.license,
        sourceUpdatedAtMs: source.updatedAtMs,
        sourceCheckedAt: nowMs
    });
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

        return _updateCache({
            licensed: false,
            checkedAt: nowMs,
            expiresAt: null,
            reason: 'status_unavailable',
            sourceLicense: '',
            sourceUpdatedAtMs: 0,
            sourceCheckedAt: nowMs
        });
    }
}

function clearLicenseStatusCache() {
    _cache = {
        hasResult: false,
        licensed: false,
        checkedAt: 0,
        expiresAt: null,
        reason: 'not_checked',
        sourceLicense: '',
        sourceUpdatedAtMs: 0,
        sourceCheckedAt: 0
    };
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
