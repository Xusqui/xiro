/**
 * @fileoverview Panel de configuración de la IA (Groq y Gemini).
 * Añade la pestaña "IA" al panel de configuración del servidor: proveedor activo,
 * respaldo automático y una tarjeta por proveedor con su API key y su modelo.
 * Depende de: config-panel.js y neon-switch.js cargados previamente.
 */

/* ===== REGISTRO DE TAB ===== */
(function _registerAITab() {
    if (typeof _PARAM_SECTIONS !== 'undefined') {
        _PARAM_SECTIONS.push({
            id: 'groq',
            titleKey: 'admin.config.tab.groq',
            icon: 'fa-robot',
            color: 'bg-plum-500',
            isGroq: true,
            keys: []
        });
    }
})();

/* ===== PROVEEDORES ===== */

const AI_PROVIDER_META = {
    groq: {
        label: 'Groq',
        titleKey: 'admin.groq.title',
        deleteMsgKey: 'admin.groq.delete_msg',
        placeholder: 'gsk_...',
        icon: 'fa-bolt',
        models: [
            { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Calidad Alta: ★★★★★ | Velocidad: ★★★☆☆)' },
            { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout (Avanzado/Rápido: ★★★★★ | Calidad: ★★★★☆)' },
            { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B (Razonamiento Complejo: ★★★★★)' },
            { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B (Equilibrio: ★★★★☆)' },
            { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B (Eficiencia/Multilingüe: ★★★★☆)' },
            { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2 (Texto/Equilibrio: ★★★★☆)' }
        ]
    },
    gemini: {
        label: 'Gemini (Google)',
        titleKey: 'admin.gemini.title',
        deleteMsgKey: 'admin.gemini.delete_msg',
        placeholder: 'AQ....',
        icon: 'fa-gem',
        models: [
            { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (el más rápido y económico)' },
            { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (bajo coste)' },
            { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (el Flash más potente)' },
            { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview, máxima calidad)' }
        ]
    }
};

/* ===== RENDER DEL TAB ===== */

function renderAIConfigTab() {
    const area = document.getElementById('config-tab-content');
    if (area) area.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.groq.loading')}</div>`);

    fetch('/api/ai-generator/config', { headers: { 'Authorization': 'Bearer ' + getAuthToken() } })
        .then(r => r.json())
        .then(data => {
            const liveArea = document.getElementById('config-tab-content');
            if (liveArea) liveArea.innerHTML = _tHtml(_renderAIConfigForm(data));
        })
        .catch(() => {
            const liveArea = document.getElementById('config-tab-content');
            if (liveArea) liveArea.innerHTML = _tHtml(`<p class="text-red-500 font-medium">${_t('admin.groq.error_load')}</p>`);
        });
}

/* ===== FORMULARIO ===== */

function _renderAIConfigForm(data) {
    const providers = data.providers || {};
    return `
    <div class="space-y-6 mb-8">
        ${_renderAISettingsCard(data)}
        ${Object.keys(AI_PROVIDER_META).map(id => _renderAIProviderCard(id, providers[id] || {}, data.provider === id)).join('')}
    </div>`;
}

function _aiStatusBadge(configured) {
    return configured
        ? `<span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold"><i class="fas fa-check-circle"></i> ${_t('admin.groq.configured')}</span>`
        : `<span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold"><i class="fas fa-exclamation-circle"></i> ${_t('admin.groq.not_configured')}</span>`;
}

function _renderAISettingsCard(data) {
    const providers = data.providers || {};
    const active = data.provider;
    const other = Object.keys(AI_PROVIDER_META).find(id => id !== active);
    const activeConfigured = Boolean(providers[active]?.configured);

    let warning = '';
    if (!activeConfigured) {
        const usesOther = data.fallback === true && Boolean(providers[other]?.configured);
        warning = `<p class="text-xs text-amber-700 font-medium"><i class="fas fa-exclamation-circle mr-1"></i>${usesOther ? _t('admin.ai.warn_no_key_fallback') : _t('admin.ai.warn_no_key')}</p>`;
    }

    const providerOptions = Object.keys(AI_PROVIDER_META).map(id =>
        `<option value="${id}" ${active === id ? 'selected' : ''}>${escapeHtml(AI_PROVIDER_META[id].label)}</option>`
    ).join('');

    return `
        <div class="bg-white rounded-2xl border-2 border-slate-200 p-6">
            <div class="flex items-center gap-3 mb-5">
                <div class="w-10 h-10 bg-plum-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-robot text-plum-600"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800">${_t('admin.ai.settings_title')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('admin.ai.settings_subtitle')}</p>
                </div>
            </div>

            <div class="space-y-4">
                <div>
                    <label for="ai-provider-select" class="block text-sm font-bold text-slate-700 mb-2">
                        ${_t('admin.ai.label_provider')}
                    </label>
                    <select id="ai-provider-select"
                        class="w-full border-2 border-slate-200 rounded-xl p-3 font-sans text-sm focus:border-plum-500 outline-none bg-white text-slate-800 appearance-none">
                        ${providerOptions}
                    </select>
                </div>

                <div class="flex items-center justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-slate-700 text-sm mb-1">${_t('admin.ai.fallback_label')}</p>
                        <p class="text-xs text-slate-500 leading-relaxed">${_t('admin.ai.fallback_desc')}</p>
                    </div>
                    ${renderNeonSwitch({ key: 'ai-fallback', id: 'ai-fallback-switch', action: null, checked: data.fallback === true, label: _t('admin.ai.fallback_label') })}
                </div>
                ${warning}
            </div>

            <div class="flex flex-wrap gap-3 mt-5">
                <button data-admin-action="ai-save-settings"
                    class="flex items-center gap-2 bg-camaleon-600 hover:bg-camaleon-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
                    <i class="fas fa-save text-xs"></i> ${_t('admin.ai.btn_save_settings')}
                </button>
            </div>
            <div id="ai-settings-result" class="mt-3 text-sm"></div>
        </div>`;
}

function _renderAIProviderCard(provider, info, isActive) {
    const meta = AI_PROVIDER_META[provider];
    const configured = info.configured === true;
    const model = info.model || meta.models[0].id;

    // Si el modelo guardado no está en la lista (p. ej. GROQ_MODEL), se ofrece igualmente
    const models = meta.models.some(m => m.id === model)
        ? meta.models
        : [{ id: model, label: model }, ...meta.models];
    const modelOptions = models.map(m =>
        `<option value="${escapeHtml(m.id)}" ${model === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>`
    ).join('');

    const activeBadge = isActive
        ? `<span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-plum-100 text-plum-600 font-bold"><i class="fas fa-star"></i> ${_t('admin.ai.badge_active')}</span>`
        : '';

    return `
        <div class="bg-white rounded-2xl border-2 border-slate-200 p-6">
            <div class="flex items-center gap-3 mb-5">
                <div class="w-10 h-10 bg-plum-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas ${meta.icon} text-plum-600"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800">${_t(meta.titleKey)}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('admin.groq.subtitle')}</p>
                </div>
                <div class="ml-auto flex flex-wrap gap-2">${activeBadge}${_aiStatusBadge(configured)}</div>
            </div>

            <div class="space-y-4">
                <div>
                    <label for="ai-key-input-${provider}" class="block text-sm font-bold text-slate-700 mb-2">
                        ${configured ? _t('admin.groq.label_api_set') : _t('admin.groq.label_api')}
                    </label>
                    <input id="ai-key-input-${provider}" autocomplete="off"
                        ${configured ? `value="${escapeHtml(info.maskedKey || '')}" disabled` : ''}
                        placeholder="${meta.placeholder}"
                        class="w-full border-2 border-slate-200 rounded-xl p-3 font-mono text-sm focus:border-plum-500 outline-none transition ${configured ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'}">
                </div>

                <div>
                    <label for="ai-model-select-${provider}" class="block text-sm font-bold text-slate-700 mb-2">
                        ${_t('admin.groq.label_model')}
                    </label>
                    <select id="ai-model-select-${provider}"
                        class="w-full border-2 border-slate-200 rounded-xl p-3 font-sans text-sm focus:border-plum-500 outline-none bg-white text-slate-800 appearance-none">
                        ${modelOptions}
                    </select>
                    <p class="text-xs text-slate-400 mt-2">${_t('admin.groq.model_desc')}</p>
                </div>
            </div>

            <div class="flex flex-wrap gap-3 mt-5">
                <button data-admin-action="ai-save-key" data-provider="${provider}"
                    class="flex items-center gap-2 bg-camaleon-600 hover:bg-camaleon-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
                    <i class="fas fa-save text-xs"></i> ${configured ? _t('admin.groq.btn_update') : _t('admin.groq.btn_save')}
                </button>
                ${configured ? `<button data-admin-action="ai-delete-key" data-provider="${provider}"
                    class="flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 font-bold px-5 py-2.5 rounded-xl border-2 border-red-200 transition-all text-sm">
                    <i class="fas fa-trash text-xs"></i> ${_t('admin.groq.btn_delete')}
                </button>` : ''}
            </div>
            <div id="ai-result-${provider}" class="mt-3 text-sm"></div>
        </div>`;
}

/* ===== ACCIONES ===== */

function _aiShowResult(resultEl, kind, text) {
    if (!resultEl) return;
    const styles = {
        ok: ['text-emerald-600 font-semibold', 'fa-check-circle'],
        error: ['text-red-600 font-medium', 'fa-times-circle'],
        busy: ['text-slate-400', 'fa-spin fa-circle-notch']
    };
    const [cls, icon] = styles[kind];
    resultEl.innerHTML = _tHtml(`<span class="${cls}"><i class="fas ${icon} mr-1"></i>${text}</span>`);
}

function saveAISettings() {
    const providerSelect = document.getElementById('ai-provider-select');
    const fallbackSwitch = document.getElementById('ai-fallback-switch');
    const resultEl = document.getElementById('ai-settings-result');
    if (!providerSelect || !fallbackSwitch) return;

    _aiShowResult(resultEl, 'busy', _t('admin.groq.saving'));

    fetch('/api/ai-generator/config/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ provider: providerSelect.value, fallback: fallbackSwitch.checked })
    }).then(r => r.json()).then(data => {
        if (data.success) {
            _aiShowResult(resultEl, 'ok', _t('admin.ai.settings_ok'));
            setTimeout(renderAIConfigTab, 800);
        } else {
            _aiShowResult(resultEl, 'error', escapeHtml(data.error || _t('admin.tools.error_unknown')));
        }
    }).catch(() => _aiShowResult(resultEl, 'error', _t('admin.groq.error_net')));
}

function saveAIProviderKey(provider) {
    const input = document.getElementById('ai-key-input-' + provider);
    const modelSelect = document.getElementById('ai-model-select-' + provider);
    const resultEl = document.getElementById('ai-result-' + provider);

    const isConfigured = input && input.disabled;
    const key = input && !isConfigured ? input.value.trim() : '';
    const model = modelSelect ? modelSelect.value : null;

    if (!isConfigured && !key) {
        _aiShowResult(resultEl, 'error', _t('admin.groq.error_no_key'));
        return;
    }
    _aiShowResult(resultEl, 'busy', _t('admin.groq.saving'));

    fetch('/api/ai-generator/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ provider, apiKey: key, model })
    }).then(r => r.json()).then(data => {
        if (data.success) {
            _aiShowResult(resultEl, 'ok', _t('admin.groq.save_ok'));
            setTimeout(renderAIConfigTab, 800);
        } else {
            _aiShowResult(resultEl, 'error', escapeHtml(data.error || _t('admin.tools.error_unknown')));
        }
    }).catch(() => _aiShowResult(resultEl, 'error', _t('admin.groq.error_net')));
}

function deleteAIProviderKey(provider) {
    const meta = AI_PROVIDER_META[provider];
    if (!meta) return;
    mostrarModalConfirmacion(
        _t('admin.groq.delete_title'),
        _t(meta.deleteMsgKey),
        () => {
            const resultEl = document.getElementById('ai-result-' + provider);
            _aiShowResult(resultEl, 'busy', _t('admin.groq.deleting'));

            fetch('/api/ai-generator/config?provider=' + encodeURIComponent(provider), {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + getAuthToken() }
            }).then(r => r.json()).then(data => {
                if (data.success) setTimeout(renderAIConfigTab, 400);
                else _aiShowResult(resultEl, 'error', _t('admin.groq.error_delete'));
            }).catch(() => _aiShowResult(resultEl, 'error', _t('admin.groq.error_net')));
        }
    );
}
