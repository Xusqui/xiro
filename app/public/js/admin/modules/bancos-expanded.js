/**
 * @fileoverview Gestión completa de bancos de preguntas
 * Código extraído 1:1 del original admin.js
 */

// ===== VISTA PRINCIPAL: LISTADO DE BANCOS =====

async function renderVistaBancos() {
    clearUnsavedChangesGuard();

    const res = await fetchWithAuth('/api/banks');
    const bancos = await res.json();

    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        <div class="max-w-7xl mx-auto p-10">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
                        <div class="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                            <i class="fas fa-database text-white text-xl"></i>
                        </div>
                        ${_t('admin.banks.title', null, 'Bancos de Preguntas')}
                    </h1>
                    <p class="text-slate-500">${_t('admin.banks.subtitle', null, 'Gestiona tus colecciones de preguntas')}</p>
                </div>
                <div class="flex gap-3">
                    <button data-admin-click="mostrarMezclarBancos()"
                        class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-4 rounded-xl font-bold text-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-3">
                        <i class="fas fa-layer-group text-xl"></i>
                        ${_t('admin.banks.btn_merge', null, 'Mezclar Bancos')}
                    </button>
                    <button data-admin-click="prepararNuevoBanco()"
                        class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-3">
                        <i class="fas fa-plus-circle text-xl"></i>
                        ${_t('admin.banks.btn_add', null, 'Añadir Nuevo Banco')}
                    </button>
                </div>
            </div>

            ${bancos.length === 0 ? `
                <div class="text-center py-20">
                    <i class="fas fa-inbox text-slate-300 text-6xl mb-4"></i>
                    <p class="text-slate-400 text-xl">${_t('admin.banks.empty_title', null, 'No hay bancos de preguntas todavía')}</p>
                    <p class="text-slate-400 mt-2">${_t('admin.banks.empty_msg', null, 'Crea tu primer banco para comenzar')}</p>
                </div>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${bancos.map(banco => {
        const ownerInfo = {
            created_by_role: banco.created_by_role,
            created_by_user_id: banco.created_by_user_id,
            created_by_username: banco.created_by_username
        };
        const canModify = canModifyOwnedResource(ownerInfo);
        const editClasses = canModify
            ? 'flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2'
            : `flex-1 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 ${getLockedButtonClasses()}`;

        return `
                        <div class="bg-white rounded-2xl shadow-sm border-2 border-slate-200 hover:border-purple-500 transition-all hover:shadow-xl group overflow-hidden">
                            <div class="p-6">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex-1">
                                        <h3 class="text-lg font-bold text-slate-900 mb-2 line-clamp-2">${banco.name}</h3>
                                        ${getOwnerBadgeHtml(ownerInfo)}
                                        ${banco.pin ? `<div class="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-xs font-mono font-bold">
                                            <i class="fas fa-key"></i>
                                            PIN: ${banco.pin}
                                        </div>` : ''}
                                    </div>
                                </div>
                                
                                <div class="flex gap-2 mt-4">
                                    <button data-admin-action="${canModify ? 'edit-bank' : 'ownership-denied'}" data-bank-id="${banco.id}" data-resource-label="este banco"
                                        class="${editClasses}" ${canModify ? '' : 'title="Bloqueado: creado por otro usuario"'}>
                                        <i class="fas fa-edit"></i>
                                        ${_t('admin.banks.btn_edit', null, 'Editar')}
                                    </button>
                                    <button data-admin-action="${canModify ? 'delete-bank' : 'ownership-denied'}" data-bank-id="${banco.id}" data-owner-user-id="${banco.created_by_user_id ?? ''}" data-resource-label="este banco" 
                                        class="${canModify ? 'bg-red-50 hover:bg-red-100 text-red-600 w-12 h-12 rounded-xl font-bold transition flex items-center justify-center' : `w-12 h-12 rounded-xl font-bold transition flex items-center justify-center ${getLockedButtonClasses()}`}" ${canModify ? '' : 'title="Bloqueado: creado por otro usuario"'}>
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
    }).join('')}
                </div>
            `}
        </div>
    `);
}

// ===== PREPARAR NUEVO BANCO =====

