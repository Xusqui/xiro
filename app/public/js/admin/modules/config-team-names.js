/**
 * @fileoverview Editor de nombres de equipos predeterminados en el panel de admin
 * Renderiza la sección de nombres de equipos dentro del tab lambda/config-equipos.
 * Persiste via POST /api/admin/ui-settings (key: teamNames, value: array[9]).
 */

// Número máximo de equipos configurables
const TEAM_NAMES_COUNT = 9;

/**
 * Obtiene los nombres actuales desde el store de configData.__ui o valores por defecto i18n
 * @param {object} uiSettings - Datos de /api/ui-settings
 * @returns {string[]} Array de 9 nombres
 */
function getTeamNamesFromSettings(uiSettings) {
    const saved = uiSettings && Array.isArray(uiSettings.teamNames) ? uiSettings.teamNames : [];
    const result = [];
    for (let i = 0; i < TEAM_NAMES_COUNT; i++) {
        result.push(saved[i] || '');
    }
    return result;
}

/**
 * Renderiza la sección de nombres de equipos
 * @param {object} uiSettings - Datos de /api/ui-settings
 * @returns {string} HTML de la sección
 */
function renderTeamNamesSection(uiSettings) {
    const names = getTeamNamesFromSettings(uiSettings);

    const inputs = names.map((name, i) => `
        <div class="flex items-center gap-3">
            <span class="w-8 h-8 flex items-center justify-center bg-purple-100 text-purple-700
                         rounded-lg font-black text-sm flex-shrink-0">${i + 1}</span>
            <input type="text"
                   id="team-name-admin-${i}"
                   value="${escapeHtml(name)}"
                   maxlength="30"
                   placeholder="${_t('admin.config.team.name_placeholder', null, 'Nombre del equipo')} ${i + 1}"
                   class="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm font-medium
                          text-slate-800 focus:border-purple-400 focus:outline-none transition-colors
                          placeholder:text-slate-400">
        </div>
    `).join('');

    return `
        <div class="bg-white rounded-2xl border-2 border-slate-200 p-6 mt-6">
            <div class="flex items-center gap-3 mb-5">
                <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-users text-purple-600 text-base"></i>
                </div>
                <div>
                    <h3 class="font-black text-slate-800 text-sm">
                        ${_t('admin.config.team.names_title', null, 'Nombres de Equipos')}
                    </h3>
                    <p class="text-xs text-slate-500 mt-0.5">
                        ${_t('admin.config.team.names_desc', null, 'Nombres sugeridos al iniciar un juego por equipos. El presentador puede modificarlos antes de cada partida.')}
                    </p>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                ${inputs}
            </div>
            <div class="flex flex-wrap gap-3 items-center">
                <button data-config-action="save-team-names"
                    class="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:scale-95
                           text-white font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all text-sm">
                    <i class="fas fa-save text-xs"></i>
                    ${_t('admin.config.team.btn_save', null, 'Guardar nombres')}
                </button>
                <button data-config-action="reset-team-names"
                    class="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 font-bold
                           px-4 py-2.5 rounded-xl border-2 border-slate-200 transition-all text-sm">
                    <i class="fas fa-undo text-xs"></i>
                    ${_t('admin.config.team.btn_reset', null, 'Restaurar por defecto')}
                </button>
            </div>
            <div id="team-names-save-result" class="mt-3 text-sm"></div>
        </div>`;
}

/**
 * Recoge los valores actuales de los inputs y los guarda via API
 */
function saveTeamNames() {
    const names = [];
    for (let i = 0; i < TEAM_NAMES_COUNT; i++) {
        const input = document.getElementById(`team-name-admin-${i}`);
        names.push(input ? input.value.trim() : '');
    }

    const resultEl = document.getElementById('team-names-save-result');
    if (resultEl) {
        resultEl.innerHTML = _tHtml(
            `<span class="text-slate-400"><i class="fas fa-spin fa-circle-notch mr-1"></i>${_t('admin.config.team.saving', null, 'Guardando…')}</span>`
        );
    }

    fetch('/api/admin/ui-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ key: 'teamNames', value: names })
    }).then(r => r.json()).then(data => {
        if (!resultEl) return;
        if (data.success) {
            resultEl.innerHTML = _tHtml(
                `<span class="text-emerald-600 font-semibold"><i class="fas fa-check-circle mr-1"></i>${_t('admin.config.team.saved_ok', null, 'Nombres guardados correctamente.')}</span>`
            );
            setTimeout(() => { if (resultEl) resultEl.innerHTML = ''; }, 3000);
        } else {
            resultEl.innerHTML = _tHtml(
                `<span class="text-red-600"><i class="fas fa-times-circle mr-1"></i>${escapeHtml(data.error || _t('admin.tools.error_unknown'))}</span>`
            );
        }
    }).catch(() => {
        if (resultEl) {
            resultEl.innerHTML = _tHtml(
                `<span class="text-red-600"><i class="fas fa-times-circle mr-1"></i>${_t('admin.config.team.net_error', null, 'Error de red.')}</span>`
            );
        }
    });
}

/**
 * Restablece los inputs a los valores por defecto i18n (sin guardar)
 */
function resetTeamNames() {
    const defaults = [
        _t('presenter.team.default.8', 'Relámpagos'),
        _t('presenter.team.default.1', 'Campeones'),
        _t('presenter.team.default.5', 'Halcones'),
        _t('presenter.team.default.9', 'Titanes'),
        _t('presenter.team.default.6', 'Invencibles'),
        _t('presenter.team.default.4', 'Guerreros'),
        _t('presenter.team.default.3', 'Fénix'),
        _t('presenter.team.default.2', 'Dragones'),
        _t('presenter.team.default.7', 'Leones')
    ];
    for (let i = 0; i < TEAM_NAMES_COUNT; i++) {
        const input = document.getElementById(`team-name-admin-${i}`);
        if (input) input.value = defaults[i] || '';
    }
    const resultEl = document.getElementById('team-names-save-result');
    if (resultEl) {
        resultEl.innerHTML = _tHtml(
            `<span class="text-slate-500 text-xs"><i class="fas fa-info-circle mr-1"></i>${_t('admin.config.team.reset_info', null, 'Valores restaurados. Pulsa Guardar para aplicar.')}</span>`
        );
    }
}
