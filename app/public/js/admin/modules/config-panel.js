/**
 * @fileoverview Panel de Configuración del servidor (sección Config)
 * Requiere: config-panel-meta.js + config-panel-fields.js cargados previamente
 */

/* ===== SECCIONES ===== */

const _PARAM_SECTIONS = [
    { id: 'partidas', titleKey: 'admin.config.tab.partidas', icon: 'fa-gamepad', color: 'bg-indigo-500', keys: ['MAX_PLAYERS_PER_GAME', 'MAX_LOBBIES', 'QUESTION_TIME_LIMIT', 'GAME_CLEANUP_INTERVAL'] },
    { id: 'puntuacion', titleKey: 'admin.config.tab.puntuacion', icon: 'fa-star', color: 'bg-yellow-500', keys: ['BASE_POINTS', 'MAX_TIME_BONUS', 'STREAK_THRESHOLD', 'STREAK_BONUS_PERCENTAGE'] },
    { id: 'logging', titleKey: 'admin.config.tab.logging', icon: 'fa-file-alt', color: 'bg-amber-500', keys: ['LOG_LEVEL', 'LOG_MAX_SIZE', 'LOG_MAX_FILES'] },
    { id: 'conexion', titleKey: 'admin.config.tab.conexion', icon: 'fa-wifi', color: 'bg-sky-500', keys: ['RECONNECTION_TIMEOUT', 'INACTIVE_GAME_THRESHOLD', 'EMPTY_LOBBY_TIMEOUT', 'TOP_PLAYERS_DURING_GAME', 'CORS_ORIGIN', 'ALLOWED_ORIGINS', 'UMAMI_SERVER_URL', 'UMAMI_WEBSITE_ID'] },
    { id: 'backup', titleKey: 'admin.config.tab.backup', icon: 'fa-database', color: 'bg-blue-600', keys: ['BACKUP_SCHEDULE', 'BACKUP_RETENTION_DAYS'] },
    { id: 'licencia', titleKey: 'admin.config.tab.licencia', icon: 'fa-certificate', color: 'bg-red-600', isLicense: true, keys: [] },
    { id: 'smtp', titleKey: 'admin.config.tab.smtp', icon: 'fa-envelope', color: 'bg-purple-600', keys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'CONTACT_TOKEN_SECRET'] },
    { id: 'lambda', titleKey: 'admin.config.tab.lambda', icon: 'fa-users-cog', color: 'bg-purple-500', isLambda: true, keys: ['TEAM_SCORE_LAMBDA'] },
    { id: 'fireworks', titleKey: 'admin.config.tab.fireworks', icon: 'fa-fire', color: 'bg-fuchsia-500', isFireworks: true, keys: [] },
    { id: 'ui', titleKey: 'admin.config.tab.ui', icon: 'fa-eye', color: 'bg-emerald-500', isUi: true, keys: [] }
];

let _activeTab = 'partidas';
let _configData = {};
let _configPanelDelegationReady = false;

/* ===== TAB BAR ===== */

function _renderTabBar() {
    return '<div class="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-2xl mb-6">' +
        _PARAM_SECTIONS.map(sec => {
            const active = sec.id === _activeTab;
            const base = 'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border-0';
            const cls = active ? `${base} ${sec.color} text-white shadow-sm` : `${base} bg-transparent text-slate-500 hover:text-slate-700 hover:bg-white`;
            return `<button class="${cls}" data-config-action="switch-tab" data-tab-id="${sec.id}"><i class="fas ${sec.icon} text-xs"></i> ${_t(sec.titleKey)}</button>`;
        }).join('') + '</div>';
}

/* ===== TAB CONTENT ===== */

function _renderTabContent(config) {
    const sec = _PARAM_SECTIONS.find(s => s.id === _activeTab);
    if (!sec) return '';
    if (sec.isUi) return _renderUiTab(config.__ui || {});
    if (sec.isFireworks) return _renderFireworksTab(config.__ui || {});
    if (sec.isLicense) { setTimeout(renderLicenseTab, 0); return `<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.config.server.loading')}</div>`; }
    if (sec.isGroq) { setTimeout(renderGroqConfigTab, 0); return `<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.config.server.loading')}</div>`; }
    if (sec.isLambda) {
        const entry = config['TEAM_SCORE_LAMBDA'];
        const lambdaHtml = entry ? '<div class="mb-2">' + _renderLambdaCard(entry) + '</div>' : `<p class="text-slate-400">${_t('admin.config.lambda.no_data')}</p>`;
        const teamNamesHtml = renderTeamNamesSection(config.__ui || {});
        return lambdaHtml + teamNamesHtml;
    }
    const fields = sec.keys.filter(k => config[k]).map(k => _renderConfigField(k, config[k])).join('');
    return `<div class="mb-8"><div class="grid grid-cols-1 md:grid-cols-2 gap-4">${fields}</div></div>`;
}

