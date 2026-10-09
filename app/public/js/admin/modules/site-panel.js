/* ===== TAB DE LICENCIA ===== */
// Licencia + URL pública (site-public-url.js) se guardan con la barra común de
// Configuración (admin-savebar.js); las exenciones (license-exemptions.js) van al momento.

(function registerLicenseTab() {
    if (typeof _PARAM_SECTIONS === 'undefined') return;
    if (_PARAM_SECTIONS.some(section => section.id === 'licencia')) return;

    _PARAM_SECTIONS.push({
        id: 'licencia',
        titleKey: 'admin.config.tab.licencia',
        icon: 'fa-certificate',
        color: 'bg-red-600',
        isLicense: true,
        keys: []
    });
})();


const _STATUS_IMAGES = {
    active: String.fromCharCode(47, 105, 109, 97, 103, 101, 115, 47, 109, 48, 46, 115, 118, 103),
    inactive: String.fromCharCode(47, 105, 109, 97, 103, 101, 115, 47, 109, 49, 46, 115, 118, 103)
};

function _renderLicenseStatus(data) {
    const isValid = _licenseField(data, 0, false) === true;
    const expiry = _formatLicenseExpiry(_licenseField(data, 1, null));
    const invalidReason = _licenseField(data, 2, null);

    if (isValid) {
        return `
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p class="font-bold text-emerald-800"><i class="fas fa-check-circle mr-2"></i>${_t('admin.license.valid')}</p>
                <p class="text-sm text-emerald-700 mt-1">${expiry ? `${_t('admin.license.expiry_prefix')} ${escapeHtml(expiry)}` : _t('admin.license.is_active')}</p>
            </div>`;
    }

    if (invalidReason === 'license_in_use') {
        return `
            <div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p class="font-bold text-amber-800"><i class="fas fa-desktop mr-2"></i>${_t('admin.license.in_use')}</p>
                <p class="text-sm text-amber-700 mt-1">${_t('admin.license.in_use_help')}</p>
            </div>`;
    }

    if (invalidReason === 'invalid_format') {
        return `
            <div class="rounded-xl border border-red-200 bg-red-50 p-4">
                <p class="font-bold text-red-800"><i class="fas fa-exclamation-triangle mr-2"></i>${_t('admin.license.invalid_format')}</p>
                <p class="text-sm text-red-700 mt-1">${_t('admin.license.format_check')}</p>
            </div>`;
    }

    if (data.license) {
        return `
            <div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p class="font-bold text-amber-800"><i class="fas fa-exclamation-circle mr-2"></i>${_t('admin.license.invalid')}</p>
                <p class="text-sm text-amber-700 mt-1">${_t('admin.license.remote_rejected')}</p>
            </div>`;
    }

    return `
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="font-bold text-slate-700"><i class="fas fa-info-circle mr-2"></i>${_t('admin.license.no_license')}</p>
            <p class="text-sm text-slate-500 mt-1">${_t('admin.license.no_license_info')}</p>
        </div>`;
}

