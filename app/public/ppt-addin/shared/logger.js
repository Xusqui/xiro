/**
 * @module addin-logger
 * @description Logger del add-in: muestra un panel de debug en el task pane
 *   Y envía los logs al servidor (POST /api/addin-log) para que aparezcan
 *   en el Winston del backend.
 *   API: XiroLog.debug/info/warn/error(module, message, data?)
 *        XiroLog.mountPanel(container) — añade panel desplegable de logs
 * @depends []
 */

const XiroLog = (() => {

    const _entries = [];
    let _panelEl = null;
    let _listEl = null;

    /* ── Niveles ─────────────────────────────────────── */
    function debug(mod, msg, data) { _log('debug', mod, msg, data); }
    function info(mod, msg, data) { _log('info', mod, msg, data); }
    function warn(mod, msg, data) { _log('warn', mod, msg, data); }
    function error(mod, msg, data) { _log('error', mod, msg, data); }

    /* ── Core ────────────────────────────────────────── */
    function _log(level, mod, msg, data) {
        const entry = {
            ts: new Date().toISOString(), level, mod, msg,
            data: data instanceof Error ? { name: data.name, message: data.message, stack: data.stack } : data
        };
        _entries.push(entry);
        if (_entries.length > 200) _entries.shift();

        // Consola del navegador
        const fn = level === 'error' ? console.error
            : level === 'warn' ? console.warn
                : level === 'debug' ? console.debug
                    : console.log;
        fn(`[xiro:${mod}]`, msg, data != null ? data : '');

        // Panel visual
        _appendToPanel(entry);

        // Enviar al servidor (fire-and-forget)
        _sendToServer(entry);
    }

    function _sendToServer(entry) {
        try {
            fetch('/api/addin-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: entry.level, module: entry.mod,
                    message: entry.msg, data: entry.data
                }),
            }).catch(() => { });     // ignorar fallos de red
        } catch (_) { }
    }

    /* ── Panel visual ────────────────────────────────── */

    /**
     * Monta un panel de debug desplegable en el contenedor dado.
     * @param {HTMLElement} container
     */
    function mountPanel(container) {
        if (!container) return;

        const wrap = document.createElement('div');
        wrap.id = 'xiro-log-panel';
        wrap.style.cssText = [
            'position:fixed;bottom:0;left:0;right:0;z-index:9999',
            'background:#0f172a;border-top:2px solid #7c3aed',
            'font-family:monospace;font-size:11px;max-height:40vh',
            'display:flex;flex-direction:column',
        ].join(';');

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:.5rem;padding:4px 8px;background:#1e293b;cursor:pointer;flex-shrink:0';
        header.innerHTML = '<span style="color:#a78bfa;font-weight:700">⬛ XIRO LOG</span>'
            + '<span id="xiro-log-count" style="color:#64748b">0</span>'
            + '<button id="xiro-log-clear" style="margin-left:auto;background:transparent;border:none;color:#64748b;cursor:pointer;font-size:11px">Limpiar</button>'
            + '<button id="xiro-log-toggle" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:11px">▼</button>';

        _listEl = document.createElement('div');
        _listEl.id = 'xiro-log-list';
        _listEl.style.cssText = 'overflow-y:auto;flex:1;padding:4px 8px';

        wrap.appendChild(header);
        wrap.appendChild(_listEl);
        container.appendChild(wrap);
        _panelEl = wrap;

        // Toggle collapse
        let collapsed = false;
        document.getElementById('xiro-log-toggle').addEventListener('click', () => {
            collapsed = !collapsed;
            _listEl.style.display = collapsed ? 'none' : '';
            document.getElementById('xiro-log-toggle').textContent = collapsed ? '▲' : '▼';
        });

        document.getElementById('xiro-log-clear').addEventListener('click', () => {
            if (_listEl) _listEl.innerHTML = '';
            _entries.length = 0;
            _updateCount();
        });

        // Replay entries ya acumuladas
        _entries.forEach(_appendToPanel);
    }

    function _appendToPanel(entry) {
        if (!_listEl) return;
        const color = { error: '#f87171', warn: '#fbbf24', info: '#86efac', debug: '#94a3b8' }[entry.level] || '#cbd5e1';
        const row = document.createElement('div');
        row.style.cssText = `color:${color};padding:1px 0;border-bottom:1px solid #1e293b;white-space:pre-wrap;word-break:break-all`;
        const dataStr = entry.data != null ? ' ' + JSON.stringify(entry.data) : '';
        row.textContent = `${entry.ts.slice(11, 23)} [${entry.level.toUpperCase()}] [${entry.mod}] ${entry.msg}${dataStr}`;
        _listEl.appendChild(row);
        _listEl.scrollTop = _listEl.scrollHeight;
        _updateCount();
    }

    function _updateCount() {
        const el = document.getElementById('xiro-log-count');
        if (el) el.textContent = _entries.length;
    }

    return { debug, info, warn, error, mountPanel };
})();
