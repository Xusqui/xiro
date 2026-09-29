/**
 * @fileoverview Gestión de juegos Trivial - Editor de formulario
 * Parte 2 de 2: Renderizado del editor. Ver trivial-expanded.js para lista y CRUD.
 * const TRIVIAL_COLORS = ['#DB2777', '#16A34A', '#2563EB', '#F59E0B', '#7C3AED / #8000FF' (Original), '#5A2E0C'];
 */

const TRIVIAL_COLORS = ['#DB2777', '#16A34A', '#2563EB', '#F59E0B', '#8000FF', '#5A2E0C'];

async function renderEditorTrivial(game, cats) {
    const [rB, rG, rC] = await Promise.all([
        fetchWithAuth('/api/banks'), fetchWithAuth('/api/games'), fetchWithAuth('/api/custom-games')
    ]);
    const [allBanks, allGames, allCGs] = await Promise.all([rB.json(), rG.json(), rC.json()]);
    window._trivialSources = {
        bank: allBanks.map(b => ({ id: b.id, name: b.name })),
        game: allGames.map(g => ({ id: g.id, name: g.name })),
        custom_game: allCGs.map(c => ({ id: c.id, name: c.name }))
    };

    const defaultCats = cats.length > 0 ? cats : [
        { category_name: 'Categoría 1', color: TRIVIAL_COLORS[0], source_type: 'bank', source_id: null },
        { category_name: 'Categoría 2', color: TRIVIAL_COLORS[1], source_type: 'bank', source_id: null },
        { category_name: 'Categoría 3', color: TRIVIAL_COLORS[2], source_type: 'bank', source_id: null }
    ];
    const N = defaultCats.length;
    const outerDefault = Math.floor(42 / (N * (N + 1))) * (N * (N + 1));

    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        <div class="max-w-3xl mx-auto px-8 pt-6">
            <button data-admin-click="navigateWithUnsavedChangesGuard(() => renderVistaTrivial())" class="mb-4 text-slate-600 hover:text-orange-600 font-bold flex items-center gap-2 transition">
                <i class="fas fa-arrow-left"></i>
                ${_t('admin.custom.btn_back', null, 'Volver')}
            </button>
        </div>

        <div class="xiro-editor-sticky-header" style="max-width: 1100px;">
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <input type="hidden" id="trivial-id" value="${game?.id ?? ''}">
                <input type="hidden" id="trivial-owner-user-id" value="${game?.created_by_user_id ?? ''}">
                <h2 class="text-lg font-black text-slate-900 italic uppercase mb-4">
                    <i class="fas fa-dice-d20 text-orange-500 mr-2"></i>${game ? _t('admin.trivial.form_edit', null, 'Editar Trivial') : _t('admin.trivial.form_new', null, 'Nuevo Trivial')}
                </h2>

                <div class="xiro-editor-header-grid">
                    <!-- Columna 1: Identidad -->
                    <div>
                        <div class="grid grid-cols-3 gap-3 mb-3">
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.trivial.label_name', null, 'Nombre del juego')}</label>
                                <input id="trivial-name" type="text" value="${escapeHtml(game?.name ?? '')}"
                                    class="w-full border-2 border-slate-100 rounded-lg p-2 text-sm focus:outline-none focus:border-orange-400">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.trivial.label_pin', null, 'PIN')}</label>
                                <input id="trivial-pin" type="text" value="${game?.pin ?? ''}" placeholder="${_t('admin.trivial.ph_pin', null, 'ej. TRV01')}"
                                    class="w-full border-2 border-slate-100 rounded-lg p-2 text-sm focus:outline-none focus:border-orange-400">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.trivial.label_outer', null, 'Casillas externas')}</label>
                                <input id="trivial-outer" type="number" value="${outerDefault}" readonly
                                    class="w-full border-2 border-slate-100 rounded-lg p-2 text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                                    title="${_t('admin.trivial.hint_outer', null, 'Calculado automáticamente: múltiplo de N×(N+1) más cercano a 42')}">
                            </div>
                        </div>
                        <div class="mb-3 flex items-center justify-center gap-3">
                            <span class="text-base font-bold text-slate-700"><i class="fas fa-eye mr-1"></i>${_t('admin.trivial.label_visible', null, 'Visible para el presentador')}</span>
                            <span style="transform: scale(1); transform-origin: left center;">${renderNeonSwitch({ id: 'trivial-visible', checked: game?.visible_to_presenter !== false, action: null })}</span>
                        </div>
                        <div class="mb-3 text-center">
                            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('common.label_language', null, 'Idioma de las preguntas')}</label>
                            <div class="flex justify-center">${renderLanguageSelect({ id: 'trivial-language', value: game?.language })}</div>
                        </div>
                        <div class="flex flex-col items-center text-center">${renderGameCoverField('trivial', game?.image_url)}</div>
                    </div>

                    <!-- Columna 2: Reglas de puntuación -->
                    <div>
                        <!-- Rachas -->
                        <div class="flex items-center gap-3 mb-2" title="${_t('admin.trivial.help_streaks', null, 'Aplica bonus de puntos a jugadores con respuestas correctas consecutivas')}">
                            <span class="text-sm font-bold text-slate-700"><i class="fas fa-fire text-orange-400 mr-1"></i>${_t('admin.trivial.label_streaks', null, 'Usar Rachas')}</span>
                            ${renderNeonSwitch({ id: 'trivial-use-streaks', checked: game?.use_streaks, action: null, attrs: 'data-admin-change="toggleTrivialStreakConfig()"' })}
                        </div>

                        <div id="trivialStreakConfigPanel" class="${game?.use_streaks ? '' : 'hidden'} ml-6 mb-3 grid grid-cols-2 gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.trivial.streak_threshold_label', null, 'Preguntas para activar Racha')}</label>
                                <input type="number" id="trivial-streak-threshold" min="1" max="20" value="${game?.streak_threshold ?? 3}"
                                    class="w-full border-2 border-slate-100 rounded-lg p-2 text-sm focus:outline-none focus:border-orange-400">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.trivial.streak_bonus_label', null, 'Multiplicador de bonus racha')}</label>
                                <input type="number" id="trivial-streak-bonus" min="0" max="2" step="0.05" value="${game?.streak_bonus_percentage ?? 0.5}"
                                    class="w-full border-2 border-slate-100 rounded-lg p-2 text-sm focus:outline-none focus:border-orange-400">
                            </div>
                        </div>

                        <!-- Dobles Rachas -->
                        <div class="flex items-center gap-3 mb-2" title="${_t('admin.trivial.help_dbl_streaks', null, 'Bonus adicional para jugadores que superan un umbral mayor de aciertos consecutivos')}">
                            <span class="text-sm font-bold text-slate-700"><i class="fas fa-fire text-red-500 mr-1"></i>${_t('admin.trivial.label_dbl_streaks', null, 'Usar Dobles Rachas')}</span>
                            ${renderNeonSwitch({ id: 'trivial-use-double-streaks', checked: game?.use_double_streaks, action: null, attrs: 'data-admin-change="toggleTrivialDoubleStreakConfig()"' })}
                        </div>

                        <div id="trivialDoubleStreakConfigPanel" class="${game?.use_double_streaks ? '' : 'hidden'} ml-6 mb-3 grid grid-cols-2 gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.trivial.dbl_threshold_label', null, 'Preguntas para Doble Racha')}</label>
                                <input type="number" id="trivial-double-threshold" min="1" max="20" value="${game?.double_streak_threshold ?? 5}"
                                    class="w-full border-2 border-slate-100 rounded-lg p-2 text-sm focus:outline-none focus:border-red-400">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.trivial.dbl_bonus_label', null, 'Multiplicador bonus doble racha')}</label>
                                <input type="number" id="trivial-double-bonus" min="0" max="2" step="0.05" value="${game?.double_streak_bonus_percentage ?? 1.0}"
                                    class="w-full border-2 border-slate-100 rounded-lg p-2 text-sm focus:outline-none focus:border-red-400">
                            </div>
                        </div>

                        <!-- Puntuación Aleatoria -->
                        ${renderRandomPointsHtml('trivial', game || {})}
                    </div>
                </div>
            </div>
        </div>

        <div class="max-w-3xl mx-auto px-8 pb-8">
            <div class="bg-white rounded-2xl shadow p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-slate-700">${_t('admin.trivial.section_categories', null, 'Categorías')}</h3>
                    <button data-admin-click="trivialAddCategory()" id="btn-add-cat"
                        class="text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-3 py-1 rounded-lg transition">
                        <i class="fas fa-plus mr-1"></i> ${_t('admin.trivial.btn_add_category', null, 'Añadir')}
                    </button>
                </div>
                <div id="trivial-cats-container" class="space-y-3">
                    ${defaultCats.map((c, i) => _trivialCatRow(c, i)).join('')}
                </div>
                <p class="text-xs text-slate-400 mt-3">${_t('admin.trivial.hint_categories_count', null, 'Mínimo 2, máximo 6 categorías.')}</p>
            </div>
            <div class="flex gap-3">
                <button data-admin-click="guardarTrivial(false)"
                    class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl text-lg shadow transition">
                    <i class="fas fa-save mr-2"></i> ${game ? _t('admin.trivial.btn_save_changes', null, 'Guardar cambios') : _t('admin.trivial.btn_create', null, 'Crear Trivial')}
                </button>
                <button data-admin-click="guardarTrivial(true)"
                    class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl text-lg shadow-lg transition">
                    <i class="fas fa-sign-out-alt mr-2"></i> ${_t('admin.trivial.btn_save_exit', null, 'Guardar y salir')}
                </button>
            </div>
        </div>`);

    // Store bankOptions for dynamic add
    _trivialSyncColorOptions();
    _trivialSyncSrcOptions();
    setUnsavedChangesGuard('trivial', _trivialEditorSnapshot);
}

/** Estado del editor para detectar cambios sin guardar. */
function _trivialEditorSnapshot() {
    const cats = Array.from(document.querySelectorAll('.trivial-cat-row')).map(r => ({
        src: r.querySelector('.cat-src-id')?.value,
        type: r.querySelector('.cat-src-type')?.value,
        color: r.querySelector('.cat-color')?.value
    }));
    return {
        name: document.getElementById('trivial-name')?.value || '',
        pin: document.getElementById('trivial-pin')?.value || '',
        language: document.getElementById('trivial-language')?.value || 'es',
        visible_to_presenter: document.getElementById('trivial-visible')?.checked ?? true,
        use_streaks: document.getElementById('trivial-use-streaks')?.checked ?? false,
        streak_threshold: document.getElementById('trivial-streak-threshold')?.value ?? 3,
        streak_bonus_percentage: document.getElementById('trivial-streak-bonus')?.value ?? 0.5,
        use_double_streaks: document.getElementById('trivial-use-double-streaks')?.checked ?? false,
        double_streak_threshold: document.getElementById('trivial-double-threshold')?.value ?? 5,
        double_streak_bonus_percentage: document.getElementById('trivial-double-bonus')?.value ?? 1.0,
        image_url: document.getElementById('trivial-image-url')?.value || '',
        ...snapshotRandomPoints('trivial'),
        cats: JSON.stringify(cats)
    };
}

function toggleTrivialStreakConfig() {
    const enabled = document.getElementById('trivial-use-streaks')?.checked;
    const panel = document.getElementById('trivialStreakConfigPanel');
    if (panel) panel.classList.toggle('hidden', !enabled);
}

function toggleTrivialDoubleStreakConfig() {
    const enabled = document.getElementById('trivial-use-double-streaks')?.checked;
    const panel = document.getElementById('trivialDoubleStreakConfigPanel');
    if (panel) panel.classList.toggle('hidden', !enabled);
}

function _trivialColorLabels() {
    return {
        '#DB2777': _t('admin.trivial.color_pink', null, 'Rosa'),
        '#16A34A': _t('admin.trivial.color_green', null, 'Verde'),
        '#2563EB': _t('admin.trivial.color_blue', null, 'Azul'),
        '#F59E0B': _t('admin.trivial.color_amber', null, 'Ámbar'),
        '#8000FF': _t('admin.trivial.color_violet', null, 'Violeta'),
        '#5A2E0C': _t('admin.trivial.color_brown', null, 'Marrón')
    };
}

function _trivialCatRow(cat, idx) {
    const color = cat.color || TRIVIAL_COLORS[idx % TRIVIAL_COLORS.length];
    const srcType = cat.source_type || 'bank';
    const srcId = cat.source_id || cat.bank_id;
    const colorLabels = _trivialColorLabels();
    const colorOpts = TRIVIAL_COLORS.map(c =>
        `<option value="${c}"${c === color ? ' selected' : ''}>${colorLabels[c] || c}</option>`
    ).join('');
    const sources = (window._trivialSources || {})[srcType] || [];
    const srcOpts = sources.map(s =>
        `<option value="${s.id}"${String(s.id) === String(srcId) ? ' selected' : ''}>${escapeHtml(s.name)}</option>`
    ).join('');
    return `
        <div class="trivial-cat-row flex items-center gap-3 bg-slate-50 rounded-xl p-3">
            <select class="cat-color border rounded-lg px-2 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                style="background:${color}" data-admin-change="trivialOnColorChange(this)">
                ${colorOpts}
            </select>
            <input type="hidden" class="cat-name" value="${escapeHtml(cat.category_name || '')}">
            <select class="cat-src-type w-32 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                data-admin-change="trivialOnSrcTypeChange(this)">
                <option value="bank"${srcType === 'bank' ? ' selected' : ''}>${_t('admin.trivial.src_type_bank', null, 'Banco')}</option>
                <option value="game"${srcType === 'game' ? ' selected' : ''}>${_t('admin.trivial.src_type_game', null, 'Mezcla')}</option>
                <option value="custom_game"${srcType === 'custom_game' ? ' selected' : ''}>${_t('admin.trivial.src_type_custom', null, 'Personalizado')}</option>
            </select>
            <select class="cat-src-id flex-1 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                data-admin-change="trivialOnSrcIdChange(this)">
                <option value="">${_t('admin.trivial.ph_select', null, '— Seleccionar —')}</option>
                ${srcOpts}
            </select>
            <button data-admin-click="trivialRemoveCategory(this)" class="text-red-400 hover:text-red-600 transition px-1">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
}

