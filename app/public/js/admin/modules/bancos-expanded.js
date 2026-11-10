/**
 * @fileoverview Gestión completa de bancos de preguntas
 * Código extraído 1:1 del original admin.js
 */

// ===== VISTA PRINCIPAL: LISTADO DE BANCOS =====

function ocultarTodosBancos() {
    toggleAllVisibleToPresenter('/api/banks/visibility-all', false, renderVistaBancos);
}

function mostrarTodosBancos() {
    toggleAllVisibleToPresenter('/api/banks/visibility-all', true, renderVistaBancos);
}

async function renderVistaBancos() {
    clearUnsavedChangesGuard();
    activeView = 'bancos'; // También al volver del editor sin pasar por mostrarVista

    const res = await fetchWithAuth('/api/banks?includeCount=true');
    const bancos = await res.json();

    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        <div class="max-w-7xl mx-auto p-10">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
                        <div class="w-12 h-12 bg-plum-600 rounded-xl flex items-center justify-center">
                            <i class="fas fa-database text-white text-xl"></i>
                        </div>
                        ${_t('admin.banks.title', null, 'Bancos de Preguntas')}
                    </h1>
                    <p class="text-slate-500">${_t('admin.banks.subtitle', null, 'Gestiona tus colecciones de preguntas')}</p>
                </div>
                <div class="flex gap-3">
                    <button data-admin-click="ocultarTodosBancos()" title="${_t('admin.common.btn_hide_all_presenter', null, 'Ocultar todos estos juegos al presentador')}" aria-label="${_t('admin.common.btn_hide_all_presenter', null, 'Ocultar todos estos juegos al presentador')}"
                        class="w-14 h-14 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl transition flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-eye-slash text-lg"></i>
                    </button>
                    <button data-admin-click="mostrarTodosBancos()" title="${_t('admin.common.btn_show_all_presenter', null, 'Mostrar todos estos juegos al presentador')}" aria-label="${_t('admin.common.btn_show_all_presenter', null, 'Mostrar todos estos juegos al presentador')}"
                        class="w-14 h-14 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-xl transition flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-eye text-lg"></i>
                    </button>
                    <button data-admin-click="mostrarMezclarBancos()"
                        class="bg-aubergine-600 hover:bg-aubergine-700 text-white px-5 py-4 rounded-xl font-bold text-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-3">
                        <i class="fas fa-layer-group text-xl"></i>
                        ${_t('admin.banks.btn_merge', null, 'Mezclar Bancos')}
                    </button>
                    <button data-admin-click="prepararNuevoBanco()"
                        class="bg-camaleon-600 hover:bg-camaleon-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-3">
                        <i class="fas fa-plus-circle text-xl"></i>
                        ${_t('admin.banks.btn_add', null, 'Añadir Nuevo Banco')}
                    </button>
                </div>
            </div>

            ${
    bancos.length === 0
        ? `
                <div class="text-center py-20">
                    <i class="fas fa-inbox text-slate-300 text-6xl mb-4"></i>
                    <p class="text-slate-400 text-xl">${_t('admin.banks.empty_title', null, 'No hay bancos de preguntas todavía')}</p>
                    <p class="text-slate-400 mt-2">${_t('admin.banks.empty_msg', null, 'Crea tu primer banco para comenzar')}</p>
                </div>
            `
        : `
                ${htmlBuscadorLista('bancos')}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${bancos
        .map(banco => {
            const ownerInfo = {
                created_by_role: banco.created_by_role,
                created_by_user_id: banco.created_by_user_id,
                created_by_username: banco.created_by_username
            };
            const canModify = canModifyOwnedResource(ownerInfo);
            const editClasses = canModify
                ? 'flex-1 btn-edit px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2'
                : `flex-1 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 ${getLockedButtonClasses()}`;

            return `
                        <div ${atributoBusquedaLista(banco)} class="bg-white rounded-2xl shadow-sm border-2 border-slate-200 hover:border-plum-500 transition hover:shadow-xl group overflow-hidden">
                            <div class="p-6">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex-1">
                                        <h3 class="text-lg font-bold text-slate-900 mb-2 line-clamp-2">${escapeHtml(banco.name)}</h3>
                                        <p class="text-sm text-slate-600 mb-2">${_t('admin.banks.question_count', { n: banco.question_count ?? 0 }, 'Preguntas: {n}')}</p>
                                        ${getOwnerBadgeHtml(ownerInfo)}
                                        ${
    banco.pin
        ? `<div class="inline-flex items-center gap-2 bg-plum-100 text-plum-700 px-3 py-1 rounded-lg text-xs font-mono font-bold">
                                            <i class="fas fa-key"></i>
                                            PIN: ${banco.pin}
                                        </div>`
        : ''
}
                                    </div>
                                </div>
                                
                                <div class="flex gap-2 mt-4">
                                    <button data-admin-action="${canModify ? 'edit-bank' : 'ownership-denied'}" data-bank-id="${banco.id}" data-resource-label="este banco"
                                        class="${editClasses}" ${canModify ? '' : 'title="Bloqueado: creado por otro usuario"'}>
                                        <i class="fas fa-edit"></i>
                                        ${_t('admin.banks.btn_edit', null, 'Editar')}
                                    </button>
                                    <button data-admin-action="${canModify ? 'delete-bank' : 'ownership-denied'}" data-bank-id="${banco.id}" data-owner-user-id="${banco.created_by_user_id ?? ''}" data-resource-label="este banco"
                                        aria-label="${escapeHtml(_t('admin.banks.delete_aria', { name: banco.name }, 'Eliminar el banco «{name}»'))}"
                                        class="${canModify ? 'bg-red-50 hover:bg-red-100 text-red-600 w-12 h-12 rounded-xl font-bold transition flex items-center justify-center' : `w-12 h-12 rounded-xl font-bold transition flex items-center justify-center ${getLockedButtonClasses()}`}" ${canModify ? '' : 'title="Bloqueado: creado por otro usuario"'}>
                                        <i class="fas fa-trash" aria-hidden="true"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
        })
        .join('')}
                </div>
            `
}
        </div>
    `);
    filtrarTarjetasLista('bancos');
}