/* ===== SAVE BAR ===== */

function _renderSaveBar() {
    return `<div class="flex flex-wrap gap-3">
        <button data-config-action="save-config"
            class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all">
            <i class="fas fa-save text-sm"></i> ${_t('admin.config.btn_save')}
        </button>
        <button data-config-action="reload-config"
            class="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 font-bold px-5 py-2.5 rounded-xl border-2 border-slate-200 transition-all">
            <i class="fas fa-sync-alt text-sm"></i> ${_t('admin.config.btn_reload')}
        </button>
    </div>
    <div id="config-save-result" class="mt-3 text-sm"></div>`;
}

/* ===== RENDER FORM ===== */

function _renderConfigForm(config) {
    _configData = config;
    const currentSection = _PARAM_SECTIONS.find(s => s.id === _activeTab) || {};
    const hidesSaveBar = currentSection.isUi || currentSection.isFireworks || currentSection.isGroq || currentSection.isLicense || currentSection.isLambda;
    return `
        <div id="config-tab-bar">${_renderTabBar()}</div>
        <div id="config-tab-content">${_renderTabContent(config)}</div>
        ${!hidesSaveBar ? `<div id="config-save-bar">${_renderSaveBar()}</div>` : ''}
        <div class="h-10"></div>`;
}

/* ===== TAB SWITCH ===== */

function switchConfigTab(tabId) {
    _activeTab = tabId;
    const formArea = document.getElementById('config-form-area');
    if (formArea) formArea.innerHTML = _tHtml(_renderConfigForm(_configData));
}

/* ===== MAIN RENDER ===== */

function renderConfigPanel() {
    const container = document.getElementById('editorArea');
    if (!container) return;
    container.dataset.fromConfig = 'true';
    container.innerHTML = _tHtml(`
        <div class="min-h-full bg-gradient-to-br from-slate-50 to-indigo-50/30 p-6 lg:p-10">
            <div class="max-w-4xl mx-auto">
                <div class="mb-8">
                    <h1 class="text-2xl font-black text-slate-800 mb-1">${_t('admin.config.server.title')}</h1>
                    <p class="text-sm text-slate-500">${_t('admin.config.server.subtitle')}</p>
                </div>
                <div id="config-form-area"><div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.config.server.loading')}</div></div>
            </div>
        </div>`);
    const _h = { 'Authorization': 'Bearer ' + getAuthToken() };
    Promise.all([
        fetch('/api/admin/config', { headers: _h }).then(r => r.json()),
        fetch('/api/ui-settings').then(r => r.json())
    ]).then(([cfgData, uiData]) => {
        const area = document.getElementById('config-form-area');
        if (!area) return;
        _configData = cfgData.config || {};
        _configData.__ui = uiData;
        area.innerHTML = _tHtml(_renderConfigForm(_configData));
    }).catch(() => {
        const area = document.getElementById('config-form-area');
        if (area) area.innerHTML = _tHtml(`<p class="text-red-500 font-medium">${_t('admin.config.server.error')}</p>`);
    });
}

/* ===== SAVE ===== */

