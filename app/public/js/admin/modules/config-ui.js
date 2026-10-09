/**
 * @fileoverview Pestaña "IA" del panel de configuración (Groq, Gemini y Ollama).
 * Un único formulario: proveedor principal + respaldo arriba y una fila plegable por
 * proveedor con su conexión. Se guarda con la barra común de Configuración (config-savebar.js).
 * Depende de: config-panel.js, config-savebar.js y checkbox.js cargados previamente.
 * Filas de proveedor: config-ui-providers.js (Groq/Gemini) y config-ui-ollama.js.
 * Guardado y borrado: config-ui-save.js.
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
    },
    // Sin lista fija de modelos: su fila la pinta _renderOllamaRow (config-ui-ollama.js)
    ollama: {
        label: 'Ollama (local)',
        titleKey: 'admin.ollama.title',
        deleteMsgKey: 'admin.ollama.delete_msg',
        icon: 'fa-server'
    }
};

/** Última respuesta de GET /api/ai-generator/config (estado guardado en el servidor). */
let _aiConfigData = null;

/* ===== RENDER DEL TAB ===== */

function renderAIConfigTab() {
    unbindConfigSaveBar();
    const area = document.getElementById('config-tab-content');
    if (area) area.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.groq.loading')}</div>`);

    fetch('/api/ai-generator/config', { headers: { 'Authorization': 'Bearer ' + getAuthToken() } })
        .then(r => r.json())
        .then(data => {
            const liveArea = document.getElementById('config-tab-content');
            if (!liveArea) return;
            _aiConfigData = data;
            liveArea.innerHTML = _tHtml(_renderAIConfigForm(data));
            _aiBindForm();
            if (data.providers?.ollama?.baseUrl && typeof loadOllamaModels === 'function') loadOllamaModels(true);
        })
        .catch(() => {
            const liveArea = document.getElementById('config-tab-content');
            if (liveArea) liveArea.innerHTML = _tHtml(`<p class="text-red-500 font-medium">${_t('admin.groq.error_load')}</p>`);
        });
}

function _renderAIConfigForm(data) {
    const providers = data.providers || {};
    const rows = Object.keys(AI_PROVIDER_META).map(id => id === 'ollama'
        ? _renderOllamaRow(providers.ollama || {}, data.provider === id)
        : _renderAIProviderRow(id, providers[id] || {}, data.provider === id)).join('');

    return `
    <form id="ai-config-form" class="aic" novalidate autocomplete="off">
        <section class="aic-card" aria-labelledby="aic-primary-title">
            <header class="aic-card__head">
                <h2 id="aic-primary-title" class="aic-card__title">${_t('admin.ai.label_provider')}</h2>
                <p class="aic-card__desc">${_t('admin.ai.settings_subtitle')}</p>
            </header>
            <fieldset class="aic-tiles">
                <legend class="aic-sr-only">${_t('admin.ai.label_provider')}</legend>
                ${Object.keys(AI_PROVIDER_META).map(id => _renderAITile(id, providers[id] || {}, data.provider === id)).join('')}
            </fieldset>
            <div class="aic-fallback">
                <div class="aic-fallback__text">
                    <p class="aic-fallback__label">${_t('admin.ai.fallback_label')}</p>
                    <p class="aic-hint">${_t('admin.ai.fallback_desc')}</p>
                </div>
                ${renderCheckbox({ key: 'ai-fallback', id: 'ai-fallback-switch', action: null, checked: data.fallback === true, label: _t('admin.ai.fallback_label') })}
            </div>
            <p id="ai-active-warning" class="aic-warning" hidden></p>
        </section>

        <section class="aic-card aic-card--flush" aria-labelledby="aic-providers-title">
            <header class="aic-card__head aic-card__head--padded">
                <h2 id="aic-providers-title" class="aic-card__title">${_t('admin.ai.section_providers')}</h2>
                <p class="aic-card__desc">${_t('admin.ai.section_providers_desc')}</p>
            </header>
            ${rows}
        </section>
    </form>`;
}

/* ===== PROVEEDOR PRINCIPAL ===== */

function _renderAITile(id, info, isActive) {
    const meta = AI_PROVIDER_META[id];
    const configured = info.configured === true;
    const status = configured
        ? `<span class="aic-dot aic-dot--ok"></span>${_t('admin.groq.configured')}`
        : `<span class="aic-dot"></span>${_t('admin.groq.not_configured')}`;
    return `
        <label class="aic-tile">
            <input type="radio" name="ai-provider" value="${id}" class="aic-tile__input" ${isActive ? 'checked' : ''}>
            <span class="aic-tile__icon"><i class="fas ${meta.icon}"></i></span>
            <span class="aic-tile__body">
                <span class="aic-tile__name">${escapeHtml(meta.label)}</span>
                <span class="aic-tile__status">${status}</span>
                ${configured && info.model ? `<span class="aic-tile__model" title="${escapeHtml(info.model)}">${escapeHtml(info.model)}</span>` : ''}
            </span>
            <span class="aic-tile__check" aria-hidden="true"><i class="fas fa-check"></i></span>
        </label>`;
}

/** Avisa si el proveedor elegido como principal no tiene conexión guardada. */
function _aiUpdateActiveWarning() {
    const warningEl = document.getElementById('ai-active-warning');
    const checked = document.querySelector('#ai-config-form input[name="ai-provider"]:checked');
    const fallbackSwitch = document.getElementById('ai-fallback-switch');
    if (!warningEl || !checked || !_aiConfigData) return;

    const providers = _aiConfigData.providers || {};
    const active = checked.value;
    if (providers[active]?.configured) {
        warningEl.hidden = true;
        return;
    }
    const usesOther = fallbackSwitch?.checked
        && Object.keys(AI_PROVIDER_META).some(id => id !== active && providers[id]?.configured);
    warningEl.innerHTML = _tHtml(`<i class="fas fa-exclamation-circle"></i> ${usesOther ? _t('admin.ai.warn_no_key_fallback') : _t('admin.ai.warn_no_key')}`);
    warningEl.hidden = false;
}