function _trivialRecalcOuter() {
    const container = document.getElementById('trivial-cats-container');
    const field = document.getElementById('trivial-outer');
    if (!container || !field) return;
    const N = container.querySelectorAll('.trivial-cat-row').length;
    const step = N * (N + 1);
    field.value = Math.floor(42 / step) * step;
}

function trivialAddCategory() {
    const container = document.getElementById('trivial-cats-container');
    const count = container.querySelectorAll('.trivial-cat-row').length;
    if (count >= 6) return mostrarModalError(_t('admin.common.warning_title', null, '⚠️ Advertencia'), _t('admin.trivial.error_max_categories', null, 'Máximo 6 categorías.'), 'warning');
    const usedColors = Array.from(container.querySelectorAll('.cat-color')).map(s => s.value);
    const freeColor = TRIVIAL_COLORS.find(c => !usedColors.includes(c)) || TRIVIAL_COLORS[count % TRIVIAL_COLORS.length];
    const cat = { category_name: '', color: freeColor, source_type: 'bank', source_id: null };
    container.insertAdjacentHTML('beforeend', _tHtml(_trivialCatRow(cat, count)));
    _trivialSyncColorOptions();
    _trivialSyncSrcOptions();
    _trivialRecalcOuter();
}

function trivialOnColorChange(sel) {
    sel.style.background = sel.value;
    _trivialSyncColorOptions();
}