function saveConfigChanges() {
    // Selector restringido a controles de formulario reales: el botón "ojo" de los campos
    // sensibles también lleva data-key (para saber qué campo mostrar/ocultar) y, al no tener
    // valor ni data-sensitive, un selector genérico "[data-key]" lo captaba también y su
    // value="" pisaba el valor real del input al procesarse justo después en el forEach.
    const inputs = document.querySelectorAll('input[data-key]:not(:disabled), select[data-key]:not(:disabled)');
    const updates = {};
    inputs.forEach(el => {
        if (el.dataset.sensitive && !el.value.trim()) return;
        const mul = parseFloat(el.dataset.mul) || 1;
        updates[el.dataset.key] = mul > 1 ? String(Math.round(parseFloat(el.value) * mul)) : el.value;
    });
    const resultEl = document.getElementById('config-save-result');
    if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-slate-400"><i class="fas fa-spin fa-circle-notch mr-1"></i>${_t('admin.config.server.saving')}</span>`);
    fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ updates })
    })
        .then(r => r.json())
        .then(data => {
            if (!resultEl) return;
            if (data.success) {
                resultEl.innerHTML = _tHtml(`<span class="text-emerald-600 font-semibold"><i class="fas fa-check-circle mr-1"></i>${_t('admin.config.server.saved_ok')}</span>`);
            } else {
                const msg = data.errors
                    ? Object.entries(data.errors).map(([key, error]) => `${key}: ${error}`).join(' | ')
                    : data.error || _t('admin.tools.error_unknown');
                resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${escapeHtml(msg)}</span>`);
            }
        })
        .catch(() => {
            if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${_t('admin.config.server.net_error')}</span>`);
        });
}

/* ===== UI SETTINGS ===== */

function _renderTvCardModeOptions(currentMode) {
    const options = [
        { mode: 'never', labelKey: 'admin.config.ui.tv_card_mode_never' },
        { mode: 'always', labelKey: 'admin.config.ui.tv_card_mode_always' },
        { mode: 'old_devices_only', labelKey: 'admin.config.ui.tv_card_mode_old_devices' }
    ];
    return options.map(opt => {
        const active = opt.mode === currentMode;
        const cls = active
            ? 'bg-cyan-600 text-white shadow-sm'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
        return `<button type="button" data-config-action="set-tv-card-mode" data-mode="${opt.mode}"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 ${cls}">${_t(opt.labelKey)}</button>`;
    }).join('');
}

function _renderUiTab(settings) {
    const tvCardMode = settings.tvCardMode || 'always';
    const showStandalone = settings.showStandaloneCard !== false;
    const animarFondo = settings.animarFondo !== false;

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
            <div data-tv-card-mode-group class="flex flex-wrap gap-2">${_renderTvCardModeOptions(tvCardMode)}</div>
        </div>

        <div class="bg-white rounded-2xl border-2 border-slate-200 p-5 flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-user text-emerald-600 text-base"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${_t('admin.config.ui.standalone_card_label')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('admin.config.ui.standalone_card_desc')}</p>
                </div>
            </div>
            ${renderNeonSwitch({ key: 'showStandaloneCard', checked: showStandalone, label: _t('admin.config.ui.standalone_card_label') })}
        </div>

        <div class="bg-white rounded-2xl border-2 border-slate-200 p-5 flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-leaf text-green-600 text-base"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${_t('admin.config.ui.animar_fondo_label')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('admin.config.ui.animar_fondo_desc')}</p>
                </div>
            </div>
            ${renderNeonSwitch({ key: 'animarFondo', checked: animarFondo, label: _t('admin.config.ui.animar_fondo_label') })}
        </div>

        <div id="ui-save-result" class="text-sm"></div>
    </div>`;
}

function toggleSensitiveField(key) {
    const input = document.getElementById('cfg-' + key);
    const icon = document.getElementById('eye-' + key);
    if (!input || !icon) return;
    // El campo siempre es type="text" (ver config-panel-fields.js); el enmascarado se hace
    // con la clase CSS .xiro-input-mask para no activar el gestor de contraseñas del navegador.
    if (input.classList.contains('xiro-input-mask')) {
        input.classList.remove('xiro-input-mask');
        icon.className = 'fas fa-eye-slash text-xs';
    } else {
        input.classList.add('xiro-input-mask');
        icon.className = 'fas fa-eye text-xs';
    }
}

function setTvCardMode(mode, el) {
    const group = el.closest('[data-tv-card-mode-group]');
    if (group) {
        group.querySelectorAll('[data-config-action="set-tv-card-mode"]').forEach(btn => {
            const active = btn.dataset.mode === mode;
            btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 ' +
                (active ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200');
        });
    }
    saveUiSetting('tvCardMode', mode);
}

function saveUiSetting(key, value) {
    const resultEl = document.getElementById('ui-save-result');
    if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-slate-400"><i class="fas fa-spin fa-circle-notch mr-1"></i>${_t('admin.config.ui.applying')}</span>`);
    fetch('/api/admin/ui-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ key, value })
    }).then(r => r.json()).then(data => {
        if (_configData.__ui) _configData.__ui[key] = value;
        if (resultEl) resultEl.innerHTML = data.success
            ? `<span class="text-emerald-600 font-semibold"><i class="fas fa-check-circle mr-1"></i>${_t('admin.config.ui.applied_ok')}</span>`
            : `<span class="text-red-600"><i class="fas fa-times-circle mr-1"></i>${escapeHtml(data.error || _t('admin.tools.error_unknown'))}</span>`;
    }).catch(() => {
        if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600"><i class="fas fa-times-circle mr-1"></i>${_t('admin.config.ui.net_error')}</span>`);
    });
}

