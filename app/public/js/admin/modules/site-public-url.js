/* ===== URL PÚBLICA DEL SERVIDOR (pestaña Licencia, solo admin) ===== */

let _publicUrlDelegationReady = false;

function _renderPublicUrlCard(currentValue) {
    const value = escapeHtml(currentValue || '');

    return `
        <div class="bg-white rounded-2xl border-2 border-red-200 p-6 shadow-sm space-y-3">
            <h3 class="font-black text-slate-900"><i class="fas fa-globe text-red-600 mr-2"></i>${_t('admin.publicurl.title', null, 'URL pública del servidor')}</h3>
            <p class="text-sm text-slate-500">${_t('admin.publicurl.subtitle', null, 'Se usa en los enlaces de los correos (verificación, registro) y en el retorno de PayPal. Déjala vacía para que se detecte automáticamente según el dominio desde el que navega cada usuario.')}</p>
            <input id="public-url-input" type="url" value="${value}" autocomplete="off" spellcheck="false"
                placeholder="https://xiro.pro"
                class="w-full border-2 border-slate-200 rounded-xl p-3 font-mono text-sm focus:border-red-500 outline-none transition bg-white text-slate-900">
            <div class="flex flex-wrap gap-3">
                <button data-public-url-action="save"
                    class="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
                    <i class="fas fa-save text-xs"></i> ${_t('admin.publicurl.btn_save', null, 'Guardar')}
                </button>
            </div>
            <div id="public-url-result" class="text-sm"></div>
        </div>`;
}

function renderSitePublicUrlCard() {
    const area = document.getElementById('public-url-area');
    if (!area) return;

    area.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.publicurl.loading', null, 'Cargando configuración…')}</div>`);

    fetch('/api/admin/config', { headers: { 'Authorization': 'Bearer ' + getAuthToken() } })
        .then(response => response.json())
        .then(data => {
            const liveArea = document.getElementById('public-url-area');
            if (!liveArea) return;
            const currentValue = data.success ? (data.config?.PUBLIC_BASE_URL?.value || '') : '';
            liveArea.innerHTML = _tHtml(_renderPublicUrlCard(currentValue));
        })
        .catch(() => {
            const liveArea = document.getElementById('public-url-area');
            if (liveArea) liveArea.innerHTML = _tHtml(_renderPublicUrlCard(''));
        });
}

function _savePublicUrl() {
    const input = document.getElementById('public-url-input');
    const resultEl = document.getElementById('public-url-result');
    const value = input ? input.value.trim() : '';

    if (resultEl) {
        resultEl.innerHTML = _tHtml(`<span class="text-slate-400"><i class="fas fa-spin fa-circle-notch mr-1"></i>${_t('admin.publicurl.saving', null, 'Guardando…')}</span>`);
    }

    fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ updates: { PUBLIC_BASE_URL: value } })
    })
        .then(response => response.json())
        .then(data => {
            if (!resultEl) return;
            if (data.success) {
                const message = value
                    ? _t('admin.publicurl.saved', null, 'URL pública guardada.')
                    : _t('admin.publicurl.saved_auto', null, 'Guardado: detección automática por dominio.');
                resultEl.innerHTML = _tHtml(`<span class="text-emerald-600 font-semibold"><i class="fas fa-check-circle mr-1"></i>${message}</span>`);
            } else {
                const error = data.errors?.PUBLIC_BASE_URL || data.error || _t('admin.publicurl.error_save', null, 'No se pudo guardar');
                resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${escapeHtml(error)}</span>`);
            }
        })
        .catch(() => {
            if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${_t('admin.publicurl.error_net', null, 'Error de red al guardar')}</span>`);
        });
}

function _initPublicUrlDelegation() {
    if (_publicUrlDelegationReady) return;
    _publicUrlDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-public-url-action]');
        if (!actionElement) return;
        if (actionElement.dataset.publicUrlAction === 'save') {
            _savePublicUrl();
        }
    });
}

_initPublicUrlDelegation();