function _renderLicensePanel(data) {
    if (data && data.success === false) {
        return `
            <div class="bg-white rounded-2xl border-2 border-red-200 p-6 shadow-sm">
                <p class="font-bold text-red-700"><i class="fas fa-times-circle mr-2"></i>${_t('admin.license.error_load')}</p>
                <p class="text-sm text-red-600 mt-1">${escapeHtml(data.error || _t('admin.tools.error_unknown'))}</p>
                <div class="mt-5 pt-4 border-t border-slate-100">
                    <img src="${_STATUS_IMAGES.inactive}" alt="${_t('admin.license.inactive_alt')}" class="w-full max-w-sm h-auto mx-auto">
                </div>
            </div>`;
    }

    const licenseValue = escapeHtml(data.license || '');
    const status = _renderLicenseStatus(data || {});
    const isLicensed = _licenseField(data, 0, false) === true;
    const licenseImage = isLicensed ? _STATUS_IMAGES.active : _STATUS_IMAGES.inactive;
    const licenseAlt = isLicensed ? _t('admin.license.active_alt') : _t('admin.license.inactive_alt');

    return `
        <div class="space-y-4">
            <div class="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-6 shadow-sm">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white">
                        <i class="fas fa-certificate text-lg"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-red-900">${_t('admin.license.title')}</h3>
                        <p class="text-sm text-red-700">${_t('admin.license.subtitle')}</p>
                    </div>
                </div>
                <a href="https://auth.xiro.pro" target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl transition-all">
                    <i class="fas fa-shopping-cart text-sm"></i> ${_t('admin.license.btn_buy')}
                </a>
            </div>

            <div class="bg-white rounded-2xl border-2 border-red-200 p-6 shadow-sm space-y-4">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">${_t('admin.license.input_label')}</label>
                    <input id="license-input" type="text" value="${licenseValue}" autocomplete="off" spellcheck="false"
                        placeholder="${_t('admin.license.input_ph')}"
                        class="w-full border-2 border-slate-200 rounded-xl p-3 font-mono text-sm focus:border-red-500 outline-none transition bg-white text-slate-900">
                    <p class="text-xs text-slate-500 mt-2">${_t('admin.license.input_help')}</p>
                </div>

                ${status}
                <div class="pt-3 border-t border-slate-100">
                    <img src="${licenseImage}" alt="${licenseAlt}" class="w-full max-w-sm h-auto mx-auto">
                </div>
            </div>

            <div id="public-url-area"></div>

            <div id="license-exemptions-area"></div>
        </div>`;
}

function renderLicenseTab() {
    unbindSaveBar();
    const area = document.getElementById('config-tab-content');
    if (area) {
        area.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.license.loading')}</div>`);
    }

    fetch('/api/admin/license', { headers: { 'Authorization': 'Bearer ' + getAuthToken() } })
        .then(response => response.json())
        .then(data => {
            const liveArea = document.getElementById('config-tab-content');
            if (!liveArea) return;
            liveArea.innerHTML = _tHtml(_renderLicensePanel(data || {}));
            if (typeof renderLicenseExemptions === 'function') {
                renderLicenseExemptions();
            }
            // La barra se conecta cuando la URL pública ya está pintada (llega con otra petición)
            const urlCard = typeof renderSitePublicUrlCard === 'function' ? renderSitePublicUrlCard() : null;
            Promise.resolve(urlCard).then(() => {
                if (document.getElementById('config-tab-content') === liveArea) {
                    bindSaveBar({ snapshot: _licenseTabSnapshot, save: _saveLicenseTab, discard: renderLicenseTab });
                }
            });
        })
        .catch(() => {
            const liveArea = document.getElementById('config-tab-content');
            if (liveArea) liveArea.innerHTML = _tHtml(`<p class="text-red-500 font-medium">${_t('admin.license.error_load_tab')}</p>`);
        });
}

function _licenseTabSnapshot() {
    const val = id => document.getElementById(id)?.value.trim() ?? null;
    return { license: val('license-input'), publicUrl: val('public-url-input') };
}

async function _saveLicenseTab(initial) {
    const now = _licenseTabSnapshot();
    if (now.publicUrl !== initial.publicUrl) {
        const result = await savePublicUrl(now.publicUrl);
        if (!result.ok) return result;
        if (now.license === initial.license) return result;
    }
    return now.license !== initial.license ? _saveLicense(now.license) : { ok: true };
}

/** POST /api/admin/license; repinta la pestaña para mostrar el estado nuevo. */
async function _saveLicense(license) {
    const res = await fetch('/api/admin/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ license })
    });
    const data = await res.json();
    if (!data.success) return { ok: false, message: escapeHtml(data.error || _t('admin.tools.error_unknown')) };

    setTimeout(renderLicenseTab, 1500);
    if (_licenseField(data, 0, false) === true) return { ok: true, message: _t('admin.license.save_validated') };
    if (_licenseField(data, 2, null) === 'invalid_format') return { ok: false, message: _t('admin.license.save_invalid_format') };
    if (data.license) return { ok: false, message: _t('admin.license.save_invalid') };
    return { ok: true, message: _t('admin.license.save_deleted') };
}