/* ===== FIREWORKS TAB ===== */

function _renderFireworksTab(settings) {
    const size = settings.fireworksShellSize !== undefined ? settings.fireworksShellSize : 2;
    const finaleMode = settings.fireworksFinaleMode !== false;
    const simSpeed = settings.fireworksSimSpeed !== undefined ? settings.fireworksSimSpeed : 1;
    const intervalMin = settings.fireworksLaunchIntervalMin !== undefined ? settings.fireworksLaunchIntervalMin : 900;
    const intervalMax = settings.fireworksLaunchIntervalMax !== undefined ? settings.fireworksLaunchIntervalMax : 1500;
    const maxFinaleCount = settings.fireworksMaxFinaleCount !== undefined ? settings.fireworksMaxFinaleCount : 32;
    const trailIntensity = settings.fireworksTrailIntensity !== undefined ? settings.fireworksTrailIntensity : 0.175;
    const starWidth = settings.fireworksStarWidth !== undefined ? settings.fireworksStarWidth : 3;
    const sparkWidth = settings.fireworksSparkWidth !== undefined ? settings.fireworksSparkWidth : 1;
    const soundEnabled = settings.fireworksSound === true;

    return `
        <div class="space-y-4">
            <div class="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6 mb-6">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white">
                        <i class="fas fa-fire text-lg"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-purple-900">${_t('admin.config.fireworks.panel_title')}</h3>
                        <p class="text-sm text-purple-700">${_t('admin.config.fireworks.panel_subtitle')}</p>
                    </div>
                </div>
                <div class="bg-white/60 rounded-xl p-4 border border-purple-100">
                    <p class="text-xs text-purple-800"><i class="fas fa-info-circle mr-1"></i> ${_t('admin.config.fireworks.panel_note')}</p>
                </div>
            </div>

            ${_renderFireworksSlider('fireworksShellSize', size, UI_FIREWORKS_META.fireworksShellSize)}
            ${_renderFireworksToggle('fireworksFinaleMode', finaleMode, UI_FIREWORKS_META.fireworksFinaleMode)}
            ${_renderFireworksSlider('fireworksMaxFinaleCount', maxFinaleCount, UI_FIREWORKS_META.fireworksMaxFinaleCount)}
            ${_renderFireworksSlider('fireworksSimSpeed', simSpeed, UI_FIREWORKS_META.fireworksSimSpeed)}
            ${_renderFireworksSlider('fireworksLaunchIntervalMin', intervalMin, UI_FIREWORKS_META.fireworksLaunchIntervalMin)}
            ${_renderFireworksSlider('fireworksLaunchIntervalMax', intervalMax, UI_FIREWORKS_META.fireworksLaunchIntervalMax)}
            ${_renderFireworksSlider('fireworksTrailIntensity', trailIntensity, UI_FIREWORKS_META.fireworksTrailIntensity)}
            ${_renderFireworksSlider('fireworksStarWidth', starWidth, UI_FIREWORKS_META.fireworksStarWidth)}
            ${_renderFireworksSlider('fireworksSparkWidth', sparkWidth, UI_FIREWORKS_META.fireworksSparkWidth)}
            ${_renderFireworksToggle('fireworksSound', soundEnabled, UI_FIREWORKS_META.fireworksSound)}

            <button data-config-action="preview-fireworks"
                class="mt-2 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-black uppercase italic py-3 px-6 rounded-xl shadow-md transition">
                <i class="fas fa-eye"></i> ${_t('admin.config.fireworks.preview_btn')}
            </button>

            <div id="fireworks-save-result" class="text-sm mt-4"></div>
        </div>`;
}

function updateFireworksSlider(key, value) {
    const valueDisplay = document.getElementById('fw-value-' + key);
    const meta = UI_FIREWORKS_META[key];
    if (valueDisplay && meta) {
        valueDisplay.textContent = value + (meta.unit || '');
    }
    saveFireworksSetting(key, parseFloat(value));
}