function prepararNuevoBanco() {
    preguntasData = [];
    activeView = null; // Salir de la vista de grid
    renderEditorBanco({ name: '', id: null });
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

    preguntasData = data.questions.map(q => {
        const correct = q.options?.find(o => !!o.is_correct);
        const questionType = q.question_type || 'quiz';
        const options = (q.options || []).map(o => ({
            optionText: o.option_text,
            isCorrect: !!o.is_correct,
            order_index: o.order_index ?? o.orderIndex ?? null,
            justification: o.justification || null,
            match_value: o.match_value ?? null,
            option_image_url: o.option_image_url ?? null
        }));

        if (questionType === 'order' || questionType === 'matching') {
            options.sort((a, b) => {
                const aIndex = Number.isInteger(a.order_index) ? a.order_index : 0;
                const bIndex = Number.isInteger(b.order_index) ? b.order_index : 0;
                return aIndex - bIndex;
            });
        }

        const orderJustification = questionType === 'order'
            ? (options.find(opt => opt.justification)?.justification || '')
            : '';

        return {
            id: q.id,
            questionText: q.question_text,
            justification: questionType === 'order'
                ? orderJustification
                : (correct?.justification || ''),
            type: questionType,
            tipo_contenido: q.tipo_contenido || 'texto',
            url_recurso: q.url_recurso || null,
            question_image_url: q.question_image_url || null,
            time_limit: q.time_limit || 20,
            options,
            correctAnswer: questionType === 'numeric_approximation'
                ? (q.correct_answer ?? null)
                : null,
            correctWord: questionType === 'word_scramble'
                ? (q.correct_word || '')
                : null,
            maxPoints: questionType === 'numeric_approximation'
                ? (q.max_points ?? null)
                : null,
            toleranceMode: questionType === 'numeric_approximation'
                ? (q.tolerance_mode || 'hybrid')
                : null,
            toleranceValue: questionType === 'numeric_approximation'
                ? (q.tolerance_value ?? 25)
                : null,
            toleranceCap: questionType === 'numeric_approximation'
                ? (q.tolerance_cap ?? 1000)
                : null,
            hint: q.hint_text || '',
            mcPointsPerCorrect: questionType === 'multiple_choice'
                ? (q.mc_points_per_correct ?? 10)
                : null,
            mcPenaltyPerIncorrect: questionType === 'multiple_choice'
                ? (q.mc_penalty_per_incorrect ?? 10)
                : null,
            mcPerfectBonus: questionType === 'multiple_choice'
                ? (q.mc_perfect_bonus ?? 20)
                : null
        };
    });
    renderEditorBanco(data.bank);
    dibujarPreguntas();
}

// ===== RENDERIZAR EDITOR =====

