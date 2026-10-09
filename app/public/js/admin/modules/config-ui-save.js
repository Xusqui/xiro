/**
 * @fileoverview Guardado único de la pestaña "IA" del panel de configuración.
 * Compara el formulario con lo que había al pintarlo y, al pulsar "Guardar configuración",
 * envía solo lo que ha cambiado, en orden: primero las conexiones de cada proveedor y
 * después proveedor principal + respaldo (así el principal ya está configurado al elegirlo).
 * Si una petición falla se para ahí, se abre la fila del proveedor con el error y el
 * formulario conserva lo escrito.
 * Depende de: config-ui.js, config-ui-providers.js y config-ui-ollama.js cargados previamente.
 */

/** Valores del formulario al pintarlo; se compara con ellos para saber si hay cambios. */
let _aiInitial = null;

function _aiCloudProviders() {
    return Object.keys(AI_PROVIDER_META).filter(id => id !== 'ollama');
}

function _aiSnapshot() {
    const val = id => document.getElementById(id)?.value ?? '';
    const snap = {
        provider: document.querySelector('#ai-config-form input[name="ai-provider"]:checked')?.value || '',
        fallback: Boolean(document.getElementById('ai-fallback-switch')?.checked),
        ollamaUrl: val('ai-ollama-url').trim(),
        ollamaModel: val('ai-model-select-ollama'),
        ollamaKey: val('ai-ollama-key').trim()
    };
    _aiCloudProviders().forEach(id => {
        snap[id + 'Key'] = val('ai-key-input-' + id).trim();
        snap[id + 'Model'] = val('ai-model-select-' + id);
    });
    return snap;
}

/* ===== ESTADO DE LA BARRA ===== */

function _aiSetStatus(state, html) {
    const bar = document.getElementById('ai-savebar');
    const statusEl = document.getElementById('ai-save-status');
    if (!bar || !statusEl) return;
    bar.dataset.state = state;
    const busy = state === 'saving';
    const clean = state === 'clean' || state === 'ok';
    document.getElementById('ai-save-btn').disabled = busy || clean;
    document.getElementById('ai-discard-btn').disabled = busy || clean;
    const icon = { saving: 'fa-spin fa-circle-notch', ok: 'fa-check-circle', error: 'fa-times-circle' }[state];
    statusEl.innerHTML = _tHtml((icon ? `<i class="fas ${icon}"></i>` : '<span class="aic-dot"></span>') + `<span>${html}</span>`);
}

/** Recalcula si hay cambios sin guardar y actualiza la barra. */
function _aiRefreshDirty() {
    const bar = document.getElementById('ai-savebar');
    if (!bar || !_aiInitial || bar.dataset.state === 'saving') return;
    const dirty = JSON.stringify(_aiSnapshot()) !== JSON.stringify(_aiInitial);
    if (dirty) _aiSetStatus('dirty', _t('admin.ai.state_dirty'));
    else _aiSetStatus('clean', _t('admin.ai.state_clean'));
}

function _aiShowRowError(provider, html) {
    const el = document.getElementById('ai-error-' + provider);
    if (!el) return;
    el.hidden = !html;
    el.innerHTML = html ? _tHtml(`<i class="fas fa-exclamation-circle"></i> <span>${html}</span>`) : '';
}

/* ===== EVENTOS DEL FORMULARIO ===== */

/** Marca la fila del nuevo principal y, si aún no tiene conexión, la abre para configurarla. */
function _aiSyncPrimary(provider) {
    document.querySelectorAll('#ai-config-form .aic-row').forEach(row => {
        row.toggleAttribute('data-primary', row.dataset.provider === provider);
    });
    const row = document.getElementById('ai-row-' + provider);
    if (row && !_aiConfigData?.providers?.[provider]?.configured) row.open = true;
}

function _aiOnFormChange(event) {
    const target = event.target;
    if (target.name === 'ai-provider' && event.type === 'change') _aiSyncPrimary(target.value);
    const row = target.closest('.aic-row');
    if (row) _aiShowRowError(row.dataset.provider, '');
    _aiUpdateActiveWarning();
    _aiRefreshDirty();
}

