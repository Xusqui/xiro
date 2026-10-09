/* ===== URL PÚBLICA DEL SERVIDOR (pestaña Licencia, solo admin) ===== */
// Se guarda con la barra común de Configuración (site-panel.js → _saveLicenseTab).

function _renderPublicUrlCard(currentValue) {
    const value = escapeHtml(currentValue || '');

    return `
        <div class="bg-white rounded-2xl border-2 border-red-200 p-6 shadow-sm space-y-3">
            <h3 class="font-black text-slate-900"><i class="fas fa-globe text-red-600 mr-2"></i>${_t('admin.publicurl.title', null, 'URL pública del servidor')}</h3>
            <p class="text-sm text-slate-500">${_t('admin.publicurl.subtitle', null, 'Se usa en los enlaces de los correos (verificación, registro) y en el retorno de PayPal. Déjala vacía para que se detecte automáticamente según el dominio desde el que navega cada usuario.')}</p>
            <input id="public-url-input" type="url" value="${value}" autocomplete="off" spellcheck="false"
                placeholder="https://xiro.pro"
                class="w-full border-2 border-slate-200 rounded-xl p-3 font-mono text-sm focus:border-red-500 outline-none transition bg-white text-slate-900">
        </div>`;
}

/** Pinta la tarjeta; devuelve una promesa que se resuelve cuando ya está en pantalla. */
function renderSitePublicUrlCard() {
    const area = document.getElementById('public-url-area');
    if (!area) return Promise.resolve();

    area.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.publicurl.loading', null, 'Cargando configuración…')}</div>`);

    return fetch('/api/admin/config', { headers: { 'Authorization': 'Bearer ' + getAuthToken() } })
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

/**
 * Guarda PUBLIC_BASE_URL; vacía = detección automática por dominio.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function savePublicUrl(value) {
    const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ updates: { PUBLIC_BASE_URL: value } })
    });
    const data = await res.json();
    if (!data.success) {
        const error = data.errors?.PUBLIC_BASE_URL || data.error || _t('admin.publicurl.error_save', null, 'No se pudo guardar');
        return { ok: false, message: escapeHtml(error) };
    }
    return {
        ok: true,
        message: value
            ? _t('admin.publicurl.saved', null, 'URL pública guardada.')
            : _t('admin.publicurl.saved_auto', null, 'Guardado: detección automática por dominio.')
    };
}