function renderEditorBanco(bank) {
    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        <div class="max-w-4xl mx-auto p-10">
            <!-- Botón volver -->
            <button data-admin-click="mostrarVista('bancos')"
                class="mb-6 text-slate-600 hover:text-purple-600 font-bold flex items-center gap-2 transition">
                <i class="fas fa-arrow-left"></i>
                ${_t('admin.banks.btn_back', null, 'Volver a Bancos de Preguntas')}
            </button>

            <div class="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-slate-200">
                <input type="hidden" id="editId" value="${bank.id || ''}">
                <input type="hidden" id="editOwnerUserId" value="${bank.created_by_user_id ?? ''}">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-black text-slate-900 italic uppercase">
                        <i class="fas fa-database text-purple-500 mr-2"></i>${_t('admin.banks.form_title', null, 'Banco de Preguntas')}
                    </h2>
                    ${bank.id ? `<span class="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">ID: ${bank.id}</span>` : ''}
                </div>
                <div>
                    <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">${_t('admin.banks.label_name', null, 'Nombre del Banco')}</label>
                    <input type="text" id="editName" value="${bank.name}" class="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-purple-500 outline-none transition shadow-sm" placeholder="${_t('admin.banks.ph_name', null, 'Ej: Historia del Arte')}">
                </div>
                <div class="mt-4">
                    <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">${_t('admin.banks.label_pin', null, 'PIN del Banco (opcional)')}</label>
                    <input type="text" id="editBankPin" value="${bank.pin || ''}" maxlength="10" class="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-purple-500 outline-none transition shadow-sm" placeholder="${_t('admin.banks.ph_pin', null, 'Ej: HISTORIA2025')}">
                    <p class="text-slate-400 text-xs mt-1"><i class="fas fa-info-circle mr-1"></i>${_t('admin.banks.help_pin', null, 'Si lo dejas vacío, se generará automáticamente un PIN de 6 dígitos')}</p>
                </div>
                <div class="mt-4">
                    <label class="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" id="editBankVisibleToPresenter" ${bank.visible_to_presenter !== false ? 'checked' : ''} class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500">
                        <span class="text-sm font-bold text-slate-700">
                            <i class="fas fa-eye mr-2"></i>${_t('admin.banks.label_visible', null, 'Mostrar al presentador')}
                        </span>
                    </label>
                    <p class="text-slate-400 text-xs mt-1 ml-8">${_t('admin.banks.help_visible', null, 'Si está marcado, el presentador podrá ver y usar este banco')}</p>
                </div>
            </div>

            <!-- Configuración del banco -->
            <div class="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-slate-200">
                <h3 class="text-lg font-black text-slate-800 uppercase tracking-tight mb-6">
                    <i class="fas fa-cog text-purple-500 mr-2"></i>${_t('admin.banks.section_config', null, 'Configuración del banco')}
                </h3>

                <!-- Rachas -->
                <div class="flex items-center justify-between mb-2">
                    <div>
                        <span class="text-sm font-bold text-slate-700"><i class="fas fa-fire text-orange-500 mr-2"></i>${_t('admin.banks.label_streaks', null, 'Activar Rachas')}</span>
                        <p class="text-slate-400 text-xs mt-0.5">${_t('admin.banks.help_streaks', null, 'Bonus de puntos por respuestas correctas consecutivas')}</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="editBankUseStreaks" ${bank.use_streaks ? 'checked' : ''} data-admin-change="toggleBankStreakConfig()" class="sr-only peer">
                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>
                <div id="bankStreakConfigPanel" class="${bank.use_streaks ? '' : 'hidden'} mt-3 ml-4 p-4 bg-purple-50 rounded-xl border border-purple-100 grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.banks.streak_threshold_label', null, 'Umbral de racha')}</label>
                        <input type="number" id="editBankStreakThreshold" value="${bank.streak_threshold ?? 3}" min="1" max="20" class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-purple-500 outline-none text-sm">
                        <p class="text-slate-400 text-xs mt-1">${_t('admin.banks.streak_threshold_help', null, 'Respuestas consecutivas para activar bonus')}</p>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.banks.streak_bonus_label', null, 'Bonus (%)')}</label>
                        <input type="number" id="editBankStreakBonusPercentage" value="${bank.streak_bonus_percentage ?? 0.50}" min="0" max="2" step="0.05" class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-purple-500 outline-none text-sm">
                        <p class="text-slate-400 text-xs mt-1">${_t('admin.banks.streak_bonus_help', null, 'Multiplicador de puntos (0.5 = +50%)')}</p>
                    </div>
                </div>

                <!-- Dobles Rachas -->
                <div class="flex items-center justify-between mt-6 mb-2">
                    <div>
                        <span class="text-sm font-bold text-slate-700"><i class="fas fa-fire-alt text-red-500 mr-2"></i>${_t('admin.banks.label_dbl_streaks', null, 'Activar Dobles Rachas')}</span>
                        <p class="text-slate-400 text-xs mt-0.5">${_t('admin.banks.help_dbl_streaks', null, 'Bonus adicional por rachas más largas')}</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="editBankUseDoubleStreaks" ${bank.use_double_streaks ? 'checked' : ''} data-admin-change="toggleBankDoubleStreakConfig()" class="sr-only peer">
                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>
                <div id="bankDoubleStreakConfigPanel" class="${bank.use_double_streaks ? '' : 'hidden'} mt-3 ml-4 p-4 bg-purple-50 rounded-xl border border-purple-100 grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.banks.dbl_threshold_label', null, 'Umbral doble racha')}</label>
                        <input type="number" id="editBankDoubleStreakThreshold" value="${bank.double_streak_threshold ?? 5}" min="1" max="20" class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-purple-500 outline-none text-sm">
                        <p class="text-slate-400 text-xs mt-1">${_t('admin.banks.dbl_threshold_help', null, 'Respuestas consecutivas para el bonus doble')}</p>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.banks.dbl_bonus_label', null, 'Bonus doble (%)')}</label>
                        <input type="number" id="editBankDoubleStreakBonusPercentage" value="${bank.double_streak_bonus_percentage ?? 1.00}" min="0" max="2" step="0.05" class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-purple-500 outline-none text-sm">
                        <p class="text-slate-400 text-xs mt-1">${_t('admin.banks.dbl_bonus_help', null, 'Multiplicador de puntos (1.0 = +100%)')}</p>
                    </div>
                </div>
            </div>

            <div id="contenedorPreguntas" class="space-y-6 pb-10">
                <div class="flex justify-between items-center px-2">
                    <h3 class="text-xl font-black text-slate-700 uppercase tracking-tighter text-2xl">${_t('admin.banks.title', null, 'Bancos de Preguntas')}</h3>
                    <button data-admin-click="añadirPregunta()" class="bg-slate-800 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 shadow-md transition transform active:scale-95">
                        <i class="fas fa-plus mr-2"></i> ${_t('admin.q.btn_add', null, 'Añadir Pregunta')}
                    </button>
                </div>

                <div id="listaPreguntasDOM" class="space-y-4"></div>

                <div class="flex justify-between items-center px-2">
                    <h3 class="text-xl font-black text-slate-700 uppercase tracking-tighter text-2xl">${_t('admin.q.label_end', null, 'Fin Preguntas')}</h3>
                    <button data-admin-click="añadirPregunta()" class="bg-slate-800 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 shadow-md transition transform active:scale-95">
                        <i class="fas fa-plus mr-2"></i> ${_t('admin.q.btn_add', null, 'Añadir Pregunta')}
                    </button>
                </div>

                <div class="mt-12 pt-8 border-t border-slate-200">
                    <div class="grid grid-cols-2 gap-4">
                        <button data-admin-click="guardarBanco(false)" class="bg-purple-600 text-white px-6 py-5 rounded-2xl font-black text-lg hover:bg-purple-700 transition shadow-xl shadow-purple-200 flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95">
                            <i class="fas fa-save text-xl"></i> ${_t('admin.banks.btn_save', null, 'GUARDAR BANCO')}
                        </button>
                        <button data-admin-click="guardarBanco(true)" class="bg-green-600 text-white px-6 py-5 rounded-2xl font-black text-lg hover:bg-green-700 transition shadow-xl shadow-green-200 flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95">
                            <i class="fas fa-cloud-upload-alt text-xl"></i> ${_t('admin.banks.btn_save_exit', null, 'GUARDAR Y SALIR')}
                        </button>
                    </div>
                    <p class="text-center text-slate-400 text-xs mt-3">
                        <i class="fas fa-info-circle mr-1"></i>${_t('admin.banks.help_save', null, '"Guardar" mantiene el editor abierto, "Guardar y salir" vuelve a la lista de bancos')}
                    </p>
                </div>
                ${bank.id ? `
                <div class="mt-4">
                    <button data-admin-click="exportarBanco()" class="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-700 transition w-full shadow-md flex items-center justify-center gap-3">
                        <i class="fas fa-file-export text-lg"></i> Exportar Banco
                    </button>
                </div>
                ` : ''}
            </div>
        </div>`);

    setUnsavedChangesGuard('bancos', () => ({
        id: document.getElementById('editId')?.value || '',
        name: document.getElementById('editName')?.value || '',
        pin: document.getElementById('editBankPin')?.value || '',
        visible_to_presenter: document.getElementById('editBankVisibleToPresenter')?.checked ?? true,
        use_streaks: document.getElementById('editBankUseStreaks')?.checked ?? false,
        streak_threshold: document.getElementById('editBankStreakThreshold')?.value || '3',
        streak_bonus_percentage: document.getElementById('editBankStreakBonusPercentage')?.value || '0.50',
        use_double_streaks: document.getElementById('editBankUseDoubleStreaks')?.checked ?? false,
        double_streak_threshold: document.getElementById('editBankDoubleStreakThreshold')?.value || '5',
        double_streak_bonus_percentage: document.getElementById('editBankDoubleStreakBonusPercentage')?.value || '1.00',
        preguntas: preguntasData
    }));
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

// ===== EXPORTAR BANCO =====

// Exportar el banco actualmente en edición al formato de la base de datos
function exportarBanco() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value || 'banco';

    if (!id) return mostrarModalError(_t('admin.common.warning_title', null, '⚠️ Advertencia'), _t('admin.banks.error_export_saved', null, 'Sólo se puede exportar un banco guardado previamente'), 'warning');
    if (!preguntasData || preguntasData.length === 0) return mostrarModalError(_t('admin.common.warning_title', null, '⚠️ Advertencia'), _t('admin.banks.error_export_empty', null, 'El banco no tiene preguntas para exportar'), 'warning');

    const preguntasValidas = preguntasData.filter(q => ((q.questionText || q.question_text || '').trim() !== ''));

    const payload = {
        name: name,
        type: 'quiz',
        questions: preguntasValidas.map(q => mapQuestionForExport(q))
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = name.replace(/[^a-z0-9\-_\.]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ===== GUARDAR BANCO =====

async function guardarBanco(salir = true) {
    const id = document.getElementById('editId').value;
    const ownerUserId = document.getElementById('editOwnerUserId')?.value || null;
    const name = document.getElementById('editName').value;
    const pin = document.getElementById('editBankPin').value.trim();
    const visibleToPresenter = document.getElementById('editBankVisibleToPresenter').checked;
    const useStreaks = document.getElementById('editBankUseStreaks')?.checked ?? false;
    const streakThreshold = parseInt(document.getElementById('editBankStreakThreshold')?.value || '3', 10);
    const streakBonusPercentage = parseFloat(document.getElementById('editBankStreakBonusPercentage')?.value || '0.50');
    const useDoubleStreaks = document.getElementById('editBankUseDoubleStreaks')?.checked ?? false;
    const doubleStreakThreshold = parseInt(document.getElementById('editBankDoubleStreakThreshold')?.value || '5', 10);
    const doubleStreakBonusPercentage = parseFloat(document.getElementById('editBankDoubleStreakBonusPercentage')?.value || '1.00');

    if (!name) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.banks.error_name', null, 'Por favor, ponle un nombre al banco'), 'warning');
    if (preguntasData.length === 0) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.banks.error_questions', null, 'Añade al menos una pregunta'), 'warning');
    if (id && !canModifyOwnedResource(ownerUserId)) {
        showOwnershipDeniedModal('este banco');
        return;
    }

    const preguntasValidas = preguntasData.filter(q => {
        const texto = q.questionText || q.question_text || q.text || '';
        return texto.trim() !== '';
    });

    const payload = {
        id: id ? parseInt(id, 10) : null,
        name,
        pin: pin || null,
        visible_to_presenter: visibleToPresenter,
        use_streaks: useStreaks,
        streak_threshold: streakThreshold,
        streak_bonus_percentage: streakBonusPercentage,
        use_double_streaks: useDoubleStreaks,
        double_streak_threshold: doubleStreakThreshold,
        double_streak_bonus_percentage: doubleStreakBonusPercentage,
        questions: preguntasValidas.map(q => ({
            id: q.id || null,
            questionText: q.questionText || q.question_text || q.text,
            type: q.type || 'quiz',
            tipo_contenido: q.tipo_contenido || 'texto',
            url_recurso: q.url_recurso || null,
            question_image_url: q.question_image_url || null,
            time_limit: Number(q.time_limit) || 20,
            justification: q.justification || null,
            correctAnswer: q.type === 'numeric_approximation' ? q.correctAnswer : null,
            correctWord: q.type === 'word_scramble' ? (q.correctWord || null) : null,
            maxPoints: q.type === 'numeric_approximation' ? q.maxPoints : null,
            toleranceMode: q.type === 'numeric_approximation' ? (q.toleranceMode || 'hybrid') : null,
            toleranceValue: q.type === 'numeric_approximation' ? (Number(q.toleranceValue) || 25) : null,
            toleranceCap: q.type === 'numeric_approximation'
                ? (q.toleranceCap === null || q.toleranceCap === '' ? null : Number(q.toleranceCap))
                : null,
            hint: q.type === 'numeric_approximation' ? (q.hint || null) : null,
            mc_points_per_correct: q.type === 'multiple_choice' ? (Number(q.mc_points_per_correct) || 10) : null,
            mc_penalty_per_incorrect: q.type === 'multiple_choice' ? (Number(q.mc_penalty_per_incorrect) || 10) : null,
            mc_perfect_bonus: q.type === 'multiple_choice' ? (Number(q.mc_perfect_bonus) || 20) : null,
            options: (q.type === 'numeric_approximation' || q.type === 'word_scramble') ? [] : q.options.map((opt, index) => ({
                optionText: opt.optionText || opt.text,
                isCorrect: (q.type === 'quiz' || q.type === 'multiple_choice') ? !!opt.isCorrect : false,
                order_index: (q.type === 'order' || q.type === 'matching') ? index : (opt.order_index ?? opt.orderIndex ?? null),
                match_value: q.type === 'matching' ? (opt.match_value ?? null) : null,
                justification: q.type === 'order'
                    ? (opt.justification || null)
                    : (opt.isCorrect ? (opt.justification || q.justification || null) : null),
                option_image_url: opt.option_image_url ?? null
            }))
        }))
    };

    try {
        const res = await fetchWithAuth('/api/banks/save-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            markUnsavedChangesAsSaved();
            mostrarModalError(_t('admin.common.success_title', null, '✅ Éxito'), _t('admin.banks.success_saved', null, '¡Banco guardado correctamente!'), 'success');

            setTimeout(() => {
                if (salir) {
                    // Volver a la vista de bancos
                    mostrarVista('bancos');
                } else {
                    // Si es un banco nuevo, actualizar el ID en el formulario
                    if (!id && data.id) {
                        document.getElementById('editId').value = data.id;
                        // Recargar el banco completo para actualizar los IDs de las preguntas
                        cargarEditorBanco(data.id);
                    }
                    // Si ya existía, solo mantener el editor abierto
                }
            }, 1500);
        } else {
            const err = await res.json();
            const mensaje = err.message || err.error || 'Error desconocido';
            mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), mensaje, 'error');
        }
    } catch (error) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión con el servidor'), 'error');
    }
}

// ===== ELIMINAR BANCO =====

async function borrarBanco(id, e, ownerUserId = null) {
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
                    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), err.message || err.error || _t('admin.banks.error_delete', null, 'No se pudo eliminar el banco'), 'error');
                }
            } catch {
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión con el servidor'), 'error');
            }
        },
        null,
        _t('admin.common.delete', null, 'Eliminar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

// ===== FUNCIONES COMPARTIDAS PARA PREGUNTAS =====
function añadirPregunta() {
    preguntasData.push({
        questionText: '',
        justification: '',
        type: 'quiz',
        tipo_contenido: 'texto',
        url_recurso: null,
        question_image_url: null,
        time_limit: 30,
        options: [
            { optionText: '', isCorrect: true, order_index: 0, option_image_url: null },
            { optionText: '', isCorrect: false, order_index: 1, option_image_url: null }
        ],
        correctAnswer: null,
        correctWord: null,
        maxPoints: null,
        toleranceMode: 'hybrid',
        toleranceValue: 25,
        toleranceCap: 1000,
        hint: ''
    });
    dibujarPreguntas();
}

function marcarCorrecta(qIdx, oIdx) {
    preguntasData[qIdx].options.forEach((opt, i) => opt.isCorrect = (i === oIdx));
    dibujarPreguntas();
}

function marcarCorrectaMultiple(qIdx, oIdx) {
    preguntasData[qIdx].options[oIdx].isCorrect = !preguntasData[qIdx].options[oIdx].isCorrect;
    dibujarPreguntas();
}

function añadirOpcion(qIdx) {
    const question = preguntasData[qIdx];
    const orderIndex = Array.isArray(question?.options) ? question.options.length : 0;
    question.options.push({ optionText: '', isCorrect: false, order_index: orderIndex, option_image_url: null });
    dibujarPreguntas();
}
function eliminarOpcion(qIdx, oIdx) { preguntasData[qIdx].options.splice(oIdx, 1); dibujarPreguntas(); }
function eliminarPregunta(idx) { preguntasData.splice(idx, 1); dibujarPreguntas(); }
