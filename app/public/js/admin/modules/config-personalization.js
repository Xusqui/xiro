/**
 * @fileoverview Sección "Personalizar interfaz" del tab UI del panel de configuración.
 * Permite activar una insignia de marca de evento (p.ej. logo de un patrocinador) que
 * se muestra en todo el frontend, eligiendo una imagen de public/images/personalizations/.
 * Depende de: config-panel.js (saveUiSetting, _configData, renderNeonSwitch, _t, _tHtml, getAuthToken, escapeHtml)
 */

function renderPersonalizationSection(settings) {
    const enabled = settings.personalizationEnabled === true;

    // El grid se pinta abajo como placeholder "cargando"; disparamos la carga real
    // aquí para cubrir tanto el render inicial (setting ya activado en una sesión
    // previa) como la reactivación desde togglePersonalizationEnabled.
    if (enabled) setTimeout(loadPersonalizationImages, 0);

    return `<div class="bg-white rounded-2xl border-2 border-slate-200 p-5">
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-fuchsia-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-image text-fuchsia-600 text-base"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${_t('admin.config.ui.personalization_label')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('admin.config.ui.personalization_desc')}</p>
                </div>
            </div>
            ${renderNeonSwitch({ key: 'personalizationEnabled', checked: enabled, label: _t('admin.config.ui.personalization_label'), action: 'toggle-personalization-enabled' })}
        </div>
        ${enabled ? `<div id="personalization-images-grid" class="mt-5 pt-5 border-t border-slate-100">
            <div class="text-slate-400 flex items-center gap-2 text-sm"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.config.ui.personalization_loading')}</div>
        </div>` : ''}
    </div>`;
}

function loadPersonalizationImages() {
    const grid = document.getElementById('personalization-images-grid');
    if (!grid) return;

    fetch('/api/admin/ui-settings/personalization-images', { headers: { 'Authorization': 'Bearer ' + getAuthToken() } })
        .then(r => r.json())
        .then(data => _renderPersonalizationGrid(data.images || []))
        .catch(() => {
            const liveGrid = document.getElementById('personalization-images-grid');
            if (liveGrid) liveGrid.innerHTML = _tHtml(`<p class="text-xs text-red-500"><i class="fas fa-times-circle mr-1"></i>${_t('admin.config.ui.personalization_error')}</p>`);
        });
}

function _renderPersonalizationGrid(images) {
    const liveGrid = document.getElementById('personalization-images-grid');
    if (!liveGrid) return;

    if (!images.length) {
        liveGrid.innerHTML = _tHtml(`<p class="text-xs text-slate-400">${_t('admin.config.ui.personalization_empty')}</p>`);
        return;
    }

    const current = _configData.__ui ? _configData.__ui.personalizationImage : null;
    liveGrid.innerHTML = _tHtml(
        `<div class="grid grid-cols-3 sm:grid-cols-4 gap-3">${images.map(img => _renderPersonalizationThumb(img, img.filename === current)).join('')}</div>`
    );
}

function _personalizationThumbClass(selected) {
    return 'relative bg-slate-50 border-2 rounded-xl p-2 transition-all ' +
        (selected ? 'border-fuchsia-500 ring-2 ring-fuchsia-300' : 'border-slate-200 hover:border-fuchsia-300');
}

function _renderPersonalizationThumb(img, selected) {
    return `<button type="button" data-config-action="select-personalization-image" data-filename="${escapeHtml(img.filename)}"
        class="${_personalizationThumbClass(selected)}">
        <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.filename)}" class="w-full h-16 object-contain">
        ${selected ? `<span class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-fuchsia-500 text-white rounded-full flex items-center justify-center text-[10px]"><i class="fas fa-check"></i></span>` : ''}
    </button>`;
}

function togglePersonalizationEnabled(checked) {
    if (_configData.__ui) _configData.__ui.personalizationEnabled = checked;
    const area = document.getElementById('config-tab-content');
    if (area) area.innerHTML = _tHtml(_renderUiTab(_configData.__ui || {}));
    saveUiSetting('personalizationEnabled', checked);
}

function selectPersonalizationImage(filename) {
    document.querySelectorAll('[data-config-action="select-personalization-image"]').forEach(btn => {
        const isSelected = btn.dataset.filename === filename;
        btn.className = _personalizationThumbClass(isSelected);
        const badge = btn.querySelector('.absolute');
        if (isSelected && !badge) {
            btn.insertAdjacentHTML('beforeend', '<span class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-fuchsia-500 text-white rounded-full flex items-center justify-center text-[10px]"><i class="fas fa-check"></i></span>');
        } else if (!isSelected && badge) {
            badge.remove();
        }
    });
    saveUiSetting('personalizationImage', filename);
}
