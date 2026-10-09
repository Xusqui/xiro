/**
 * @fileoverview Pestaña "Fuegos artificiales" del panel de configuración.
 * Deslizadores e interruptores (config-panel-fields.js) que se guardan con la barra común
 * (config-savebar.js) vía postUiSettings (config-panel-ui.js). La vista previa usa los
 * valores del formulario, guardados o no.
 * Depende de: config-panel.js, config-panel-meta.js (UI_FIREWORKS_META) y config-panel-ui.js.
 */

const _FIREWORKS_DEFAULTS = {
    fireworksShellSize: 2,
    fireworksFinaleMode: true,
    fireworksSimSpeed: 1,
    fireworksLaunchIntervalMin: 900,
    fireworksLaunchIntervalMax: 1500,
    fireworksMaxFinaleCount: 32,
    fireworksTrailIntensity: 0.175,
    fireworksStarWidth: 3,
    fireworksSparkWidth: 1,
    fireworksSound: false
};

function _renderFireworksTab(settings) {
    const value = key => (settings[key] !== undefined ? settings[key] : _FIREWORKS_DEFAULTS[key]);
    const slider = key => _renderFireworksSlider(key, value(key), UI_FIREWORKS_META[key]);
    const toggle = key => _renderFireworksToggle(key, value(key) === true, UI_FIREWORKS_META[key]);

    return `
        <div class="space-y-4">
            <div class="bg-plum-50 border-2 border-plum-200 rounded-2xl p-6 mb-6">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 bg-plum-600 rounded-xl flex items-center justify-center text-white">
                        <i class="fas fa-fire text-lg"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-plum-900">${_t('admin.config.fireworks.panel_title')}</h3>
                        <p class="text-sm text-plum-700">${_t('admin.config.fireworks.panel_subtitle')}</p>
                    </div>
                </div>
                <div class="bg-white/60 rounded-xl p-4 border border-plum-100">
                    <p class="text-xs text-plum-800"><i class="fas fa-info-circle mr-1"></i> ${_t('admin.config.fireworks.panel_note')}</p>
                </div>
            </div>

            ${slider('fireworksShellSize')}
            ${toggle('fireworksFinaleMode')}
            ${slider('fireworksMaxFinaleCount')}
            ${slider('fireworksSimSpeed')}
            ${slider('fireworksLaunchIntervalMin')}
            ${slider('fireworksLaunchIntervalMax')}
            ${slider('fireworksTrailIntensity')}
            ${slider('fireworksStarWidth')}
            ${slider('fireworksSparkWidth')}
            ${toggle('fireworksSound')}

            <button data-config-action="preview-fireworks"
                class="mt-2 w-full flex items-center justify-center gap-2 bg-plum-600 hover:bg-plum-700 text-white font-black uppercase italic py-3 px-6 rounded-xl shadow-md transition">
                <i class="fas fa-eye"></i> ${_t('admin.config.fireworks.preview_btn')}
            </button>
        </div>`;
}

/** Actualiza el número junto al deslizador mientras se mueve. */
function updateFireworksSlider(key, value) {
    const valueDisplay = document.getElementById('fw-value-' + key);
    const meta = UI_FIREWORKS_META[key];
    if (valueDisplay && meta) valueDisplay.textContent = value + (meta.unit || '');
}

/** Valores del formulario: deslizadores (data-fw-key) e interruptores de fuegos. */
function fireworksTabSnapshot() {
    const content = document.getElementById('config-tab-content');
    const values = {};
    content?.querySelectorAll('input[data-fw-key]').forEach(el => { values[el.dataset.fwKey] = parseFloat(el.value); });
    content?.querySelectorAll('input[data-config-action="toggle-fireworks-setting-neon"]').forEach(el => { values[el.dataset.key] = el.checked; });
    return values;
}

function saveFireworksTab(initial) {
    return postUiSettings(changedSettings(fireworksTabSnapshot(), initial));
}

function previewFireworks() {
    const v = { ..._FIREWORKS_DEFAULTS, ...fireworksTabSnapshot() };
    const params = new URLSearchParams({
        shellSize: v.fireworksShellSize,
        finaleMode: v.fireworksFinaleMode,
        simSpeed: v.fireworksSimSpeed,
        launchIntervalMin: v.fireworksLaunchIntervalMin,
        launchIntervalMax: v.fireworksLaunchIntervalMax,
        maxFinaleCount: v.fireworksMaxFinaleCount,
        trailIntensity: v.fireworksTrailIntensity,
        starWidth: v.fireworksStarWidth,
        sparkWidth: v.fireworksSparkWidth,
        soundEnabled: v.fireworksSound
    });

    window.open('/fireworks-preview.html?' + params.toString(), '_blank', 'noopener');
}
window.previewFireworks = previewFireworks;
