/* ===== COMPRA INTEGRADA DE LICENCIA (panel Usuario) ===== */

let _userLicenseCheckoutReady = false;

function _formatPlanPrice(amountCents, currency) {
    try {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency || 'EUR' })
            .format((Number(amountCents) || 0) / 100);
    } catch (_error) {
        return `${((Number(amountCents) || 0) / 100).toFixed(2)} ${currency || ''}`;
    }
}

function _formatPlanDuration(durationHours) {
    const hours = Number(durationHours) || 0;
    if (hours >= 24 && hours % 24 === 0) {
        const days = hours / 24;
        return days === 1
            ? `1 ${_t('admin.userlicense.day', null, 'día')}`
            : `${days} ${_t('admin.userlicense.days', null, 'días')}`;
    }
    return `${hours} h`;
}

function _renderPlanButtons(plans) {
    if (!plans.length) {
        return `<p class="text-sm text-slate-500">${_t('admin.userlicense.no_plans', null, 'No hay planes disponibles en este momento.')}</p>`;
    }

    const cards = plans.map(plan => `
        <button type="button" data-user-license-plan="${escapeHtml(plan.code)}"
            class="text-left border-2 border-slate-200 hover:border-red-500 rounded-xl p-4 transition-all bg-white">
            <p class="font-black text-slate-900">${escapeHtml(plan.name || plan.code)}</p>
            <p class="text-2xl font-black text-red-600 my-1">${_formatPlanPrice(plan.amountCents, plan.currency)}</p>
            <p class="text-xs text-slate-500">${_formatPlanDuration(plan.durationHours)}</p>
        </button>`).join('');

    return `
        <p class="text-sm font-bold text-slate-700 mb-3">${_t('admin.userlicense.choose_plan', null, 'Elige un plan (pago con PayPal):')}</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${cards}</div>`;
}

function renderUserLicensePlans() {
    const area = document.getElementById('user-license-plans');
    if (!area) return;

    if (!area.classList.contains('hidden') && area.dataset.loaded === '1') {
        area.classList.add('hidden');
        return;
    }

    area.classList.remove('hidden');
    area.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.userlicense.loading_plans', null, 'Cargando planes…')}</div>`);

    fetchWithAuth('/api/user/license/plans')
        .then(response => response.json())
        .then(data => {
            const liveArea = document.getElementById('user-license-plans');
            if (!liveArea) return;
            if (data.success) {
                liveArea.dataset.loaded = '1';
                liveArea.innerHTML = _tHtml(_renderPlanButtons(Array.isArray(data.plans) ? data.plans : []));
            } else {
                liveArea.innerHTML = _tHtml(`<p class="text-sm text-red-600">${_t('admin.userlicense.error_plans', null, 'No se pudieron cargar los planes.')}</p>`);
            }
        })
        .catch(() => {
            const liveArea = document.getElementById('user-license-plans');
            if (liveArea) liveArea.innerHTML = _tHtml(`<p class="text-sm text-red-600">${_t('admin.userlicense.error_plans', null, 'No se pudieron cargar los planes.')}</p>`);
        });
}

function _startUserLicenseCheckout(planCode, buttonElement) {
    const resultEl = document.getElementById('user-license-result');
    if (buttonElement) buttonElement.disabled = true;
    if (resultEl) {
        resultEl.innerHTML = _tHtml(`<span class="text-slate-400"><i class="fas fa-spin fa-circle-notch mr-1"></i>${_t('admin.userlicense.redirecting', null, 'Preparando el pago con PayPal…')}</span>`);
    }

    fetchWithAuth('/api/user/license/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.approveUrl) {
                window.location.href = data.approveUrl;
                return;
            }
            if (buttonElement) buttonElement.disabled = false;
            if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${escapeHtml(data.error || _t('admin.userlicense.error_checkout', null, 'No se pudo iniciar la compra'))}</span>`);
        })
        .catch(() => {
            if (buttonElement) buttonElement.disabled = false;
            if (resultEl) resultEl.innerHTML = _tHtml(`<span class="text-red-600 font-medium"><i class="fas fa-times-circle mr-1"></i>${_t('admin.userlicense.error_net', null, 'Error de red al iniciar la compra')}</span>`);
        });
}

const _PURCHASE_RESULT_STYLES = {
    success: { classes: 'bg-emerald-600', icon: 'fa-check-circle' },
    pending: { classes: 'bg-amber-500', icon: 'fa-hourglass-half' },
    cancelled: { classes: 'bg-slate-600', icon: 'fa-ban' },
    expired: { classes: 'bg-amber-600', icon: 'fa-clock' },
    error: { classes: 'bg-red-600', icon: 'fa-times-circle' }
};

function _purchaseResultMessage(result) {
    const messages = {
        success: _t('admin.userlicense.purchase_success', null, 'Pago completado: tu licencia ya está activa en tu cuenta.'),
        pending: _t('admin.userlicense.purchase_pending', null, 'Pago recibido; la licencia se está emitiendo. Revisa tu licencia en unos minutos.'),
        cancelled: _t('admin.userlicense.purchase_cancelled', null, 'Pago cancelado. No se ha realizado ningún cargo.'),
        expired: _t('admin.userlicense.purchase_expired', null, 'La sesión de compra caducó. Si pagaste, contacta con soporte.'),
        error: _t('admin.userlicense.purchase_error', null, 'No se pudo completar la compra. Si el cargo se realizó, contacta con soporte.')
    };
    return messages[result] || messages.error;
}

function _showPurchaseResultBanner(result) {
    const style = _PURCHASE_RESULT_STYLES[result] || _PURCHASE_RESULT_STYLES.error;
    const banner = document.createElement('div');
    banner.className = `fixed top-4 left-1/2 -translate-x-1/2 z-50 ${style.classes} text-white font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-xl`;
    banner.innerHTML = _tHtml(`<i class="fas ${style.icon}"></i><span>${_purchaseResultMessage(result)}</span>`);
    banner.addEventListener('click', () => banner.remove());
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 12000);
}

function _handlePurchaseReturnParam() {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('licensePurchase');
    if (!result) return;

    params.delete('licensePurchase');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    _showPurchaseResultBanner(result);
}

function _initUserLicenseCheckout() {
    if (_userLicenseCheckoutReady) return;
    _userLicenseCheckoutReady = true;

    document.addEventListener('click', (event) => {
        const planElement = event.target.closest('[data-user-license-plan]');
        if (planElement) {
            _startUserLicenseCheckout(planElement.dataset.userLicensePlan, planElement);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _handlePurchaseReturnParam);
    } else {
        _handlePurchaseReturnParam();
    }
}

_initUserLicenseCheckout();
