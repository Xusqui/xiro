/**
 * @fileoverview Gestión de juegos Trivial - Vista principal y CRUD
 * Parte 1 de 2: Lista y operaciones. Ver trivial-editor.js para el formulario.
 */

let _trivialListDelegationReady = false;

// ===== VISTA PRINCIPAL =====

function ocultarTodosTrivial() {
    toggleAllVisibleToPresenter('/api/trivial-games/visibility-all', false, renderVistaTrivial);
}

function mostrarTodosTrivial() {
    toggleAllVisibleToPresenter('/api/trivial-games/visibility-all', true, renderVistaTrivial);
}

async function renderVistaTrivial() {
    clearUnsavedChangesGuard();
    const res = await fetchWithAuth('/api/trivial-games');
    const games = await res.json();
    const area = document.getElementById('editorArea');

    area.innerHTML = _tHtml(`
        <div class="max-w-7xl mx-auto p-10">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
                        <div class="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                            <i class="fas fa-dice text-white text-xl"></i>
                        </div>
                        ${_t('admin.trivial.title', null, 'Juegos Trivial')}
                    </h1>
                    <p class="text-slate-500">${_t('admin.trivial.subtitle', null, 'Crea tableros Trivial con categorías propias')}</p>
                </div>
                <div class="flex gap-3">
                    <button data-admin-click="ocultarTodosTrivial()" title="${_t('admin.common.btn_hide_all_presenter', null, 'Ocultar todos estos juegos al presentador')}" aria-label="${_t('admin.common.btn_hide_all_presenter', null, 'Ocultar todos estos juegos al presentador')}"
                        class="w-14 h-14 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl transition flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-eye-slash text-lg"></i>
                    </button>
                    <button data-admin-click="mostrarTodosTrivial()" title="${_t('admin.common.btn_show_all_presenter', null, 'Mostrar todos estos juegos al presentador')}" aria-label="${_t('admin.common.btn_show_all_presenter', null, 'Mostrar todos estos juegos al presentador')}"
                        class="w-14 h-14 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-xl transition flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-eye text-lg"></i>
                    </button>
                    <button data-trivial-list-action="new-trivial"
                        class="bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-3">
                        <i class="fas fa-plus-circle text-xl"></i>
                        ${_t('admin.trivial.btn_new', null, 'Nuevo Trivial')}
                    </button>
                </div>
            </div>
            ${games.length === 0 ? `
                <div class="text-center py-20">
                    <i class="fas fa-dice text-slate-300 text-6xl mb-4"></i>
                    <p class="text-slate-400 text-xl">${_t('admin.trivial.empty', null, 'No hay juegos Trivial todavía')}</p>
                </div>` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${games.map(g => _trivialCard(g)).join('')}
                </div>`}
        </div>`);
}

function _trivialCard(g) {
    const ownerInfo = {
        created_by_role: g.created_by_role,
        created_by_user_id: g.created_by_user_id,
        created_by_username: g.created_by_username
    };
    const canModify = canModifyOwnedResource(ownerInfo);
    const editClasses = canModify
        ? 'flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 px-3 rounded-lg text-sm font-bold transition'
        : `flex-1 py-2 px-3 rounded-lg text-sm font-bold transition ${getLockedButtonClasses()}`;
    const cats = (g.categories || []);
    const swatches = cats.map(c =>
        `<span class="inline-block w-4 h-4 rounded-full border border-white/30" style="background:${c.color}"></span>`
    ).join('');
    return `
        <div class="bg-white rounded-2xl shadow-sm border-2 border-slate-200 hover:border-orange-500 transition-all hover:shadow-xl group overflow-hidden">
            <div class="p-6">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                        <h3 class="text-lg font-bold text-slate-900 mb-1 line-clamp-2">${g.name}</h3>
                        ${getOwnerBadgeHtml(ownerInfo)}
                        <div class="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-mono font-bold mb-2">
                            <i class="fas fa-key"></i> PIN: ${g.pin}
                        </div>
                        <div class="flex items-center gap-1 mt-2">${swatches}
                            <span class="text-xs text-slate-500 ml-1">${_t('admin.trivial.categories_count', { n: cats.length }, '{n} categoría(s)')}</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2 mt-4">
                    <button data-trivial-list-action="${canModify ? 'edit-trivial' : 'ownership-denied'}" data-id="${g.id}"
                        class="${editClasses}" ${canModify ? '' : 'title="Bloqueado: creado por otro usuario"'}>
                        <i class="fas fa-edit mr-1"></i> ${_t('admin.trivial.btn_edit', null, 'Editar')}
                    </button>
                    <button data-trivial-list-action="${canModify ? 'delete-trivial' : 'ownership-denied'}" data-id="${g.id}" data-owner-user-id="${g.created_by_user_id ?? ''}"
                        class="${canModify ? 'bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 py-2 px-3 rounded-lg text-sm font-bold transition' : `py-2 px-3 rounded-lg text-sm font-bold transition ${getLockedButtonClasses()}`}" ${canModify ? '' : 'title="Bloqueado: creado por otro usuario"'}>
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>`;
}

// ===== OPERACIONES =====

async function prepararNuevoTrivial() {
    await renderEditorTrivial(null, []);
}

async function cargarEditorTrivial(id) {
    const res = await fetchWithAuth(`/api/trivial-games/${id}`);
    const data = await res.json();

    if (!canModifyOwnedResource(data?.game)) {
        showOwnershipDeniedModal('este trivial');
        await renderVistaTrivial();
        return;
    }

    await renderEditorTrivial(data.game || data, data.game ? data.categories : (data.categories || []));
}

async function guardarTrivial(exit = true) {
    const id = document.getElementById('trivial-id')?.value;
    const ownerUserId = document.getElementById('trivial-owner-user-id')?.value || null;
    const name = document.getElementById('trivial-name').value.trim();
    const pin = document.getElementById('trivial-pin').value.trim();
    const language = document.getElementById('trivial-language')?.value || 'es';
    const outerCasillas = parseInt(document.getElementById('trivial-outer').value, 10);
    const visibleToPresenter = document.getElementById('trivial-visible').checked;
    const useStreaks = document.getElementById('trivial-use-streaks')?.checked ?? false;
    const streakThreshold = parseFloat(document.getElementById('trivial-streak-threshold')?.value) || 3;
    const streakBonusPercentage = parseFloat(document.getElementById('trivial-streak-bonus')?.value) ?? 0.5;
    const useDoubleStreaks = document.getElementById('trivial-use-double-streaks')?.checked ?? false;
    const doubleStreakThreshold = parseFloat(document.getElementById('trivial-double-threshold')?.value) || 5;
    const doubleStreakBonusPercentage = parseFloat(document.getElementById('trivial-double-bonus')?.value) ?? 1.0;
    const imageUrl = document.getElementById('trivial-image-url')?.value || null;
    const randomPoints = readRandomPointsConfig('trivial');
    const randomPointsCheck = validateRandomPointsConfig(randomPoints);
    if (!randomPointsCheck.valid) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), randomPointsCheck.message, 'warning');
    const catRows = document.querySelectorAll('.trivial-cat-row');
    const categories = Array.from(catRows).map((row, i) => {
        const source_type = row.querySelector('.cat-src-type').value || 'bank';
        const source_id = parseInt(row.querySelector('.cat-src-id').value, 10) || null;
        return {
            category_name: row.querySelector('.cat-name').value.trim(),
            color: row.querySelector('.cat-color').value,
            source_type,
            source_id,
            bank_id: source_type === 'bank' ? source_id : null,
            position: i
        };
    });
    if (!name || !pin || categories.length < 2) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.trivial.error_required', null, 'Nombre, PIN y al menos 2 categorías son obligatorios.'), 'warning');
    if (id && !canModifyOwnedResource(ownerUserId)) {
        showOwnershipDeniedModal('este trivial');
        return;
    }
    const missingSource = categories.findIndex(c => !c.source_id);
    if (missingSource !== -1) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.trivial.error_missing_source', { n: missingSource + 1 }, 'La categoría {n} no tiene banco, mezcla o personalizado seleccionado.'), 'warning');
    if (outerCasillas % categories.length !== 0) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.trivial.error_outer_mismatch', { outer: outerCasillas, n: categories.length }, 'Las casillas externas ({outer}) deben ser múltiplo de {n} categorías.'), 'warning');

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/trivial-games/${id}` : '/api/trivial-games';
    const res = await fetchWithAuth(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name, pin, language, outer_casillas: outerCasillas, visible_to_presenter: visibleToPresenter,
            use_streaks: useStreaks, streak_threshold: streakThreshold, streak_bonus_percentage: streakBonusPercentage,
            use_double_streaks: useDoubleStreaks, double_streak_threshold: doubleStreakThreshold, double_streak_bonus_percentage: doubleStreakBonusPercentage,
            image_url: imageUrl,
            ...randomPoints,
            categories
        })
    });
    const data = await res.json();
    if (!res.ok) return mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), data.error || _t('admin.trivial.error_save', null, 'Error al guardar'), 'error');
    markUnsavedChangesAsSaved();
    if (exit) {
        clearUnsavedChangesGuard();
        await renderVistaTrivial();
    } else {
        // Reload editor with saved data to refresh state
        const id2 = data.id || document.getElementById('trivial-id')?.value;
        if (id2) {
            const r2 = await fetchWithAuth(`/api/trivial-games/${id2}`);
            const d2 = await r2.json();
            await renderEditorTrivial(d2.game || d2, d2.categories || []);
        }
    }
}

