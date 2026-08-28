/**
 * @fileoverview Gestión completa de juegos (mezcla de bancos)
 * Código extraído 1:1 del original admin.js
 */

// ===== VISTA PRINCIPAL: LISTADO DE JUEGOS =====

async function renderVistaJuegos() {
    clearUnsavedChangesGuard();

    const res = await fetchWithAuth('/api/games');
    const juegos = await res.json();

    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        <div class="max-w-7xl mx-auto p-10">
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
                        <div class="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                            <i class="fas fa-gamepad text-white text-xl"></i>
                        </div>
                        ${_t('admin.games.title', null, 'Mezcla de Preguntas (Juegos)')}
                    </h1>
                    <p class="text-slate-500">${_t('admin.games.subtitle', null, 'Combina varios bancos en un solo juego')}</p>
                </div>
                <button data-admin-click="prepararNuevoJuego()"
                    class="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-3">
                    <i class="fas fa-plus-circle text-xl"></i>
                    ${_t('admin.games.btn_add', null, 'Añadir Nuevo Juego')}
                </button>
            </div>

            ${juegos.length === 0 ? `
                <div class="text-center py-20">
                    <i class="fas fa-inbox text-slate-300 text-6xl mb-4"></i>
                    <p class="text-slate-400 text-xl">${_t('admin.games.empty_title', null, 'No hay juegos creados todavía')}</p>
                    <p class="text-slate-400 mt-2">${_t('admin.games.empty_msg', null, 'Crea tu primer juego mezclando bancos')}</p>
                </div>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${juegos.map(juego => {
        const ownerInfo = {
            created_by_role: juego.created_by_role,
            created_by_user_id: juego.created_by_user_id,
            created_by_username: juego.created_by_username
        };
        const canModify = canModifyOwnedResource(ownerInfo);
        const editClasses = canModify
            ? 'flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2'
            : `flex-1 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 ${getLockedButtonClasses()}`;
        const validBanks = juego.banks.filter(b => b.bank_id !== null);
        return `
                            <div class="bg-white rounded-2xl shadow-sm border-2 border-slate-200 hover:border-green-500 transition-all hover:shadow-xl group overflow-hidden">
                                <div class="p-6">
                                    <div class="flex justify-between items-start mb-4">
                                        <div class="flex-1">
                                            <h3 class="text-lg font-bold text-slate-900 mb-2 line-clamp-2">${juego.name}</h3>
                                            ${getOwnerBadgeHtml(ownerInfo)}
                                            <div class="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-mono font-bold mb-2">
                                                <i class="fas fa-key"></i>
                                                PIN: ${juego.pin}
                                            </div>
                                            <div class="text-xs text-slate-500 mt-2">
                                                <i class="fas fa-database mr-1"></i>
                                                ${_t('admin.games.banks_count', {n: validBanks.length}, '{n} banco(s)').replace('{n}', validBanks.length)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="flex gap-2 mt-4">
                                        <button data-admin-action="${canModify ? 'edit-game' : 'ownership-denied'}" data-game-id="${juego.id}" data-resource-label="este juego"
                                            class="${editClasses}" ${canModify ? '' : 'title="Bloqueado: creado por otro usuario"'}>
                                            <i class="fas fa-edit"></i>
                                            ${_t('admin.games.btn_edit', null, 'Editar')}
                                        </button>
                                        <button data-admin-action="${canModify ? 'delete-game' : 'ownership-denied'}" data-game-id="${juego.id}" data-owner-user-id="${juego.created_by_user_id ?? ''}" data-resource-label="este juego" 
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

// ===== PREPARAR NUEVO JUEGO =====

function prepararNuevoJuego() {
    currentBanks = [];
    activeView = null; // Salir de la vista de grid
    renderEditorJuego({ name: '', pin: '', id: null }, []);
}

// ===== CARGAR EDITOR DE JUEGO =====

async function cargarEditorJuego(id) {
    activeView = null; // Salir de la vista de grid
    const res = await fetchWithAuth(`/api/games/${id}`);
    const data = await res.json();

    if (!canModifyOwnedResource(data?.game)) {
        showOwnershipDeniedModal('este juego');
        await renderVistaJuegos();
        return;
    }

    currentBanks = data.banks;
    renderEditorJuego(data.game, data.banks);
}

// ===== RENDERIZAR EDITOR =====

async function renderEditorJuego(game, banks) {
    // Obtener lista de todos los bancos disponibles con conteo de preguntas (caché)
    const allBanks = await getAllBanksWithCounts();
    poolQuestionCountInicial = game.pool_question_count ?? null;

    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        <div class="max-w-4xl mx-auto p-10">
            <!-- Botón volver -->
            <button data-admin-click="mostrarVista('juegos')"
                class="mb-6 text-slate-600 hover:text-green-600 font-bold flex items-center gap-2 transition">
                <i class="fas fa-arrow-left"></i>
                ${_t('admin.games.btn_back', null, 'Volver a Mezcla de Preguntas')}
            </button>

            <div class="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-slate-200">
                <input type="hidden" id="gameEditId" value="${game.id || ''}">
                <input type="hidden" id="gameOwnerUserId" value="${game.created_by_user_id ?? ''}">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-black text-slate-900 italic uppercase">
                        <i class="fas fa-gamepad text-green-500 mr-2"></i>${_t('admin.games.form_title', null, 'Mezcla de Preguntas')}
                    </h2>
                    ${game.id ? `<span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">ID: ${game.id}</span>` : ''}
                </div>
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">${_t('admin.games.label_name', null, 'Nombre del Juego')}</label>
                        <input type="text" id="gameName" value="${game.name}" class="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-green-500 outline-none transition shadow-sm" placeholder="Ej: Quiz Semanal">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">${_t('admin.games.label_pin', null, 'PIN Personalizado')}</label>
                        <input type="text" id="gamePin" value="${game.pin}" class="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-green-500 outline-none transition font-mono shadow-sm" placeholder="Ej: 123456 (vacío = aleatorio)">
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-slate-200">
                <h3 class="text-xl font-black text-slate-700 uppercase mb-6">
                    <i class="fas fa-sliders-h text-green-500 mr-2"></i>${_t('admin.games.section_config', null, 'Configuración del juego')}
                </h3>

                <!-- Idioma -->
                <div class="mb-5">
                    <label class="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">${_t('common.label_language', null, 'Idioma de las preguntas')}</label>
                    ${renderLanguageSelect({ id: 'gameLanguage', value: game.language })}
                </div>

                <!-- Mostrar al presentador -->
                <div class="mb-5">
                    <label class="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" id="gameVisibleToPresenter" ${game.visible_to_presenter !== false ? 'checked' : ''} class="w-5 h-5 text-green-600 rounded focus:ring-green-500">
                        <span class="text-sm font-bold text-slate-700">
                            <i class="fas fa-eye mr-2"></i>${_t('admin.banks.label_visible', null, 'Mostrar al presentador')}
                        </span>
                    </label>
                    <p class="text-slate-400 text-xs mt-1 ml-8">${_t('admin.games.help_visible', null, 'Si está marcado, el presentador podrá ver y usar este juego')}</p>
                </div>

                <hr class="border-slate-100 mb-5">

                <!-- Rachas -->
                <div class="mb-4">
                    <label class="flex items-center gap-3 cursor-pointer mb-1">
                        <input type="checkbox" id="gameUseStreaks" ${game.use_streaks ? 'checked' : ''} class="w-5 h-5 text-orange-500 rounded focus:ring-orange-400" data-admin-change="toggleStreakConfig()">
                        <span class="text-sm font-bold text-slate-700">
                            <i class="fas fa-fire text-orange-400 mr-2"></i>${_t('admin.games.label_streaks', null, 'Usar Rachas')}
                        </span>
                    </label>
                    <p class="text-slate-400 text-xs ml-8">${_t('admin.games.help_streaks', null, 'Aplica bonus de puntos a jugadores con respuestas correctas consecutivas')}</p>
                </div>

                <div id="streakConfigPanel" class="${game.use_streaks ? '' : 'hidden'} ml-8 grid grid-cols-2 gap-4 mb-5 p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.streak_threshold_label', null, 'Preguntas para activar Racha')}</label>
                        <input type="number" id="gameStreakThreshold" min="1" max="20" value="${game.streak_threshold ?? 3}"
                            class="w-full p-2 border-2 border-slate-100 rounded-xl focus:border-orange-400 outline-none text-sm shadow-sm">
                        <p class="text-xs text-slate-400 mt-1">${_t('admin.games.streak_threshold_help', null, 'Nº de aciertos consecutivos para entrar en racha')}</p>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.streak_bonus_label', null, 'Multiplicador de bonus racha')}</label>
                        <input type="number" id="gameStreakBonusPercentage" min="0" max="2" step="0.05" value="${game.streak_bonus_percentage ?? 0.5}"
                            class="w-full p-2 border-2 border-slate-100 rounded-xl focus:border-orange-400 outline-none text-sm shadow-sm">
                        <p class="text-xs text-slate-400 mt-1">${_t('admin.games.streak_bonus_help', null, 'Ej: 0.50 = +50% de los puntos base')}</p>
                    </div>
                </div>

                <hr class="border-slate-100 mb-5">

                <!-- Dobles Rachas -->
                <div class="mb-4">
                    <label class="flex items-center gap-3 cursor-pointer mb-1">
                        <input type="checkbox" id="gameUseDoubleStreaks" ${game.use_double_streaks ? 'checked' : ''} class="w-5 h-5 text-red-500 rounded focus:ring-red-400" data-admin-change="toggleDoubleStreakConfig()">
                        <span class="text-sm font-bold text-slate-700">
                            <i class="fas fa-fire text-red-500 mr-1"></i><i class="fas fa-fire text-red-500 mr-2"></i>${_t('admin.games.label_dbl_streaks', null, 'Usar Dobles Rachas')}
                        </span>
                    </label>
                    <p class="text-slate-400 text-xs ml-8">${_t('admin.games.help_dbl_streaks', null, 'Bonus adicional para jugadores que superan un umbral mayor de aciertos consecutivos')}</p>
                </div>

                <div id="doubleStreakConfigPanel" class="${game.use_double_streaks ? '' : 'hidden'} ml-8 grid grid-cols-2 gap-4 p-4 bg-red-50 rounded-xl border border-red-100">
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.dbl_threshold_label', null, 'Preguntas para Doble Racha')}</label>
                        <input type="number" id="gameDoubleStreakThreshold" min="1" max="20" value="${game.double_streak_threshold ?? 5}"
                            class="w-full p-2 border-2 border-slate-100 rounded-xl focus:border-red-400 outline-none text-sm shadow-sm">
                        <p class="text-xs text-slate-400 mt-1">${_t('admin.games.dbl_threshold_help', null, 'Nº de aciertos consecutivos para la doble racha')}</p>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.dbl_bonus_label', null, 'Multiplicador bonus doble racha')}</label>
                        <input type="number" id="gameDoubleStreakBonusPercentage" min="0" max="2" step="0.05" value="${game.double_streak_bonus_percentage ?? 1.0}"
                            class="w-full p-2 border-2 border-slate-100 rounded-xl focus:border-red-400 outline-none text-sm shadow-sm">
                        <p class="text-xs text-slate-400 mt-1">${_t('admin.games.dbl_bonus_help', null, 'Ej: 1.00 = +100% de los puntos base')}</p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm p-8 mb-8 border border-slate-200">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-black text-slate-700 uppercase">${_t('admin.banks.title', null, 'Bancos de Preguntas')}</h3>
                    <button data-admin-click="añadirBancoAlJuego()" class="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-green-700 shadow-md transition transform active:scale-95">
                        <i class="fas fa-plus mr-2"></i> ${_t('admin.games.btn_add_bank', null, 'Añadir Banco')}
                    </button>
                </div>
                <div id="listaBancosJuego" class="space-y-3"></div>
                ${allBanks.length === 0 ? `<p class="text-slate-400 text-sm italic">${_t('admin.games.no_banks', null, 'No hay bancos disponibles. Crea uno primero.')}</p>` : ''}
                <div id="poolTotalWrapper"></div>
            </div>

            <div class="mt-8">
                <div class="grid grid-cols-2 gap-4">
                    <button data-admin-click="guardarJuego(false)" class="bg-green-600 text-white px-6 py-5 rounded-2xl font-black text-lg hover:bg-green-700 transition shadow-xl shadow-green-200 flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95">
                        <i class="fas fa-save text-xl"></i> ${_t('admin.games.btn_save', null, 'GUARDAR JUEGO')}
                    </button>
                    <button data-admin-click="guardarJuego(true)" class="bg-cyan-600 text-white px-6 py-5 rounded-2xl font-black text-lg hover:bg-cyan-700 transition shadow-xl shadow-cyan-200 flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95">
                        <i class="fas fa-cloud-upload-alt text-xl"></i> ${_t('admin.banks.btn_save_exit', null, 'GUARDAR Y SALIR')}
                    </button>
                </div>
                <p class="text-center text-slate-400 text-xs mt-3">
                    <i class="fas fa-info-circle mr-1"></i>${_t('admin.games.help_save', null, '"Guardar" mantiene el editor abierto, "Guardar y salir" vuelve a la lista de juegos')}
                </p>
            </div>
        </div>`);

    setUnsavedChangesGuard('juegos', () => ({
        id: document.getElementById('gameEditId')?.value || '',
        name: document.getElementById('gameName')?.value || '',
        pin: document.getElementById('gamePin')?.value || '',
        language: document.getElementById('gameLanguage')?.value || 'es',
        visible_to_presenter: document.getElementById('gameVisibleToPresenter')?.checked ?? true,
        use_streaks: document.getElementById('gameUseStreaks')?.checked ?? false,
        streak_threshold: parseFloat(document.getElementById('gameStreakThreshold')?.value ?? 3),
        streak_bonus_percentage: parseFloat(document.getElementById('gameStreakBonusPercentage')?.value ?? 0.5),
        use_double_streaks: document.getElementById('gameUseDoubleStreaks')?.checked ?? false,
        double_streak_threshold: parseFloat(document.getElementById('gameDoubleStreakThreshold')?.value ?? 5),
        double_streak_bonus_percentage: parseFloat(document.getElementById('gameDoubleStreakBonusPercentage')?.value ?? 1.0),
        pool_question_count: document.getElementById('gamePoolQuestionCount')?.value || '',
        banks: currentBanks
    }));

    dibujarBancosJuego();
}

// ===== DIBUJAR BANCOS DEL JUEGO =====

async function dibujarBancosJuego() {
    // Obtener todos los bancos con conteo de preguntas desde el caché
    const allBanks = await getAllBanksWithCounts();

    const contenedor = document.getElementById('listaBancosJuego');
    if (!contenedor) return;

    // Crear un mapa para acceso rápido a los conteos
    const banksMap = {};
    for (const bank of allBanks) {
        banksMap[bank.id] = bank.question_count || 0;
    }

    contenedor.innerHTML = currentBanks.map((gb, idx) => {
        const bankInfo = allBanks.find(b => b.id === gb.bank_id);
        if (!bankInfo) return '';

        const totalQuestions = banksMap[gb.bank_id] || 1;

        return `
                <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
                    <div class="flex items-center gap-4">
                        <div class="flex-1">
                            <label class="block text-xs font-bold text-slate-400 uppercase mb-1">${_t('admin.games.bank_label', null, 'Banco')}</label>
                            <select data-admin-change="cambiarBanco(${idx}, parseInt(this.value))" class="w-full p-2 border-2 border-slate-100 rounded-lg text-sm font-medium">
                                ${allBanks.map(b => `<option value="${b.id}" ${b.id === gb.bank_id ? 'selected' : ''}>${b.name}</option>`).join('')}
                            </select>
                        </div>
                        ${renderPoolCheckboxHtml(gb, idx, totalQuestions)}
                        <button data-admin-click="eliminarBancoDelJuego(${idx})" class="text-red-500 hover:text-red-700 mt-5">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <p class="text-xs text-slate-400 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>${_t('admin.games.bank_questions_info', {n: totalQuestions}, 'Este banco tiene {n} preguntas disponibles').replace('{n}', totalQuestions)}
                    </p>
                </div>
            `}).join('');

    dibujarSeccionPool();
}

// ===== FUNCIONES DE GESTIÓN DE BANCOS EN JUEGO =====

async function cambiarBanco(idx, newBankId) {
    // Obtener info del banco desde el caché
    const bankInfo = await getBankFromCache(newBankId);
    if (!bankInfo) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), 'No se pudo cargar la información del banco', 'error');
        return;
    }

    const totalQuestions = bankInfo.question_count || 0;

    currentBanks[idx].bank_id = newBankId;
    currentBanks[idx].total_questions = totalQuestions;
    if (!bancoEsPool(currentBanks[idx])) {
        currentBanks[idx].question_count = Math.min(currentBanks[idx].question_count, totalQuestions);
    }

    dibujarBancosJuego();
}

async function añadirBancoAlJuego() {
    // Obtener bancos desde el caché
    const allBanks = await getAllBanksWithCounts();

    if (allBanks.length === 0) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), 'No hay bancos disponibles. Crea uno primero.', 'warning');
        return;
    }

    // Obtener el primer banco
    const primerBanco = allBanks[0];
    const totalQuestions = primerBanco.question_count || 1;

    // Agregar el primer banco como predeterminado
    currentBanks.push({
        bank_id: primerBanco.id,
        question_count: 1,
        total_questions: totalQuestions
    });
    dibujarBancosJuego();
}

function eliminarBancoDelJuego(idx) {
    currentBanks.splice(idx, 1);
    dibujarBancosJuego();
}

// ===== GUARDAR JUEGO =====

function toggleStreakConfig() {
    const enabled = document.getElementById('gameUseStreaks')?.checked;
    const panel = document.getElementById('streakConfigPanel');
    if (panel) panel.classList.toggle('hidden', !enabled);
}

function toggleDoubleStreakConfig() {
    const enabled = document.getElementById('gameUseDoubleStreaks')?.checked;
    const panel = document.getElementById('doubleStreakConfigPanel');
    if (panel) panel.classList.toggle('hidden', !enabled);
}

// ===== GUARDAR JUEGO =====

async function guardarJuego(salir = true) {
    const id = document.getElementById('gameEditId').value;
    const ownerUserId = document.getElementById('gameOwnerUserId')?.value || null;
    const name = document.getElementById('gameName').value;
    const pin = document.getElementById('gamePin').value;
    const language = document.getElementById('gameLanguage')?.value || 'es';
    const visibleToPresenter = document.getElementById('gameVisibleToPresenter').checked;
    const useStreaks = document.getElementById('gameUseStreaks').checked;
    const streakThreshold = parseFloat(document.getElementById('gameStreakThreshold').value) || 3;
    const streakBonusPercentage = parseFloat(document.getElementById('gameStreakBonusPercentage').value) ?? 0.5;
    const useDoubleStreaks = document.getElementById('gameUseDoubleStreaks').checked;
    const doubleStreakThreshold = parseFloat(document.getElementById('gameDoubleStreakThreshold').value) || 5;
    const doubleStreakBonusPercentage = parseFloat(document.getElementById('gameDoubleStreakBonusPercentage').value) ?? 1.0;

    if (!name) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.games.error_name', null, 'Por favor, ponle un nombre al juego'), 'warning');
    if (currentBanks.length === 0) return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.games.error_banks', null, 'Añade al menos un banco de preguntas'), 'warning');
    if (id && !canModifyOwnedResource(ownerUserId)) {
        showOwnershipDeniedModal('este juego');
        return;
    }

    const bankIds = currentBanks.map(b => b.bank_id);
    const uniqueBankIds = new Set(bankIds);
    if (uniqueBankIds.size !== bankIds.length) {
        return mostrarModalError(_t('admin.common.warning_title', null, '⚠️ Advertencia'), _t('admin.games.error_duplicate_banks', null, 'Tienes bancos repetidos. Los bancos de preguntas deben de ser únicos'), 'warning');
    }

    const poolQuestionCount = obtenerPoolQuestionCount();
    const poolError = validarConfigPool(currentBanks, poolQuestionCount);
    if (poolError) {
        return mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), poolError, 'warning');
    }

    const payload = {
        name,
        pin: pin || Math.floor(100000 + Math.random() * 900000).toString(),
        language,
        visible_to_presenter: visibleToPresenter,
        use_streaks: useStreaks,
        streak_threshold: streakThreshold,
        streak_bonus_percentage: streakBonusPercentage,
        use_double_streaks: useDoubleStreaks,
        double_streak_threshold: doubleStreakThreshold,
        double_streak_bonus_percentage: doubleStreakBonusPercentage,
        pool_question_count: poolQuestionCount,
        banks: currentBanks.map(b => ({
            bank_id: b.bank_id,
            question_count: bancoEsPool(b) ? null : b.question_count
        }))
    };

    try {
        const url = id ? `/api/games/${id}` : '/api/games';
        const method = id ? 'PUT' : 'POST';

        const res = await fetchWithAuth(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            markUnsavedChangesAsSaved();
            mostrarModalError(_t('admin.common.success_title', null, '✅ Éxito'), _t('admin.games.success_saved', null, '¡Juego guardado correctamente!'), 'success');

            if (salir) {
                // Volver a la vista de juegos
                mostrarVista('juegos');
            } else {
                // Si es un juego nuevo, actualizar el ID en el formulario
                if (!id && data.id) {
                    document.getElementById('gameEditId').value = data.id;
                    // Recargar el juego completo
                    await cargarEditorJuego(data.id);
                }
                // Si ya existía, solo mantener el editor abierto
            }
        } else {
            const err = await res.json();
            mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), err.message || err.error || 'Error desconocido', 'error');
        }
    } catch (error) {
        mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión con el servidor'), 'error');
    }
}

// ===== ELIMINAR JUEGO =====

async function borrarJuego(id, event, ownerUserId = null) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!canModifyOwnedResource(ownerUserId)) {
        showOwnershipDeniedModal('este juego');
        return;
    }
    mostrarModalConfirmacion(
        _t('admin.common.confirmation_title', null, '⚠️ Confirmación'),
        _t('admin.games.confirm_delete', null, '¿Deseas eliminar este juego para siempre?'),
        async () => {
            try {
                const res = await fetchWithAuth(`/api/games/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    renderVistaJuegos();
                } else {
                    const err = await res.json();
                    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), err.error || err.message || _t('admin.games.error_delete', null, 'No se pudo eliminar el juego'), 'error');
                }
            } catch {
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión'), 'error');
            }
        },
        null,
        _t('admin.common.delete', null, 'Eliminar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}
