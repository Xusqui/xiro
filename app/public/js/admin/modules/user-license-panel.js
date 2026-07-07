/* ===== TARJETA "MI LICENCIA" (panel Usuario) ===== */

let _userLicenseDelegationReady = false;

const _USER_LICENSE_FIELDS = [
    String.fromCharCode(118, 97, 108, 105, 100),
    String.fromCharCode(101, 120, 112, 105, 114, 101, 115, 65, 116),
    String.fromCharCode(114, 101, 97, 115, 111, 110)
];

function _userLicenseField(data, fieldIndex, fallback = null) {
    if (!data || typeof data !== 'object') return fallback;
    const key = _USER_LICENSE_FIELDS[fieldIndex];
    return data[key] !== undefined ? data[key] : fallback;
}

function _userLicenseDaysLeft(expiryValue) {
    if (!expiryValue) return null;
    const expiryMs = new Date(expiryValue).getTime();
    if (Number.isNaN(expiryMs)) return null;
    return Math.max(0, Math.ceil((expiryMs - Date.now()) / 86400000));
}

function _renderUserLicenseStatus(data) {
    const isValid = _userLicenseField(data, 0, false) === true;
    const reason = _userLicenseField(data, 2, null);

    if (isValid) {
        const expiry = _formatLicenseExpiry(_userLicenseField(data, 1, null));
        const daysLeft = _userLicenseDaysLeft(_userLicenseField(data, 1, null));
        const daysText = daysLeft !== null
            ? ` (${daysLeft} ${_t('admin.userlicense.days_left', null, 'días restantes')})`
            : '';
        return `
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p class="font-bold text-emerald-800"><i class="fas fa-check-circle mr-2"></i>${_t('admin.userlicense.valid', null, 'Licencia individual activa')}</p>
                <p class="text-sm text-emerald-700 mt-1">${expiry ? `${_t('admin.userlicense.expiry_prefix', null, 'Caduca el')} ${escapeHtml(expiry)}${daysText}` : _t('admin.userlicense.is_active', null, 'Tus juegos no tienen límite de participantes.')}</p>
            </div>`;
    }

    if (data.license) {
        const isFormat = reason === 'invalid_format';
        return `
            <div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p class="font-bold text-amber-800"><i class="fas fa-exclamation-circle mr-2"></i>${isFormat ? _t('admin.userlicense.invalid_format', null, 'El formato de la clave no es válido') : _t('admin.userlicense.invalid', null, 'Licencia no válida o caducada')}</p>
                <p class="text-sm text-amber-700 mt-1">${_t('admin.userlicense.limited', null, 'Tus juegos quedan limitados a 10 jugadores + presentador.')}</p>
            </div>`;
    }

    return `
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="font-bold text-slate-700"><i class="fas fa-info-circle mr-2"></i>${_t('admin.userlicense.no_license', null, 'Sin licencia individual')}</p>
            <p class="text-sm text-slate-500 mt-1">${_t('admin.userlicense.limited', null, 'Tus juegos quedan limitados a 10 jugadores + presentador.')}</p>
        </div>`;
}

