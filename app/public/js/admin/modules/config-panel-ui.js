/**
 * @fileoverview Pestaña "Interfaz" del panel de configuración: tarjeta de TV, tarjeta
 * standalone, fondo animado y personalización (config-personalization.js).
 * Los cambios se guardan con la barra común (config-savebar.js) vía POST /api/admin/ui-settings.
 * Aquí vive también postUiSettings, que usan Fuegos artificiales y Equipos.
 * Depende de: config-panel.js (_configData) y neon-switch.js cargados previamente.
 */

/**
 * Guarda en orden cada ajuste de UI (POST /api/admin/ui-settings acepta uno por petición)
 * y lo copia a _configData.__ui. Para en el primer error.
 * @param {Object<string, *>} changes - clave → valor
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function postUiSettings(changes) {
    for (const [key, value] of Object.entries(changes)) {
        const res = await fetch('/api/admin/ui-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
            body: JSON.stringify({ key, value })
        });
        const data = await res.json();
        if (!data.success) return { ok: false, message: escapeHtml(data.error || _t('admin.tools.error_unknown')) };
        if (_configData.__ui) _configData.__ui[key] = value;
    }
    return { ok: true };
}

/** Claves de `now` cuyo valor difiere de `initial`. */
function changedSettings(now, initial) {
    const changes = {};
    Object.keys(now).forEach(key => {
        if (JSON.stringify(now[key]) !== JSON.stringify(initial[key])) changes[key] = now[key];
    });
    return changes;
}

/* ===== RENDER ===== */

function _tvCardModeClass(active) {
    return 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 ' +
        (active ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200');
}

function _renderTvCardModeOptions(currentMode) {
    const options = [
        { mode: 'never', labelKey: 'admin.config.ui.tv_card_mode_never' },
        { mode: 'always', labelKey: 'admin.config.ui.tv_card_mode_always' },
        { mode: 'old_devices_only', labelKey: 'admin.config.ui.tv_card_mode_old_devices' }
    ];
    return options.map(opt => {
        const active = opt.mode === currentMode;
        return `<button type="button" data-config-action="set-tv-card-mode" data-mode="${opt.mode}" aria-pressed="${active}"
            class="${_tvCardModeClass(active)}">${_t(opt.labelKey)}</button>`;
    }).join('');
}

/**
 * Tarjeta con interruptor; el switch lleva id ui-switch-<key> para leerlo al guardar.
 * @param {{ key: string, checked: boolean, icon: string, iconBg: string, iconColor: string, textKey: string }} o
 */
function _renderUiSwitchCard(o) {
    const label = _t(`admin.config.ui.${o.textKey}_label`);
    return `
        <div class="bg-white rounded-2xl border-2 border-slate-200 p-5 flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 ${o.iconBg} rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas ${o.icon} ${o.iconColor} text-base"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${label}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t(`admin.config.ui.${o.textKey}_desc`)}</p>
                </div>
            </div>
            ${renderNeonSwitch({ key: o.key, id: 'ui-switch-' + o.key, checked: o.checked, action: null, label })}
        </div>`;
}

function _renderUiTab(settings) {
    const tvCardMode = settings.tvCardMode || 'always';

    return `<div class="space-y-4">
        <div class="bg-white rounded-2xl border-2 border-slate-200 p-5">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-desktop text-cyan-600 text-base"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${_t('admin.config.ui.tv_card_label')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('admin.config.ui.tv_card_desc')}</p>
                </div>
            </div>
            <div data-tv-card-mode-group data-value="${tvCardMode}" class="flex flex-wrap gap-2">${_renderTvCardModeOptions(tvCardMode)}</div>
        </div>

        ${_renderUiSwitchCard({ key: 'showStandaloneCard', checked: settings.showStandaloneCard !== false, icon: 'fa-user', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', textKey: 'standalone_card' })}
        ${_renderUiSwitchCard({ key: 'animarFondo', checked: settings.animarFondo !== false, icon: 'fa-leaf', iconBg: 'bg-green-100', iconColor: 'text-green-600', textKey: 'animar_fondo' })}
        ${renderPersonalizationSection(settings)}
    </div>`;
}

/* ===== ESTADO Y GUARDADO ===== */

function setTvCardMode(mode, el) {
    const group = el.closest('[data-tv-card-mode-group]');
    if (!group) return;
    group.dataset.value = mode;
    group.querySelectorAll('[data-config-action="set-tv-card-mode"]').forEach(btn => {
        const active = btn.dataset.mode === mode;
        btn.className = _tvCardModeClass(active);
        btn.setAttribute('aria-pressed', String(active));
    });
    refreshConfigSaveBar();
}

function uiTabSnapshot() {
    const checked = id => Boolean(document.getElementById(id)?.checked);
    return {
        tvCardMode: document.querySelector('#config-tab-content [data-tv-card-mode-group]')?.dataset.value || null,
        showStandaloneCard: checked('ui-switch-showStandaloneCard'),
        animarFondo: checked('ui-switch-animarFondo'),
        personalizationEnabled: checked('ui-switch-personalizationEnabled'),
        personalizationImage: personalizationSelectedImage()
    };
}

function saveUiTab(initial) {
    return postUiSettings(changedSettings(uiTabSnapshot(), initial));
}