function trivialOnSrcTypeChange(sel) {
    const row = sel.closest('.trivial-cat-row');
    const sources = (window._trivialSources || {})[sel.value] || [];
    const placeholder = _t('admin.trivial.ph_select', null, '— Seleccionar —');
    const opts = sources.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    row.querySelector('.cat-src-id').innerHTML = _tHtml(`<option value="">${placeholder}</option>` + opts);
    row.querySelector('.cat-name').value = '';
    _trivialSyncSrcOptions();
}

function trivialOnSrcIdChange(sel) {
    const row = sel.closest('.trivial-cat-row');
    const text = sel.options[sel.selectedIndex]?.text || '';
    const placeholder = _t('admin.trivial.ph_select', null, '— Seleccionar —');
    row.querySelector('.cat-name').value = text === placeholder ? '' : text;
    _trivialSyncSrcOptions();
}

function _trivialSyncSrcOptions() {
    const container = document.getElementById('trivial-cats-container');
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('.trivial-cat-row'));
    // Build set of used "type:id" combos
    const used = new Set(rows.map(r => {
        const t = r.querySelector('.cat-src-type')?.value || '';
        const v = r.querySelector('.cat-src-id')?.value || '';
        return v ? `${t}:${v}` : '';
    }).filter(Boolean));
    rows.forEach(row => {
        const type = row.querySelector('.cat-src-type')?.value || '';
        const srcSel = row.querySelector('.cat-src-id');
        if (!srcSel) return;
        const myVal = srcSel.value;
        Array.from(srcSel.options).forEach(opt => {
            if (!opt.value) return; // keep placeholder
            const key = `${type}:${opt.value}`;
            opt.disabled = opt.value !== myVal && used.has(key);
        });
    });
}

function _trivialSyncColorOptions() {
    const container = document.getElementById('trivial-cats-container');
    if (!container) return;
    const selects = Array.from(container.querySelectorAll('.cat-color'));
    const usedColors = selects.map(s => s.value);
    selects.forEach(sel => {
        Array.from(sel.options).forEach(opt => {
            opt.disabled = opt.value !== sel.value && usedColors.includes(opt.value);
        });
    });
}

function trivialRemoveCategory(btn) {
    const container = document.getElementById('trivial-cats-container');
    if (container.querySelectorAll('.trivial-cat-row').length <= 2) return mostrarModalError(_t('admin.common.warning_title', null, '⚠️ Advertencia'), _t('admin.trivial.error_min_categories', null, 'Mínimo 2 categorías.'), 'warning');
    btn.closest('.trivial-cat-row').remove();
    _trivialSyncColorOptions();
    _trivialSyncSrcOptions();
    _trivialRecalcOuter();
}
