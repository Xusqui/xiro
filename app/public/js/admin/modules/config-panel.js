/**
 * @fileoverview Panel de Configuración del servidor (sección Config)
 * Requiere: config-panel-meta.js, config-panel-fields.js y admin-savebar.js cargados previamente.
 * Las pestañas Interfaz y Fuegos artificiales viven en config-panel-ui.js y config-panel-fireworks.js;
 * IA en config-ui*.js y Licencia en site-panel.js. Todas guardan con la barra común (admin-savebar.js).
 * Las acciones de clic del panel están en config-panel-actions.js.
 */

/* ===== SECCIONES ===== */

const _PARAM_SECTIONS = [
    { id: 'partidas', titleKey: 'admin.config.tab.partidas', icon: 'fa-gamepad', color: 'bg-aubergine-500', keys: ['MAX_PLAYERS_PER_GAME', 'MAX_LOBBIES', 'QUESTION_TIME_LIMIT', 'GAME_CLEANUP_INTERVAL'] },
    { id: 'puntuacion', titleKey: 'admin.config.tab.puntuacion', icon: 'fa-star', color: 'bg-yellow-500', keys: ['BASE_POINTS', 'MAX_TIME_BONUS', 'STREAK_THRESHOLD', 'STREAK_BONUS_PERCENTAGE'] },
    { id: 'logging', titleKey: 'admin.config.tab.logging', icon: 'fa-file-alt', color: 'bg-amber-500', keys: ['LOG_LEVEL', 'LOG_MAX_SIZE', 'LOG_MAX_FILES'] },
    { id: 'conexion', titleKey: 'admin.config.tab.conexion', icon: 'fa-wifi', color: 'bg-sky-500', keys: ['RECONNECTION_TIMEOUT', 'PRESENTER_RECONNECTION_TIMEOUT', 'INACTIVE_GAME_THRESHOLD', 'EMPTY_LOBBY_TIMEOUT', 'TOP_PLAYERS_DURING_GAME', 'CORS_ORIGIN', 'ALLOWED_ORIGINS', 'UMAMI_SERVER_URL', 'UMAMI_WEBSITE_ID'] },
    { id: 'backup', titleKey: 'admin.config.tab.backup', icon: 'fa-database', color: 'bg-blue-600', keys: ['BACKUP_SCHEDULE', 'BACKUP_RETENTION_DAYS'] },
    { id: 'licencia', titleKey: 'admin.config.tab.licencia', icon: 'fa-certificate', color: 'bg-red-600', isLicense: true, keys: [] },
    { id: 'smtp', titleKey: 'admin.config.tab.smtp', icon: 'fa-envelope', color: 'bg-plum-600', keys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'CONTACT_TOKEN_SECRET'] },
    { id: 'lambda', titleKey: 'admin.config.tab.lambda', icon: 'fa-users-cog', color: 'bg-plum-500', isLambda: true, keys: ['TEAM_SCORE_LAMBDA'] },
    { id: 'fireworks', titleKey: 'admin.config.tab.fireworks', icon: 'fa-fire', color: 'bg-fuchsia-500', isFireworks: true, keys: [] },
    { id: 'ui', titleKey: 'admin.config.tab.ui', icon: 'fa-eye', color: 'bg-emerald-500', isUi: true, keys: [] }
];

let _activeTab = 'partidas';
let _configData = {};

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
    if (sec.isGroq) { setTimeout(renderAIConfigTab, 0); return `<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.config.server.loading')}</div>`; }
    if (sec.isLambda) {
        const entry = config['TEAM_SCORE_LAMBDA'];
        const lambdaHtml = entry ? '<div class="mb-2">' + _renderLambdaCard(entry) + '</div>' : `<p class="text-slate-400">${_t('admin.config.lambda.no_data')}</p>`;
        const teamNamesHtml = renderTeamNamesSection(config.__ui || {});
        return lambdaHtml + teamNamesHtml;
    }
    const fields = sec.keys.filter(k => config[k]).map(k => _renderConfigField(k, config[k])).join('');
    return `<div class="mb-8"><div class="grid grid-cols-1 md:grid-cols-2 gap-4">${fields}</div></div>`;
}

/* ===== RENDER FORM ===== */

function _renderConfigForm(config) {
    _configData = config;
    return `
        <div id="config-tab-bar">${_renderTabBar()}</div>
        <div id="config-tab-content">${_renderTabContent(config)}</div>
        ${renderSaveBar()}
        <div class="h-10"></div>`;
}