function _renderUserLicenseCardContent(data) {
    if (data && data.success === false) {
        return `
            <p class="font-bold text-red-700"><i class="fas fa-times-circle mr-2"></i>${_t('admin.userlicense.error_load', null, 'No se pudo cargar tu licencia')}</p>
            <p class="text-sm text-red-600 mt-1">${escapeHtml(data.error || '')}</p>`;
    }

    if (data.role === 'admin') {
        return `
            <h3 class="text-lg font-bold text-slate-800 mb-4"><i class="fas fa-certificate text-red-600 mr-2"></i>${_t('admin.userlicense.title', null, 'Mi licencia')}</h3>
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p class="font-bold text-emerald-800"><i class="fas fa-check-circle mr-2"></i>${_t('admin.userlicense.admin_covered', null, 'Cubierta por la licencia de la instalación')}</p>
                <p class="text-sm text-emerald-700 mt-1">${_t('admin.userlicense.admin_covered_info', null, 'Como administrador, tu contenido se desbloquea con la licencia del sitio. No necesitas una licencia individual.')}</p>
            </div>`;
    }

    const licenseValue = escapeHtml(data.license || '');

    return `
        <h3 class="text-lg font-bold text-slate-800 mb-4"><i class="fas fa-certificate text-red-600 mr-2"></i>${_t('admin.userlicense.title', null, 'Mi licencia')}</h3>
        <div class="space-y-4">
            ${_renderUserLicenseStatus(data)}
            <div>
                <label class="block text-sm font-bold text-slate-700 mb-2">${_t('admin.userlicense.input_label', null, 'Clave de licencia')}</label>
                <input id="user-license-input" type="text" value="${licenseValue}" autocomplete="off" spellcheck="false"
                    placeholder="${_t('admin.userlicense.input_ph', null, 'Pega aquí tu clave de licencia')}"
                    class="w-full border-2 border-slate-200 rounded-xl p-3 font-mono text-sm focus:border-red-500 outline-none transition bg-white text-slate-900">
                <p class="text-xs text-slate-500 mt-2">${_t('admin.userlicense.input_help', null, 'Guarda vacío para eliminar la licencia.')}</p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
                <button data-user-license-action="save"
                    class="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
                    <i class="fas fa-save text-xs"></i> ${_t('admin.userlicense.btn_save', null, 'Guardar y validar')}
                </button>
                <button data-user-license-action="plans"
                    class="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 font-bold px-5 py-2.5 rounded-xl border-2 border-slate-200 transition-all text-sm">
                    <i class="fas fa-shopping-cart text-xs"></i> ${_t('admin.userlicense.btn_buy', null, 'Comprar licencia')}
                </button>
            </div>
            <div id="user-license-plans" class="hidden"></div>
            <div id="user-license-result" class="text-sm"></div>
        </div>`;
}

function renderUserLicenseCard() {
    const card = document.getElementById('user-license-card');
    if (!card) return;

    card.className = 'bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6';
    card.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.userlicense.loading', null, 'Comprobando tu licencia…')}</div>`);

    fetchWithAuth('/api/user/license')
        .then(response => response.json())
        .then(data => {
            const liveCard = document.getElementById('user-license-card');
            if (liveCard) liveCard.innerHTML = _tHtml(_renderUserLicenseCardContent(data || {}));
        })
        .catch(() => {
            const liveCard = document.getElementById('user-license-card');
            if (liveCard) liveCard.innerHTML = _tHtml(_renderUserLicenseCardContent({ success: false }));
        });
}

function _saveUserLicense() {
    const input = document.getElementById('user-license-input');
    const resultEl = document.getElementById('user-license-result');
    const license = input ? input.value.trim() : '';

    if (resultEl) {
        resultEl.innerHTML = _tHtml(`<span class="text-slate-400"><i class="fas fa-spin fa-circle-notch mr-1"></i>${_t('admin.userlicense.saving', null, 'Guardando y validando…')}</span>`);
    }

    fetchWithAuth('/api/user/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license })
    })
        .then(response => response.json())
        .then(data => {
            if (!resultEl) return;

            if (data.success) {
                setTimeout(renderUserLicenseCard, 700);
            } else {
                resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${escapeHtml(data.error || data.message || _t('admin.userlicense.error_save', null, 'No se pudo guardar'))}</span>`);
            }
        })
        .catch(() => {
            if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${_t('admin.userlicense.error_net', null, 'Error de red al guardar')}</span>`);
        });
}

function _initUserLicenseDelegation() {
    if (_userLicenseDelegationReady) return;
    _userLicenseDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-user-license-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.userLicenseAction;
        if (action === 'save') {
            _saveUserLicense();
        } else if (action === 'plans' && typeof renderUserLicensePlans === 'function') {
            renderUserLicensePlans();
        }
    });
}

_initUserLicenseDelegation();
