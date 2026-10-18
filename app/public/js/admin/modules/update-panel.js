/**
 * @fileoverview Lógica del panel de actualizaciones del admin.
 * Requiere update-panel-view.js cargado previamente.
 */

(function registerUpdatesTab() {
    if (typeof _PARAM_SECTIONS === 'undefined') return;
    if (_PARAM_SECTIONS.some(section => section.id === 'updates')) return;

    _PARAM_SECTIONS.push({
        id: 'updates',
        titleKey: 'admin.config.tab.updates',
        icon: 'fa-cloud-download-alt',
        color: 'bg-blue-600',
        isUpdates: true,
        keys: []
    });
})();

let _updPollTimer = null;
let _updPollStartedAt = 0;
const _UPD_POLL_MS = 3000;
const _UPD_POLL_MAX_MS = 15 * 60 * 1000;

function _updHeaders(json) {
    const headers = { 'Authorization': 'Bearer ' + getAuthToken() };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
}

/** Renderiza el panel de actualizaciones. */
async function renderUpdatesTab(refresh = false) {
    unbindSaveBar();
    const area = document.getElementById('config-tab-content');
    if (!area) return;

    area.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.updates.loading')}</div>`);

    try {
        const url = `/api/admin/update/status${refresh ? '?refresh=1' : ''}`;
        const res = await fetch(url, { headers: _updHeaders() });
        const data = await res.json();

        if (!data.success) {
            area.innerHTML = _tHtml(`<p class="text-red-500 font-medium">${_t('admin.updates.error_load')}</p>`);
            return;
        }

        area.innerHTML = _tHtml(_updRenderPanel(data));

        if (data.progress && data.progress.state === 'running') {
            _updStartPolling(data.progress.targetVersion);
        }
    } catch (err) {
        area.innerHTML = _tHtml(`<p class="text-red-500 font-medium">${_t('admin.updates.error_load')}</p>`);
    }
}

/** Muestra un error en el inicio de actualización. */
function _updShowStartError(message) {
    const errorArea = document.getElementById('update-start-error');
    if (!errorArea) return;
    errorArea.classList.remove('hidden');
    errorArea.textContent = _t('admin.updates.start_error', { error: message });
}

/** Muestra el área de confirmación. */
function _updShowConfirm(count) {
    const confirmArea = document.getElementById('update-confirm');
    if (!confirmArea) return;
    confirmArea.classList.remove('hidden');
    const p = confirmArea.querySelector('p');
    if (p) p.textContent = _t('admin.updates.active_sessions', { count });
}

/** Interpreta la respuesta de POST /api/admin/update/start. */
async function _updHandleStartResponse(res) {
    if (res.status === 202) {
        const body = await res.json();
        _updShowProgress({ state: 'running', step: 'backup', log: [] }, body.targetVersion);
        _updStartPolling(body.targetVersion);
        return;
    }
    const body = await res.json().catch(() => ({}));
    if (body.code === 'ACTIVE_SESSIONS') _updShowConfirm(body.activeSessions);
    else _updShowStartError(body.error || body.code || String(res.status));
}

/** Inicia una actualización. */
async function _updStart(force, btn) {
    if (btn) btn.disabled = true;
    try {
        const res = await fetch('/api/admin/update/start', {
            method: 'POST',
            headers: _updHeaders(true),
            body: JSON.stringify({ force })
        });
        await _updHandleStartResponse(res);
    } catch (err) {
        _updShowStartError(err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

/** Muestra el progreso de actualización. */
function _updShowProgress(progress, version) {
    const actionArea = document.getElementById('update-action-area');
    if (!actionArea) return;

    actionArea.innerHTML = _tHtml(_updProgressCard(progress, version));
}

/** Inicia el polling para verificar el progreso. */
function _updStartPolling(version) {
    _updStopPolling();
    _updPollStartedAt = Date.now();
    _updPollTimer = setInterval(() => _updPollOnce(version), _UPD_POLL_MS);
}

/** Detiene el polling. */
function _updStopPolling() {
    if (_updPollTimer) {
        clearInterval(_updPollTimer);
        _updPollTimer = null;
    }
}

/** Verifica el progreso de actualización. */
async function _updPollOnce(version) {
    const actionArea = document.getElementById('update-action-area');
    if (!actionArea) {
        _updStopPolling();
        return;
    }

    if (Date.now() - _updPollStartedAt > _UPD_POLL_MAX_MS) {
        _updStopPolling();
        return;
    }

    try {
        const res = await fetch('/api/admin/update/progress', { headers: _updHeaders() });
        if (!res.ok) throw new Error('Network error');

        const body = await res.json();
        if (body.progress) {
            _updShowProgress(body.progress, version);

            if (body.progress.state === 'done') {
                _updStopPolling();
                setTimeout(() => location.reload(), 3000);
            } else if (body.progress.state === 'failed' || body.progress.state === 'rolled_back') {
                _updStopPolling();
            }
        }
    } catch (err) {
        const reconnecting = document.getElementById('update-reconnecting');
        if (reconnecting) {
            reconnecting.classList.remove('hidden');
        }

        // Intenta verificar la versión actual
        await _updCheckVersion(version);
    }
}

/** Verifica si la versión actual coincide con la esperada. */
async function _updCheckVersion(version) {
    try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (res.ok) {
            const body = await res.json();
            if (body.version === version) {
                _updStopPolling();
                _updShowProgress({ state: 'done', step: 'verify', log: [] }, version);
                setTimeout(() => location.reload(), 3000);
            }
        }
    } catch (err) {
        // Ignorar errores
    }
}

const _UPD_ACTIONS = {
    check: () => renderUpdatesTab(true),
    start: btn => _updStart(false, btn),
    'start-force': btn => _updStart(true, btn),
    cancel: () => {
        const confirmArea = document.getElementById('update-confirm');
        if (confirmArea) confirmArea.classList.add('hidden');
    }
};

document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-update-action]');
    if (!btn) return;

    const handler = _UPD_ACTIONS[btn.dataset.updateAction];
    if (handler) handler(btn);
});
