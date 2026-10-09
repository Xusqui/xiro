/**
 * @fileoverview Fila de Ollama en la pestaña "IA" del panel de configuración.
 * Se indica la URL del servidor, se cargan los modelos instalados (el servidor
 * de Xiro! consulta /api/tags) y se elige uno. La API key es opcional: solo hace
 * falta si Ollama está detrás de un proxy con autenticación o es Ollama Cloud.
 * Vacía al guardar = se mantiene la guardada (si la URL no cambia).
 * El guardado va con el resto de la pestaña (config-ui-save.js).
 * Depende de: config-ui.js y config-ui-providers.js (_renderAIRow) cargados previamente.
 */

function _ollamaModelLabel(m) {
    const extra = [];
    if (m.parameterSize) extra.push(m.parameterSize);
    if (m.size) extra.push((m.size / 1e9).toFixed(1) + ' GB');
    return extra.length ? `${m.name} (${extra.join(' · ')})` : m.name;
}

function _ollamaModelOptions(models, selected) {
    if (!models.length) {
        return `<option value="">${escapeHtml(_t('admin.ollama.model_placeholder'))}</option>`;
    }
    return models.map(m =>
        `<option value="${escapeHtml(m.name)}" ${m.name === selected ? 'selected' : ''}>${escapeHtml(_ollamaModelLabel(m))}</option>`
    ).join('');
}

function _renderOllamaRow(info, isActive) {
    // Hasta cargar la lista real, el modelo guardado es la única opción
    const savedModels = info.model ? [{ name: info.model }] : [];
    const keyPlaceholder = info.maskedKey
        ? _t('admin.ollama.key_saved', { key: info.maskedKey })
        : _t('admin.ollama.key_placeholder');

    const body = `
        <div class="aic-fields">
            <div class="aic-field aic-field--wide">
                <label for="ai-ollama-url" class="aic-label">${_t('admin.ollama.label_url')}</label>
                <div class="aic-inline">
                    <input id="ai-ollama-url" type="url" autocomplete="off" spellcheck="false" value="${escapeHtml(info.baseUrl || '')}"
                        placeholder="http://192.168.1.10:11434" class="aic-input aic-input--mono">
                    <button type="button" data-admin-action="ai-ollama-load-models" class="aic-btn aic-btn--secondary">
                        <i class="fas fa-sync-alt"></i> ${_t('admin.ollama.btn_load')}
                    </button>
                </div>
                <p class="aic-hint">${_t('admin.ollama.url_desc')}</p>
            </div>
            <div class="aic-field">
                <label for="ai-model-select-ollama" class="aic-label">${_t('admin.ollama.label_model')}</label>
                <select id="ai-model-select-ollama" class="aic-input aic-select">${_ollamaModelOptions(savedModels, info.model)}</select>
                <p class="aic-hint" id="ai-ollama-models-status">${_t('admin.ollama.model_desc')}</p>
            </div>
            <div class="aic-field">
                <label for="ai-ollama-key" class="aic-label">${_t('admin.ollama.label_key')}</label>
                <input id="ai-ollama-key" type="password" autocomplete="new-password" spellcheck="false"
                    placeholder="${escapeHtml(keyPlaceholder)}" class="aic-input aic-input--mono">
                <p class="aic-hint">${_t('admin.ollama.key_desc')}</p>
            </div>
        </div>`;

    return _renderAIRow('ollama', info, isActive, {
        subtitle: _t('admin.ollama.subtitle'),
        body,
        deleteLabel: _t('admin.ollama.btn_delete')
    });
}

/** Clave escrita en el formulario; vacía = el servidor usa la guardada para esa URL. */
function _ollamaTypedKey() {
    const input = document.getElementById('ai-ollama-key');
    return input ? input.value.trim() : '';
}

function _ollamaModelsStatus(kind, text) {
    const el = document.getElementById('ai-ollama-models-status');
    if (!el) return;
    el.dataset.kind = kind;
    el.innerHTML = _tHtml(kind === 'busy' ? `<i class="fas fa-spin fa-circle-notch"></i> ${text}` : text);
}

/**
 * Pide al servidor la lista de modelos instalados en la URL escrita.
 * @param {boolean} [quiet] - sin mensajes de progreso ni de éxito (carga automática al abrir la pestaña)
 */
function loadOllamaModels(quiet) {
    const urlInput = document.getElementById('ai-ollama-url');
    const select = document.getElementById('ai-model-select-ollama');
    if (!urlInput || !select) return;

    _aiShowRowError('ollama', '');
    const baseUrl = urlInput.value.trim();
    if (!baseUrl) {
        _aiShowRowError('ollama', _t('admin.ollama.error_no_url'));
        urlInput.focus();
        return;
    }
    if (!quiet) _ollamaModelsStatus('busy', _t('admin.ollama.loading_models'));

    fetch('/api/ai-generator/ollama/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ baseUrl, apiKey: _ollamaTypedKey() })
    }).then(r => r.json()).then(data => {
        if (!data.success) {
            _ollamaModelsStatus('idle', _t('admin.ollama.model_desc'));
            _aiShowRowError('ollama', escapeHtml(data.error || _t('admin.tools.error_unknown')));
            return;
        }
        const previous = select.value;
        select.innerHTML = _ollamaModelOptions(data.models, previous);
        if (!data.models.length) {
            _ollamaModelsStatus('idle', _t('admin.ollama.model_desc'));
            _aiShowRowError('ollama', _t('admin.ollama.no_models'));
        } else if (!quiet) {
            _ollamaModelsStatus('ok', `<i class="fas fa-check-circle"></i> ${_t('admin.ollama.models_ok', { count: data.models.length })}`);
        }
        // Cambiar la lista puede cambiar el modelo elegido: se recalcula si hay cambios
        if (select.value !== previous) refreshConfigSaveBar();
    }).catch(() => {
        _ollamaModelsStatus('idle', _t('admin.ollama.model_desc'));
        _aiShowRowError('ollama', _t('admin.groq.error_net'));
    });
}

/**
 * Petición de guardado de Ollama, o null si no hay nada que guardar.
 * @param {{ url: string, model: string }} initial - valores al pintar la pestaña
 * @returns {null | { error: string } | { url: string, body: object }}
 */
function _ollamaSaveRequest(initial) {
    const baseUrl = (document.getElementById('ai-ollama-url')?.value || '').trim();
    const model = document.getElementById('ai-model-select-ollama')?.value || '';
    const apiKey = _ollamaTypedKey();

    if (baseUrl === initial.url && model === initial.model && !apiKey) return null;
    if (!baseUrl) return apiKey || model !== initial.model ? { error: _t('admin.ollama.error_no_url') } : null;
    if (!model) return { error: _t('admin.ollama.error_no_model') };
    return { url: '/api/ai-generator/ollama/config', body: { baseUrl, model, apiKey } };
}