/** Pinta el formulario y conecta la barra; IA y Licencia la conectan al terminar de cargar. */
function _paintConfigForm(area) {
    area.innerHTML = _tHtml(_renderConfigForm(_configData));
    unbindSaveBar();
    const sec = _PARAM_SECTIONS.find(s => s.id === _activeTab) || {};
    if (sec.isGroq || sec.isLicense) return;

    const discard = () => switchConfigTab(_activeTab);
    if (sec.isUi) bindSaveBar({ snapshot: uiTabSnapshot, save: saveUiTab, discard });
    else if (sec.isFireworks) bindSaveBar({ snapshot: fireworksTabSnapshot, save: saveFireworksTab, discard });
    else if (sec.isLambda) bindSaveBar({ snapshot: _lambdaTabSnapshot, save: _saveLambdaTab, discard });
    else bindSaveBar({ snapshot: _serverFieldsSnapshot, save: initial => _postServerConfig(_serverUpdates(initial)), discard });
}

/* ===== TAB SWITCH ===== */

function switchConfigTab(tabId) {
    _activeTab = tabId;
    const formArea = document.getElementById('config-form-area');
    if (formArea) _paintConfigForm(formArea);
}

/* ===== MAIN RENDER ===== */

function renderConfigPanel() {
    const container = document.getElementById('editorArea');
    if (!container) return;
    unbindSaveBar();
    container.dataset.fromConfig = 'true';
    container.innerHTML = _tHtml(`
        <div class="min-h-full bg-gradient-to-br from-slate-50 to-aubergine-50/30 p-6 lg:p-10">
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
        _paintConfigForm(area);
    }).catch(() => {
        const area = document.getElementById('config-form-area');
        if (area) area.innerHTML = _tHtml(`<p class="text-red-500 font-medium">${_t('admin.config.server.error')}</p>`);
    });
}

/* ===== GUARDADO DE PARÁMETROS DEL SERVIDOR ===== */

// Solo controles de formulario reales: el botón "ojo" de los campos sensibles también
// lleva data-key (para saber qué campo mostrar/ocultar) y no tiene valor.
const _SERVER_FIELD_SELECTOR = '#config-tab-content input[data-key]:not(:disabled), #config-tab-content select[data-key]:not(:disabled)';

function _serverFieldsSnapshot() {
    const values = {};
    document.querySelectorAll(_SERVER_FIELD_SELECTOR).forEach(el => { values[el.dataset.key] = el.value; });
    return values;
}

/** Campos cambiados respecto a lo pintado; un sensible vacío significa "sin cambios". */
function _serverUpdates(initial) {
    const updates = {};
    document.querySelectorAll(_SERVER_FIELD_SELECTOR).forEach(el => {
        if (el.value === initial[el.dataset.key]) return;
        if (el.dataset.sensitive && !el.value.trim()) return;
        const mul = parseFloat(el.dataset.mul) || 1;
        updates[el.dataset.key] = mul > 1 ? String(Math.round(parseFloat(el.value) * mul)) : el.value;
    });
    return updates;
}

/** POST /api/admin/config con los cambios; devuelve el resultado que espera la barra. */
async function _postServerConfig(updates) {
    if (!Object.keys(updates).length) return { ok: true };
    const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ updates })
    });
    const data = await res.json();
    if (!data.success) {
        const msg = data.errors
            ? Object.entries(data.errors).map(([key, error]) => `${key}: ${error}`).join(' | ')
            : data.error || _t('admin.tools.error_unknown');
        return { ok: false, message: escapeHtml(msg) };
    }
    if (updates.QUESTION_TIME_LIMIT !== undefined) setDefaultQuestionTimeLimit(updates.QUESTION_TIME_LIMIT);
    _applySavedValues(updates);
    return { ok: true, message: _t('admin.config.server.saved_ok') };
}

/**
 * Lleva lo guardado a _configData, la copia desde la que se repintan las
 * sub-pestañas (switchConfigTab). Sin esto, al volver a «Partidas» tras guardar
 * salía el valor anterior hasta salir de «Servidor» y volver a entrar. Los
 * sensibles se guardan como la máscara del servidor, nunca en claro.
 */
function _applySavedValues(updates) {
    for (const [key, value] of Object.entries(updates || {})) {
        const entry = _configData[key];
        if (!entry || typeof entry !== 'object') continue;
        if (entry.sensitive) {
            entry.value = value ? '••••••••' : entry.value;
        } else if (typeof entry.value === 'number') {
            entry.value = Number(value);
        } else {
            entry.value = value;
        }
    }
}

/* ===== PESTAÑA EQUIPOS (λ + nombres) ===== */

function _lambdaTabSnapshot() {
    return { ..._serverFieldsSnapshot(), teamNames: teamNamesSnapshot() };
}

async function _saveLambdaTab(initial) {
    const result = await _postServerConfig(_serverUpdates(initial));
    if (!result.ok) return result;
    if (JSON.stringify(teamNamesSnapshot()) === JSON.stringify(initial.teamNames)) return result;
    return postUiSettings({ teamNames: teamNamesSnapshot() });
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
