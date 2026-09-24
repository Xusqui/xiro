(function initLicenseIndicator() {
    'use strict';

    const ENDPOINT = '/api/license/public-status';
    const STORAGE_KEY = 'xiro-license-status-v1';
    const BADGE_ID = 'xiro-unlicensed-badge';
    const BADGE_ICON_SRC = String.fromCharCode(47, 105, 109, 97, 103, 101, 115, 47, 109, 49, 46, 115, 118, 103);

    function _readCache() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed.licensed !== 'boolean') return null;
            if (typeof parsed.checkedAt !== 'number' || !isFinite(parsed.checkedAt)) return null;
            return parsed;
        } catch (_error) {
            return null;
        }
    }

    function _writeCache(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (_error) {
            // Storage lleno o bloqueado: seguir sin cache persistente.
        }
    }

    function _showUnlicensedBadge() {
        if (document.getElementById(BADGE_ID)) return;

        const host = document.createElement('div');
        host.id = BADGE_ID;
        host.style.position = 'fixed';
        host.style.top = '10px';
        host.style.left = '10px';
        host.style.width = 'min(92px, 24vw)';
        host.style.zIndex = '2147483647';
        host.style.pointerEvents = 'none';

        const img = document.createElement('img');
        img.src = BADGE_ICON_SRC;
        img.alt = 'Xiro sin licencia válida';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.filter = 'drop-shadow(0 3px 7px rgba(0,0,0,0.22))';

        host.appendChild(img);
        document.body.appendChild(host);
    }

    function _hideUnlicensedBadge() {
        const badge = document.getElementById(BADGE_ID);
        if (badge && badge.parentNode) {
            badge.parentNode.removeChild(badge);
        }
    }

    function _applyStatus(licensed) {
        if (licensed === false) {
            _showUnlicensedBadge();
            return;
        }
        _hideUnlicensedBadge();
    }

    function _normalizeStatusResponse(payload) {
        if (!payload || payload.success !== true) return null;
        if (typeof payload.licensed !== 'boolean') return null;

        return {
            licensed: payload.licensed,
            checkedAt: Number(payload.checkedAt) || new Date().getTime()
        };
    }

    function _fetchStatusFallback() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', ENDPOINT + '?_=' + new Date().getTime(), true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        const state = _normalizeStatusResponse(data);
                        if (state) {
                            _writeCache(state);
                            _applyStatus(state.licensed);
                        }
                    } catch (e) { }
                }
            }
        };
        xhr.send();
    }

    function _fetchStatus() {
        if (typeof fetch === 'function') {
            return fetch(ENDPOINT, { cache: 'no-store' })
                .then(function (response) {
                    if (!response.ok) throw new Error('status_request_failed');
                    return response.json();
                })
                .then(_normalizeStatusResponse)
                .then(function (state) {
                    if (!state) return null;
                    _writeCache(state);
                    _applyStatus(state.licensed);
                    return state;
                })
                .catch(function () { return null; });
        } else {
            _fetchStatusFallback();
            return {
                then: function (cb) {
                    cb(null);
                }
            };
        }
    }

    const cachedState = _readCache();
    if (cachedState) {
        _applyStatus(cachedState.licensed);
    }

    const fetchPromise = _fetchStatus();
    if (fetchPromise && typeof fetchPromise.then === 'function') {
        fetchPromise.then(function (freshState) {
            if (!freshState && cachedState && cachedState.licensed === false) {
                _showUnlicensedBadge();
            }
        });
    }
})();