function saveFireworksSetting(key, value) {
    const resultEl = document.getElementById('fireworks-save-result');
    if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-slate-400"><i class="fas fa-spin fa-circle-notch mr-1"></i>${_t('admin.config.fireworks.saving')}</span>`);

    fetch('/api/admin/ui-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ key, value })
    }).then(r => r.json()).then(data => {
        if (_configData.__ui) _configData.__ui[key] = value;
        if (resultEl) {
            if (data.success) {
                resultEl.innerHTML = _tHtml(`<span class="text-emerald-600 font-semibold"><i class="fas fa-check-circle mr-1"></i>${_t('admin.config.fireworks.saved_ok')}</span>`);
                setTimeout(() => { if (resultEl) resultEl.innerHTML = _tHtml(''); }, 3000);
            } else {
                resultEl.innerHTML = _tHtml(`<span class="text-red-600"><i class="fas fa-times-circle mr-1"></i>${escapeHtml(data.error || _t('admin.tools.error_unknown'))}</span>`);
            }
        }
    }).catch(() => {
        if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600"><i class="fas fa-times-circle mr-1"></i>${_t('admin.config.fireworks.net_error')}</span>`);
    });
}

function previewFireworks() {
    function sliderVal(key, fallback) {
        const el = document.getElementById('fw-' + key);
        return el ? parseFloat(el.value) : fallback;
    }
    function toggleVal(key, fallback) {
        if (_configData.__ui && _configData.__ui[key] !== undefined) return _configData.__ui[key];
        const input = document.querySelector('[data-config-action="toggle-fireworks-setting-neon"][data-key="' + key + '"]');
        return input ? input.checked : fallback;
    }

    const params = new URLSearchParams({
        shellSize: sliderVal('fireworksShellSize', 2),
        finaleMode: toggleVal('fireworksFinaleMode', true),
        simSpeed: sliderVal('fireworksSimSpeed', 1),
        launchIntervalMin: sliderVal('fireworksLaunchIntervalMin', 900),
        launchIntervalMax: sliderVal('fireworksLaunchIntervalMax', 1500),
        maxFinaleCount: sliderVal('fireworksMaxFinaleCount', 32),
        trailIntensity: sliderVal('fireworksTrailIntensity', 0.175),
        starWidth: sliderVal('fireworksStarWidth', 3),
        sparkWidth: sliderVal('fireworksSparkWidth', 1),
        soundEnabled: toggleVal('fireworksSound', false)
    });

    window.open('/fireworks-preview.html?' + params.toString(), '_blank', 'noopener');
}
window.previewFireworks = previewFireworks;

function _initConfigPanelDelegation() {
    if (_configPanelDelegationReady) return;
    _configPanelDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-config-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.configAction;
        switch (action) {
            case 'switch-tab':
                if (actionElement.dataset.tabId) switchConfigTab(actionElement.dataset.tabId);
                break;
            case 'save-config':
                saveConfigChanges();
                break;
            case 'reload-config':
                renderConfigPanel();
                break;
            case 'toggle-ui-setting-neon':
                if (actionElement.dataset.key) saveUiSetting(actionElement.dataset.key, actionElement.checked);
                break;
            case 'set-tv-card-mode':
                if (actionElement.dataset.mode) setTvCardMode(actionElement.dataset.mode, actionElement);
                break;
            case 'preview-fireworks':
                previewFireworks();
                break;
            case 'toggle-sensitive':
                if (actionElement.dataset.key) toggleSensitiveField(actionElement.dataset.key);
                break;
            case 'toggle-fireworks-setting-neon':
                if (actionElement.dataset.key) saveFireworksSetting(actionElement.dataset.key, actionElement.checked);
                break;
            case 'save-team-names':
                saveTeamNames();
                break;
            case 'reset-team-names':
                resetTeamNames();
                break;
            default:
                break;
        }
    });

    document.addEventListener('input', (event) => {
        const actionElement = event.target.closest('[data-config-action]');
        if (!actionElement) return;
        if (actionElement.dataset.configAction === 'update-fireworks-slider' && actionElement.dataset.key) {
            updateFireworksSlider(actionElement.dataset.key, actionElement.value);
        }
    });
}

_initConfigPanelDelegation();