/** Se llama tras pintar el formulario (renderAIConfigTab). */
function _aiBindForm() {
    const form = document.getElementById('ai-config-form');
    if (!form) return;
    _aiInitial = _aiSnapshot();
    form.addEventListener('input', _aiOnFormChange);
    form.addEventListener('change', _aiOnFormChange);
    form.addEventListener('submit', event => {
        event.preventDefault();
        saveAIConfig();
    });
    _aiUpdateActiveWarning();
    _aiSetStatus('clean', _t('admin.ai.state_clean'));
}

/* ===== GUARDAR ===== */

/** Peticiones necesarias para guardar lo cambiado; las inválidas llevan { error }. */
function _aiBuildRequests() {
    const now = _aiSnapshot();
    const providers = _aiConfigData?.providers || {};
    const requests = [];

    _aiCloudProviders().forEach(id => {
        const apiKey = now[id + 'Key'];
        const model = now[id + 'Model'];
        const modelChanged = model !== _aiInitial[id + 'Model'];
        // Sin clave guardada ni escrita, cambiar el modelo no tiene nada que guardar
        if (apiKey || (providers[id]?.configured && modelChanged)) {
            requests.push({ provider: id, method: 'POST', url: '/api/ai-generator/config', body: { provider: id, apiKey, model } });
        }
    });

    const ollama = _ollamaSaveRequest({ url: _aiInitial.ollamaUrl, model: _aiInitial.ollamaModel });
    if (ollama) requests.push({ provider: 'ollama', method: 'POST', ...ollama });

    if (now.provider !== _aiInitial.provider || now.fallback !== _aiInitial.fallback) {
        requests.push({ provider: null, method: 'PUT', url: '/api/ai-generator/config/settings', body: { provider: now.provider, fallback: now.fallback } });
    }
    return requests;
}

function _aiFail(provider, html) {
    if (provider) {
        const row = document.getElementById('ai-row-' + provider);
        if (row) {
            row.open = true;
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        _aiShowRowError(provider, html);
        _aiSetStatus('error', _t('admin.ai.save_error', { provider: escapeHtml(AI_PROVIDER_META[provider].label) }));
    } else {
        _aiSetStatus('error', html);
    }
}

async function saveAIConfig() {
    const bar = document.getElementById('ai-savebar');
    if (!bar || !_aiInitial || bar.dataset.state === 'saving') return;
    Object.keys(AI_PROVIDER_META).forEach(id => _aiShowRowError(id, ''));

    const requests = _aiBuildRequests();
    const invalid = requests.find(r => r.error);
    if (invalid) return _aiFail(invalid.provider, invalid.error);
    if (!requests.length) return _aiRefreshDirty();

    _aiSetStatus('saving', _t('admin.groq.saving'));
    for (const req of requests) {
        let data;
        try {
            const res = await fetch(req.url, {
                method: req.method,
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
                body: JSON.stringify(req.body)
            });
            data = await res.json();
        } catch {
            return _aiFail(req.provider, _t('admin.groq.error_net'));
        }
        if (!data.success) return _aiFail(req.provider, escapeHtml(data.error || _t('admin.tools.error_unknown')));
    }
    _aiSetStatus('ok', _t('admin.groq.save_ok'));
    setTimeout(renderAIConfigTab, 900);
}

/* ===== DESCARTAR Y BORRAR ===== */

function discardAIConfigChanges() {
    renderAIConfigTab();
}

function deleteAIProviderKey(provider) {
    const meta = AI_PROVIDER_META[provider];
    if (!meta) return;
    mostrarModalConfirmacion(_t('admin.groq.delete_title'), _t(meta.deleteMsgKey), () => {
        fetch('/api/ai-generator/config?provider=' + encodeURIComponent(provider), {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + getAuthToken() }
        }).then(r => r.json()).then(data => {
            if (data.success) renderAIConfigTab();
            else _aiShowRowError(provider, _t('admin.groq.error_delete'));
        }).catch(() => _aiShowRowError(provider, _t('admin.groq.error_net')));
    });
}