// ===== PREPARAR NUEVO BANCO =====

function prepararNuevoBanco() {
    preguntasData = [];
    activeView = null; // Salir de la vista de grid
    renderEditorBanco({ name: '', id: null });
    dibujarPreguntas();
    _bindBankSaveBar(null);
}

// ===== CARGAR EDITOR DE BANCO =====

async function cargarEditorBanco(id) {
    activeView = null; // Salir de la vista de grid
    const res = await fetchWithAuth(`/api/banks/${id}`);
    const data = await res.json();

    if (!canModifyOwnedResource(data?.bank)) {
        showOwnershipDeniedModal('este banco');
        await renderVistaBancos();
        return;
    }

    preguntasData = data.questions.map(mapBankQuestionFromApi);
    collapseQuestionsOnLoad();
    renderEditorBanco(data.bank);
    dibujarPreguntas();
    _bindBankSaveBar(data.bank.id);
}

// ===== RENDERIZAR EDITOR =====

function renderEditorBanco(bank) {
    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        ${renderEditorHeader(_bankHeaderConfig(bank))}

        <div class="xiro-editor-body xq-editor">

            <div id="contenedorPreguntas" class="pb-10">
                ${bankQuestionsToolbarHtml()}
                <div id="listaPreguntasDOM" class="xq-list"></div>
                ${bankQuestionsFooterHtml()}

                ${
    bank.id
        ? `
                <div class="mt-4">
                    <button data-admin-click="exportarBanco()" class="bg-plum-50 text-plum-700 border-2 border-plum-200 px-6 py-3 rounded-lg font-bold hover:bg-plum-100 hover:border-plum-300 transition w-full flex items-center justify-center gap-3">
                        <i class="fas fa-file-export text-lg" aria-hidden="true"></i> ${_t('admin.banks.btn_export', null, 'Exportar banco')}
                    </button>
                </div>
                `
        : ''
}
                ${renderSaveBar(_t('admin.savebar.btn_save_changes'))}
            </div>
        </div>`);
}

/** Cabecera compacta del editor de banco (editor-header.js), con los ids de siempre. */
function _bankHeaderConfig(bank) {
    return {
        entity: bank,
        accent: 'plum',
        // Los ajustes del banco no hacen falta para empezar: primero, las preguntas
        settingsOpen: false,
        icon: 'fa-database',
        kind: _t('admin.banks.form_title', null, 'Banco de Preguntas'),
        hiddenHtml: `<input type="hidden" id="editId" value="${bank.id || ''}">
                <input type="hidden" id="editOwnerUserId" value="${bank.created_by_user_id ?? ''}">`,
        back: { action: "mostrarVista('bancos')", label: _t('admin.banks.btn_back', null, 'Volver a Bancos de Preguntas') },
        name: { id: 'editName', label: _t('admin.banks.label_name', null, 'Nombre del Banco'), placeholder: _t('admin.banks.ph_name', null, 'Ej: Historia del Arte') },
        pin: {
            id: 'editBankPin',
            label: _t('admin.banks.label_pin', null, 'PIN del Banco (opcional)'),
            placeholder: _t('admin.editor.ph_pin_auto', null, 'Automático'),
            help: _t('admin.banks.help_pin', null, 'Si lo dejas vacío, se generará automáticamente un PIN de 6 dígitos'),
            maxlength: 10
        },
        visible: {
            id: 'editBankVisibleToPresenter',
            label: _t('admin.banks.label_visible', null, 'Mostrar al presentador'),
            help: _t('admin.banks.help_visible', null, 'Si está marcado, el presentador podrá ver y usar este banco')
        },
        languageId: 'editBankLanguage',
        coverKind: 'bank',
        randomPrefix: 'bank',
        streaks: {
            keys: 'admin.banks',
            toggle: 'editBankUseStreaks',
            panel: 'bankStreakConfigPanel',
            threshold: 'editBankStreakThreshold',
            bonus: 'editBankStreakBonusPercentage',
            onToggle: 'toggleBankStreakConfig()'
        },
        doubleStreaks: {
            keys: 'admin.banks',
            toggle: 'editBankUseDoubleStreaks',
            panel: 'bankDoubleStreakConfigPanel',
            threshold: 'editBankDoubleStreakThreshold',
            bonus: 'editBankDoubleStreakBonusPercentage',
            onToggle: 'toggleBankDoubleStreakConfig()'
        }
    };
}

/** Conecta la barra de guardado una vez pintadas las preguntas (id null = banco nuevo). */
function _bindBankSaveBar(id) {
    bindSaveBar({
        guard: 'bancos',
        root: 'editorArea',
        cleanText: id ? null : _t('admin.savebar.new_item'),
        save: guardarBanco,
        discard: () => (id ? cargarEditorBanco(id) : prepararNuevoBanco()),
        snapshot: _bankEditorSnapshot
    });
}

/** Estado del editor de banco para detectar cambios sin guardar. */
function _bankEditorSnapshot() {
    return {
        id: document.getElementById('editId')?.value || '',
        name: document.getElementById('editName')?.value || '',
        pin: document.getElementById('editBankPin')?.value || '',
        language: document.getElementById('editBankLanguage')?.value || 'es',
        visible_to_presenter: document.getElementById('editBankVisibleToPresenter')?.checked ?? true,
        use_streaks: document.getElementById('editBankUseStreaks')?.checked ?? false,
        streak_threshold: document.getElementById('editBankStreakThreshold')?.value || '3',
        streak_bonus_percentage: document.getElementById('editBankStreakBonusPercentage')?.value || '0.50',
        use_double_streaks: document.getElementById('editBankUseDoubleStreaks')?.checked ?? false,
        double_streak_threshold: document.getElementById('editBankDoubleStreakThreshold')?.value || '5',
        double_streak_bonus_percentage: document.getElementById('editBankDoubleStreakBonusPercentage')?.value || '1.00',
        image_url: document.getElementById('editBankImageUrl')?.value || '',
        ...snapshotRandomPoints('bank'),
        preguntas: preguntasData
    };
}

// ===== CONFIGURACIÓN RACHAS BANCO =====

function toggleBankStreakConfig() {
    const panel = document.getElementById('bankStreakConfigPanel');
    const checked = document.getElementById('editBankUseStreaks').checked;
    if (panel) panel.classList.toggle('hidden', !checked);
}

function toggleBankDoubleStreakConfig() {
    const panel = document.getElementById('bankDoubleStreakConfigPanel');
    const checked = document.getElementById('editBankUseDoubleStreaks').checked;
    if (panel) panel.classList.toggle('hidden', !checked);
}

// ===== ELIMINAR BANCO =====

function borrarBanco(id, e, ownerUserId = null) {
    e.stopPropagation();
    if (!canModifyOwnedResource(ownerUserId)) {
        showOwnershipDeniedModal('este banco');
        return;
    }

    mostrarModalConfirmacion(
        _t('admin.common.confirmation_title', null, '⚠️ Confirmación'),
        _t('admin.banks.confirm_delete', null, '¿Deseas eliminar este banco para siempre?'),
        async () => {
            try {
                const res = await fetchWithAuth(`/api/banks/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    renderVistaBancos();
                } else {
                    const err = await res.json();
                    mostrarModalError(
                        _t('admin.common.error_title', null, '❌ Error'),
                        err.message ||
                            err.error ||
                            _t('admin.banks.error_delete', null, 'No se pudo eliminar el banco'),
                        'error'
                    );
                }
            } catch {
                mostrarModalError(
                    _t('admin.common.error_title', null, '❌ Error'),
                    _t('admin.common.error_server', null, 'Error de conexión con el servidor'),
                    'error'
                );
            }
        },
        null,
        _t('admin.common.delete', null, 'Eliminar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}
