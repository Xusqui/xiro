window.TVApp = window.TVApp || {};
window.TVApp.Utils = (function () {
    'use strict';

    function tr(text) {
        if (typeof text !== 'string') return text;
        return (window.XiroI18n && window.XiroI18n.translateLiteral)
            ? window.XiroI18n.translateLiteral(text)
            : text;
    }

    // Polyfill para requestAnimationFrame
    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function (callback) {
            return window.setTimeout(function () {
                callback(Date.now());
            }, 1000 / 60); // 60 FPS
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function (id) {
            clearTimeout(id);
        };
    }

    // Escape HTML para prevenir XSS en innerHTML
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Cache de elementos DOM
    var cache = {};
    function getEl(id) {
        if (!cache[id]) cache[id] = document.getElementById(id);
        return cache[id];
    }
    function clearCache() { cache = {}; }

    // Debouncing
    var updateTimeout = null;
    function debounceUpdate(fn, delay) {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(fn, delay || 50);
    }

    // URL params
    function getURLParameter(name) {
        var url = window.location.search.substring(1);
        var params = url.split('&');
        for (var i = 0; i < params.length; i++) {
            var param = params[i].split('=');
            if (param[0] === name) return decodeURIComponent(param[1]);
        }
        return null;
    }

    // XHR simple wrapper (ES5 compatible, no fetch)
    function xhr(method, url, callback) {
        var x = new XMLHttpRequest();
        x.open(method, url, true);
        x.onreadystatechange = function () {
            if (x.readyState === 4) {
                if (x.status === 200) {
                    try { callback(null, JSON.parse(x.responseText)); }
                    catch (e) { callback(e, null); }
                } else { callback(new Error('HTTP ' + x.status), null); }
            }
        };
        x.onerror = function () { callback(new Error('Network error'), null); };
        x.send();
    }

    // Modal UI
    function showTvModal(title, message, type) {
        var existing = document.getElementById('xiro-tv-modal');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'xiro-tv-modal';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.left = '0';
        overlay.style.background = 'rgba(0,0,0,0.7)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '9999';
        overlay.style.padding = '20px';

        var modal = document.createElement('div');
        modal.style.background = '#ffffff';
        modal.style.borderRadius = '18px';
        modal.style.maxWidth = '420px';
        modal.style.width = '100%';
        modal.style.padding = '20px';
        modal.style.boxShadow = '0 20px 50px rgba(0,0,0,0.35)';
        modal.style.border = '4px solid ' + (type === 'error' ? '#fca5a5' : type === 'warning' ? '#facc15' : '#93c5fd');
        modal.style.fontFamily = 'Arial, sans-serif';

        var titleEl = document.createElement('div');
        titleEl.textContent = _t(tr(title || 'Aviso'));
        titleEl.style.fontSize = '20px';
        titleEl.style.fontWeight = '800';

        var msgEl = document.createElement('div');
        msgEl.textContent = _t(tr(message || ''));
        msgEl.style.marginTop = '10px';
        msgEl.style.fontSize = '16px';
        msgEl.style.lineHeight = '1.4';

        var actions = document.createElement('div');
        actions.style.marginTop = '16px';
        actions.style.textAlign = 'center';

        var btn = document.createElement('button');
        btn.textContent = _t(tr('OK'));
        btn.style.background = '#2563eb';
        btn.style.color = '#ffffff';
        btn.style.border = 'none';
        btn.style.padding = '10px 20px';
        btn.style.borderRadius = '999px';
        btn.style.fontWeight = '800';
        btn.style.cursor = 'pointer';
        btn.onclick = function () { overlay.remove(); };

        actions.appendChild(btn);
        modal.appendChild(titleEl);
        modal.appendChild(msgEl);
        modal.appendChild(actions);
        overlay.appendChild(modal);

        overlay.onclick = function (event) {
            if (event.target === overlay) overlay.remove();
        };

        document.addEventListener('keydown', function onKey(event) {
            if (event.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', onKey);
            }
        });

        document.body.appendChild(overlay);
    }

    return {
        getEl: getEl,
        clearCache: clearCache,
        debounceUpdate: debounceUpdate,
        getURLParameter: getURLParameter,
        xhr: xhr,
        showTvModal: showTvModal,
        escapeHtml: escapeHtml
    };
})();
