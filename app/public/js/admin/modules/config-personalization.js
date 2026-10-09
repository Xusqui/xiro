/**
 * @fileoverview Sección "Personalizar interfaz" del tab UI del panel de configuración.
 * Permite activar una insignia de marca de evento (p.ej. logo de un patrocinador) que
 * se muestra en todo el frontend, eligiendo, subiendo o borrando una imagen de
 * public/images/personalizations/.
 * Activar la insignia y elegir imagen se guardan con la barra común (config-panel-ui.js →
 * uiTabSnapshot); subir y borrar imágenes son operaciones de fichero y se hacen al momento.
 * Depende de: config-panel.js (_configData), config-savebar.js, checkbox.js
 * y helpers.js (mostrarModalConfirmacion).
 */

/** Imagen elegida en el formulario (aún sin guardar). */
let _personalizationSelected = null;

function personalizationSelectedImage() {
    return _personalizationSelected;
}

function renderPersonalizationSection(settings) {
    const enabled = settings.personalizationEnabled === true;
    _personalizationSelected = settings.personalizationImage || null;

    // La rejilla se pinta siempre (oculta si está desactivada) para poder activarla sin
    // guardar; las imágenes se cargan la primera vez que se muestra.
    if (enabled) setTimeout(_showPersonalizationImages, 0);

    return `<div class="bg-white rounded-2xl border-2 border-slate-200 p-5">
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-image text-green-600 text-base"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${_t('admin.config.ui.personalization_label')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${_t('admin.config.ui.personalization_desc')}</p>
                </div>
            </div>
            ${renderCheckbox({ key: 'personalizationEnabled', id: 'ui-switch-personalizationEnabled', checked: enabled, label: _t('admin.config.ui.personalization_label'), action: 'toggle-personalization-enabled' })}
        </div>
        <div id="personalization-images-grid" class="mt-5 pt-5 border-t border-slate-100" ${enabled ? '' : 'hidden'}>
            <label id="personalization-drop-zone" class="drop-zone block border-2 border-dashed border-green-300 rounded-xl p-4 flex flex-col items-center justify-center gap-1 cursor-pointer mb-2">
                <i class="fas fa-cloud-upload-alt text-green-500 text-xl"></i>
                <p class="text-xs text-slate-500 text-center">${_t('admin.config.ui.personalization_drop_hint')}</p>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" data-config-action="upload-personalization-image">
            </label>
            <p id="personalization-upload-status" class="text-xs text-slate-400 mb-3"></p>
            <div id="personalization-images-list" class="text-slate-400 flex items-center gap-2 text-sm">
                <i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.config.ui.personalization_loading')}
            </div>
        </div>
    </div>`;
}

/** Muestra la rejilla y, la primera vez, carga las imágenes y prepara la zona de arrastre. */
function _showPersonalizationImages() {
    const grid = document.getElementById('personalization-images-grid');
    if (!grid) return;
    grid.hidden = false;
    if (grid.dataset.loaded) return;
    grid.dataset.loaded = 'true';
    loadPersonalizationImages();
    _initPersonalizationDropZone();
}

function _initPersonalizationDropZone() {
    const zone = document.getElementById('personalization-drop-zone');
    if (!zone || typeof setupDragAndDrop !== 'function') return;
    setupDragAndDrop(zone, {
        onFileSelected: uploadPersonalizationImage,
        acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        maxSize: 2 * 1024 * 1024,
        dropZoneActiveClass: 'personalization-drag-active'
    });
}

function loadPersonalizationImages() {
    const list = document.getElementById('personalization-images-list');
    if (!list) return;

    fetch('/api/admin/ui-settings/personalization-images', { headers: { 'Authorization': 'Bearer ' + getAuthToken() } })
        .then(r => r.json())
        .then(data => _renderPersonalizationGrid(data.images || []))
        .catch(() => {
            const liveList = document.getElementById('personalization-images-list');
            if (liveList) liveList.innerHTML = _tHtml(`<p class="text-xs text-red-500"><i class="fas fa-times-circle mr-1"></i>${_t('admin.config.ui.personalization_error')}</p>`);
        });
}

