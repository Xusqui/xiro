/**
 * @fileoverview Guardado de la pestaña "IA" del panel de configuración.
 * La barra común (config-savebar.js) detecta los cambios y, al pulsar "Guardar configuración",
 * llama a saveAIConfig, que envía solo lo cambiado y en orden: primero las conexiones de
 * cada proveedor y después proveedor principal + respaldo (así el principal ya está
 * configurado al elegirlo). Si una petición falla se para ahí, se abre la fila del
 * proveedor con el error y el formulario conserva lo escrito.
 * Depende de: config-savebar.js, config-ui.js, config-ui-providers.js y config-ui-ollama.js.
 */

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
}

/** Se llama tras pintar el formulario (renderAIConfigTab): eventos propios y barra común. */
function _aiBindForm() {
    const form = document.getElementById('ai-config-form');
    if (!form) return;
    form.addEventListener('input', _aiOnFormChange);
    form.addEventListener('change', _aiOnFormChange);
    // Intro en un campo = pulsar "Guardar configuración"
    form.addEventListener('submit', event => {
        event.preventDefault();
        saveConfigSaveBar();
    });
    _aiUpdateActiveWarning();
    bindConfigSaveBar({ snapshot: _aiSnapshot, save: saveAIConfig, discard: renderAIConfigTab });
}

/* ===== GUARDAR ===== */

/** Peticiones necesarias para guardar lo cambiado; las inválidas llevan { error }. */
function _aiBuildRequests(initial) {
    const now = _aiSnapshot();
    const providers = _aiConfigData?.providers || {};
    const requests = [];

    _aiCloudProviders().forEach(id => {
        const apiKey = now[id + 'Key'];
        const model = now[id + 'Model'];
        const modelChanged = model !== initial[id + 'Model'];
        // Sin clave guardada ni escrita, cambiar el modelo no tiene nada que guardar
        if (apiKey || (providers[id]?.configured && modelChanged)) {
            requests.push({ provider: id, method: 'POST', url: '/api/ai-generator/config', body: { provider: id, apiKey, model } });
        }
    });

    const ollama = _ollamaSaveRequest({ url: initial.ollamaUrl, model: initial.ollamaModel });
    if (ollama) requests.push({ provider: 'ollama', method: 'POST', ...ollama });

    if (now.provider !== initial.provider || now.fallback !== initial.fallback) {
        requests.push({ provider: null, method: 'PUT', url: '/api/ai-generator/config/settings', body: { provider: now.provider, fallback: now.fallback } });
    }
    return requests;
}

/** Muestra el error en la fila del proveedor y devuelve el resultado para la barra. */
function _aiFail(provider, html) {
    if (!provider) return { ok: false, message: html };
    const row = document.getElementById('ai-row-' + provider);
    if (row) {
        row.open = true;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    _aiShowRowError(provider, html);
    return { ok: false, message: _t('admin.ai.save_error', { provider: escapeHtml(AI_PROVIDER_META[provider].label) }) };
}

/**
 * Guardado de la pestaña IA (lo llama la barra común).
 * @param {object} initial - snapshot al pintar la pestaña
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function saveAIConfig(initial) {
    Object.keys(AI_PROVIDER_META).forEach(id => _aiShowRowError(id, ''));

    const requests = _aiBuildRequests(initial);
    const invalid = requests.find(r => r.error);
    if (invalid) return _aiFail(invalid.provider, invalid.error);

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
    // Se repinta para reflejar el estado guardado (insignias, clave enmascarada)
    setTimeout(renderAIConfigTab, 900);
    return { ok: true, message: _t('admin.groq.save_ok') };
}

/* ===== BORRAR ===== */

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
