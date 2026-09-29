/* ===== LIBERACIÓN DE JUEGOS DE EDITORES (pestaña Licencia, solo admin) ===== */

let _licenseExemptionsDelegationReady = false;

const _EXEMPT_TYPE_LABELS = {
    bank: 'Banco',
    game: 'Juego',
    custom_game: 'Personalizado',
    trivial: 'Trivial',
    quiz: 'Quiz'
};

const _EXEMPT_TYPE_CHIP = {
    bank: 'bg-purple-100 text-purple-700',
    game: 'bg-green-100 text-green-700',
    custom_game: 'bg-blue-100 text-blue-700',
    trivial: 'bg-orange-100 text-orange-700',
    quiz: 'bg-cyan-100 text-cyan-700'
};

function _renderExemptionRow(item) {
    const exempt = item.licenseExempt === true;
    const statusBadge = exempt
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700"><i class="fas fa-unlock"></i> ${_t('admin.exempt.state_free', null, 'Liberado')}</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600"><i class="fas fa-lock"></i> ${_t('admin.exempt.state_restricted', null, 'Restringido')}</span>`;

    const actionButton = exempt
        ? `<button data-license-exempt-type="${escapeHtml(item.type)}" data-license-exempt-id="${item.id}" data-license-exempt-next="false"
              class="text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition">
              ${_t('admin.exempt.btn_restrict', null, 'Restringir')}
           </button>`
        : `<button data-license-exempt-type="${escapeHtml(item.type)}" data-license-exempt-id="${item.id}" data-license-exempt-next="true"
              class="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition">
              ${_t('admin.exempt.btn_free', null, 'Liberar')}
           </button>`;

    return `
        <tr class="border-t border-slate-100">
            <td class="px-3 py-2"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${_EXEMPT_TYPE_CHIP[item.type] || 'bg-slate-100 text-slate-600'}">${escapeHtml(_EXEMPT_TYPE_LABELS[item.type] || item.type)}</span></td>
            <td class="px-3 py-2 font-semibold text-slate-800">${escapeHtml(item.name || '')}</td>
            <td class="px-3 py-2 font-mono text-xs text-slate-500">${escapeHtml(item.pin || '-')}</td>
            <td class="px-3 py-2 text-slate-600">${escapeHtml(item.ownerUsername || '—')}</td>
            <td class="px-3 py-2">${statusBadge}</td>
            <td class="px-3 py-2 text-right">${actionButton}</td>
        </tr>`;
}

function _renderExemptionsBlock(items) {
    const rows = items.map(_renderExemptionRow).join('');
    const emptyRow = `<tr><td colspan="6" class="px-3 py-6 text-center text-slate-400">${_t('admin.exempt.empty', null, 'No hay contenido creado por editores.')}</td></tr>`;

    return `
        <div class="bg-white rounded-2xl border-2 border-red-200 p-6 shadow-sm">
            <h3 class="font-black text-slate-900 mb-1"><i class="fas fa-unlock-alt text-red-600 mr-2"></i>${_t('admin.exempt.title', null, 'Juegos de editores')}</h3>
            <p class="text-sm text-slate-500 mb-4">${_t('admin.exempt.subtitle', null, 'El contenido liberado se comporta como si fuera del administrador: con licencia de instalación juega sin límite; sin ella, se aplica el límite de 10 jugadores + presentador.')}</p>
            <div class="overflow-x-auto border border-slate-200 rounded-xl">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50 text-slate-600 uppercase text-xs">
                        <tr>
                            <th class="px-3 py-2 text-left">${_t('admin.exempt.col_type', null, 'Tipo')}</th>
                            <th class="px-3 py-2 text-left">${_t('admin.exempt.col_name', null, 'Nombre')}</th>
                            <th class="px-3 py-2 text-left">PIN</th>
                            <th class="px-3 py-2 text-left">${_t('admin.exempt.col_owner', null, 'Creador')}</th>
                            <th class="px-3 py-2 text-left">${_t('admin.exempt.col_state', null, 'Estado')}</th>
                            <th class="px-3 py-2 text-right">${_t('admin.exempt.col_actions', null, 'Acción')}</th>
                        </tr>
                    </thead>
                    <tbody>${rows || emptyRow}</tbody>
                </table>
            </div>
            <p id="license-exemptions-message" class="hidden mt-3 text-sm font-semibold"></p>
        </div>`;
}

function renderLicenseExemptions() {
    const area = document.getElementById('license-exemptions-area');
    if (!area) return;

    area.innerHTML = _tHtml(`<div class="text-slate-400 flex items-center gap-2 mt-4"><i class="fas fa-spin fa-circle-notch"></i> ${_t('admin.exempt.loading', null, 'Cargando juegos de editores…')}</div>`);

    fetch('/api/admin/license-exemptions', { headers: { 'Authorization': 'Bearer ' + getAuthToken() } })
        .then(response => response.json())
        .then(data => {
            const liveArea = document.getElementById('license-exemptions-area');
            if (!liveArea) return;
            if (data.success) {
                liveArea.innerHTML = _tHtml(_renderExemptionsBlock(Array.isArray(data.items) ? data.items : []));
            } else {
                liveArea.innerHTML = _tHtml(`<p class="text-sm text-red-600 mt-4">${escapeHtml(data.error || _t('admin.exempt.error_load', null, 'No se pudo cargar el listado'))}</p>`);
            }
        })
        .catch(() => {
            const liveArea = document.getElementById('license-exemptions-area');
            if (liveArea) liveArea.innerHTML = _tHtml(`<p class="text-sm text-red-600 mt-4">${_t('admin.exempt.error_load', null, 'No se pudo cargar el listado')}</p>`);
        });
}

function _setExemptionMessage(message, isError) {
    const box = document.getElementById('license-exemptions-message');
    if (!box) return;
    box.textContent = message;
    box.classList.remove('hidden');
    box.classList.toggle('text-red-600', isError === true);
    box.classList.toggle('text-emerald-600', isError !== true);
}

function _toggleLicenseExemption(type, id, exempt, buttonElement) {
    if (buttonElement) buttonElement.disabled = true;

    fetch(`/api/admin/license-exemptions/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getAuthToken() },
        body: JSON.stringify({ exempt })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderLicenseExemptions();
            } else {
                if (buttonElement) buttonElement.disabled = false;
                _setExemptionMessage(data.error || _t('admin.exempt.error_save', null, 'No se pudo actualizar'), true);
            }
        })
        .catch(() => {
            if (buttonElement) buttonElement.disabled = false;
            _setExemptionMessage(_t('admin.exempt.error_net', null, 'Error de red al actualizar'), true);
        });
}

function _initLicenseExemptionsDelegation() {
    if (_licenseExemptionsDelegationReady) return;
    _licenseExemptionsDelegationReady = true;

    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-license-exempt-type]');
        if (!button) return;

        _toggleLicenseExemption(
            button.dataset.licenseExemptType,
            Number(button.dataset.licenseExemptId),
            button.dataset.licenseExemptNext === 'true',
            button
        );
    });
}

_initLicenseExemptionsDelegation();