function _renderPersonalizationGrid(images) {
    const liveList = document.getElementById('personalization-images-list');
    if (!liveList) return;

    if (!images.length) {
        liveList.innerHTML = _tHtml(`<p class="text-xs text-slate-400">${_t('admin.config.ui.personalization_empty')}</p>`);
        return;
    }

    const current = _personalizationSelected;
    liveList.innerHTML = _tHtml(
        `<div class="grid grid-cols-3 sm:grid-cols-4 gap-3">${images.map(img => _renderPersonalizationThumb(img, img.filename === current)).join('')}</div>`
    );
}

function _personalizationThumbClass(selected) {
    return 'relative bg-slate-50 border-2 rounded-xl p-2 transition-all ' +
        (selected ? 'border-green-500 ring-2 ring-green-300' : 'border-slate-200 hover:border-green-300');
}

function _renderPersonalizationThumb(img, selected) {
    return `<div class="${_personalizationThumbClass(selected)}">
        <button type="button" data-config-action="select-personalization-image" data-filename="${escapeHtml(img.filename)}"
            class="block w-full border-0 bg-transparent p-0">
            <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.filename)}" class="w-full h-16 object-contain">
        </button>
        ${selected ? `<span class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-[10px]"><i class="fas fa-check"></i></span>` : ''}
        <button type="button" data-config-action="delete-personalization-image" data-filename="${escapeHtml(img.filename)}"
            title="${_t('admin.config.ui.personalization_delete_confirm')}"
            class="absolute -top-1.5 -left-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px]">
            <i class="fas fa-times"></i>
        </button>
    </div>`;
}

function togglePersonalizationEnabled(checked) {
    if (checked) {
        _showPersonalizationImages();
    } else {
        const grid = document.getElementById('personalization-images-grid');
        if (grid) grid.hidden = true;
    }
}

function selectPersonalizationImage(filename) {
    _personalizationSelected = filename;
    document.querySelectorAll('[data-config-action="select-personalization-image"]').forEach(btn => {
        const wrapper = btn.closest('.relative');
        if (!wrapper) return;
        const isSelected = btn.dataset.filename === filename;
        wrapper.className = _personalizationThumbClass(isSelected);
        const badge = wrapper.querySelector('.absolute.-top-1\\.5.-right-1\\.5');
        if (isSelected && !badge) {
            wrapper.insertAdjacentHTML('afterbegin', '<span class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-[10px]"><i class="fas fa-check"></i></span>');
        } else if (!isSelected && badge) {
            badge.remove();
        }
    });
    refreshConfigSaveBar();
}

function uploadPersonalizationImage(file) {
    const status = document.getElementById('personalization-upload-status');
    if (status) status.textContent = _t('admin.config.ui.personalization_uploading');

    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/admin/ui-settings/personalization-images', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getAuthToken() },
        body: formData
    }).then(r => r.json()).then(data => {
        if (status) status.textContent = '';
        if (data.success) {
            loadPersonalizationImages();
        } else if (status) {
            status.textContent = data.error || _t('admin.config.ui.personalization_upload_error');
        }
    }).catch(() => {
        if (status) status.textContent = _t('admin.config.ui.personalization_upload_error');
    });
}

function deletePersonalizationImage(filename) {
    mostrarModalConfirmacion(
        _t('admin.config.ui.personalization_label'),
        _t('admin.config.ui.personalization_delete_confirm'),
        () => {
            fetch('/api/admin/ui-settings/personalization-images/' + encodeURIComponent(filename), {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + getAuthToken() }
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    // El servidor quita la imagen de la configuración si era la guardada
                    if (_configData.__ui && _configData.__ui.personalizationImage === filename) {
                        _configData.__ui.personalizationImage = null;
                        patchConfigSaveBarInitial({ personalizationImage: null });
                    }
                    if (_personalizationSelected === filename) _personalizationSelected = null;
                    refreshConfigSaveBar();
                    loadPersonalizationImages();
                } else {
                    const status = document.getElementById('personalization-upload-status');
                    if (status) status.textContent = data.error || _t('admin.config.ui.personalization_delete_error');
                }
            }).catch(() => {
                const status = document.getElementById('personalization-upload-status');
                if (status) status.textContent = _t('admin.config.ui.personalization_delete_error');
            });
        }
    );
}
