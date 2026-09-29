/**
 * @fileoverview Panel de configuración de Groq AI.
 * Añade la pestaña "IA" al panel de configuración del servidor.
 * Depende de: config-panel.js cargado previamente.
 */

/* ===== REGISTRO DE TAB ===== */
(function _registerGroqTab() {
    if (typeof _PARAM_SECTIONS !== 'undefined') {
        _PARAM_SECTIONS.push({
            id: 'groq',
            titleKey: 'admin.config.tab.groq',
            icon: 'fa-robot',
            color: 'bg-violet-500',
            isGroq: true,
            keys: []
        });
    }
})();

/* ===== RENDER DEL TAB ===== */

function renderGroqConfigTab() {
    const area = document.getElementById('config-tab-content');
    if (area) area.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.groq.loading')}</div>`);

    fetch('/api/ai-generator/config', { headers: { 'Authorization': 'Bearer ' + getAuthToken() } })
        .then(r => r.json())
        .then(data => {
            const liveArea = document.getElementById('config-tab-content');
            if (liveArea) liveArea.innerHTML = _tHtml(_renderGroqForm(data));
        })
        .catch(() => {
            const liveArea = document.getElementById('config-tab-content');
            if (liveArea) liveArea.innerHTML = _tHtml(`<p class="text-red-500 font-medium">${_t('admin.groq.error_load')}</p>`);
        });
}

/* ===== FORMULARIO ===== */

function _renderGroqForm(data) {
    const configured = data.configured === true;
    const model = escapeHtml(data.model || 'llama-3.3-70b-versatile');
    const statusBadge = configured
        ? `<span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold"><i class="fas fa-check-circle"></i> ${_t('admin.groq.configured')}</span>`
        : `<span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold"><i class="fas fa-exclamation-circle"></i> ${_t('admin.groq.not_configured')}</span>`;

    const models = [
        { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Calidad Alta: ★★★★★ | Velocidad: ★★★☆☆)' },
        { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout (Avanzado/Rápido: ★★★★★ | Calidad: ★★★★☆)' },
        { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B (Razonamiento Complejo: ★★★★★)' },
        { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B (Equilibrio: ★★★★☆)' },
        { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B (Eficiencia/Multilingüe: ★★★★☆)' },
        { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2 (Texto/Equilibrio: ★★★★☆)' }
    ];

    const modelOptions = models.map(m =>
        `<option value="${m.id}" ${model === m.id ? 'selected' : ''}>${m.label}</option>`
    ).join('');

    return `
    <div class="space-y-6 mb-8">
        <div class="bg-white rounded-2xl border-2 border-slate-200 p-6">
            <div class="flex items-center gap-3 mb-5">
                <div class="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-robot text-violet-600"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800">${_t('admin.groq.title')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('admin.groq.subtitle')}</p>
                </div>
                <div class="ml-auto">${statusBadge}</div>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">
                        ${configured ? _t('admin.groq.label_api_set') : _t('admin.groq.label_api')}
                    </label>
                    <input id="groq-api-key-input" autocomplete="off"
                        ${configured ? `value="${data.maskedKey}" disabled` : ''}
                        placeholder="gsk_..."
                        class="w-full border-2 border-slate-200 rounded-xl p-3 font-mono text-sm focus:border-violet-500 outline-none transition ${configured ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'}">
                </div>

                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">
                        ${_t('admin.groq.label_model')}
                    </label>
                    <select id="groq-model-select"
                        class="w-full border-2 border-slate-200 rounded-xl p-3 font-sans text-sm focus:border-violet-500 outline-none bg-white text-slate-800 appearance-none">
                        ${modelOptions}
                    </select>
                    <p class="text-xs text-slate-400 mt-2">${_t('admin.groq.model_desc')}</p>
                </div>
            </div>

            <div class="flex flex-wrap gap-3 mt-5">
                <button data-admin-action="groq-save-config"
                    class="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
                    <i class="fas fa-save text-xs"></i> ${configured ? _t('admin.groq.btn_update') : _t('admin.groq.btn_save')}
                </button>
                ${configured ? `<button data-admin-action="groq-delete-key"
                    class="flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 font-bold px-5 py-2.5 rounded-xl border-2 border-red-200 transition-all text-sm">
                    <i class="fas fa-trash text-xs"></i> ${_t('admin.groq.btn_delete')}
                </button>` : ''}
            </div>
            <div id="groq-config-result" class="mt-3 text-sm"></div>
        </div>
    </div>`;
}

/* ===== ACCIONES ===== */

function saveGroqApiKey() {
    const input = document.getElementById('groq-api-key-input');
    const modelSelect = document.getElementById('groq-model-select');
    const resultEl = document.getElementById('groq-config-result');

    const isConfigured = input && input.disabled;
    const key = input && !isConfigured ? input.value.trim() : '';
    const model = modelSelect ? modelSelect.value : null;

    if (!isConfigured && !key) {
        if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${_t('admin.groq.error_no_key')}</span>`);
        return;
    }
    if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-slate-400"><i class="fas fa-spin fa-circle-notch mr-1"></i>${_t('admin.groq.saving')}</span>`);

    fetch('/api/ai-generator/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ apiKey: key, model: model })
    }).then(r => r.json()).then(data => {
        if (!resultEl) return;
        if (data.success) {
            resultEl.innerHTML = _tHtml(`<span class="text-emerald-600 font-semibold"><i class="fas fa-check-circle mr-1"></i>${_t('admin.groq.save_ok')}</span>`);
            setTimeout(renderGroqConfigTab, 800);
        } else {
            resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${escapeHtml(data.error || _t('admin.tools.error_unknown'))}</span>`);
        }
    }).catch(() => {
        if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${_t('admin.groq.error_net')}</span>`);
    });
}

function deleteGroqApiKey() {
    mostrarModalConfirmacion(
        _t('admin.groq.delete_title'),
        _t('admin.groq.delete_msg'),
        () => {
            const resultEl = document.getElementById('groq-config-result');
            if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-slate-400"><i class="fas fa-spin fa-circle-notch mr-1"></i>${_t('admin.groq.deleting')}</span>`);

            fetch('/api/ai-generator/config', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + getAuthToken() }
            }).then(r => r.json()).then(data => {
                if (data.success) setTimeout(renderGroqConfigTab, 400);
                else if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${_t('admin.groq.error_delete')}</span>`);
            }).catch(() => {
                if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${_t('admin.groq.error_net')}</span>`);
            });
        }
    );
}