async function borrarTrivial(id, event, ownerUserId = null) {
    event?.stopPropagation();
    if (!canModifyOwnedResource(ownerUserId)) {
        showOwnershipDeniedModal('este trivial');
        return;
    }

    mostrarModalConfirmacion(
        _t('admin.common.confirmation_title', null, '⚠️ Confirmación'),
        _t('admin.trivial.confirm_delete', null, '¿Eliminar este juego Trivial?'),
        async () => {
            await fetchWithAuth(`/api/trivial-games/${id}`, { method: 'DELETE' });
            await renderVistaTrivial();
        }
    );
}

function _initTrivialListDelegation() {
    if (_trivialListDelegationReady) return;
    _trivialListDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-trivial-list-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.trivialListAction;
        switch (action) {
            case 'new-trivial':
                prepararNuevoTrivial();
                break;
            case 'edit-trivial':
                if (actionElement.dataset.id) cargarEditorTrivial(parseInt(actionElement.dataset.id, 10));
                break;
            case 'delete-trivial': {
                if (!actionElement.dataset.id) break;
                const rawOwnerUserId = actionElement.dataset.ownerUserId;
                const parsedOwnerUserId = rawOwnerUserId ? parseInt(rawOwnerUserId, 10) : null;
                const ownerUserId = Number.isNaN(parsedOwnerUserId) ? null : parsedOwnerUserId;
                borrarTrivial(parseInt(actionElement.dataset.id, 10), event, ownerUserId);
                break;
            }
            case 'ownership-denied':
                showOwnershipDeniedModal('este trivial');
                break;
            default:
                break;
        }
    });
}

_initTrivialListDelegation();
