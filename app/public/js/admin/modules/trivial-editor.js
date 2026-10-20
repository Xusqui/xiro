/**
 * @fileoverview Gestión de juegos Trivial - Editor de formulario
 * Parte 2 de 2: Renderizado del editor. Ver trivial-expanded.js para lista y CRUD.
 * const TRIVIAL_COLORS = ['#DB2777', '#16A34A', '#2563EB', '#F59E0B', '#7C3AED / #8000FF' (Original), '#5A2E0C'];
 */

const TRIVIAL_COLORS = ['#DB2777', '#16A34A', '#2563EB', '#F59E0B', '#8000FF', '#5A2E0C'];

/** Cabecera compacta del editor de trivial (editor-header.js), con los ids de siempre. */
function _trivialHeaderConfig(game, outerDefault) {
    const keys = 'admin.trivial';
    return {
        entity: game,
        accent: 'orange',
        icon: 'fa-dice-d20',
        kind: game ? _t('admin.trivial.form_edit', null, 'Editar Trivial') : _t('admin.trivial.form_new', null, 'Nuevo Trivial'),
        hiddenHtml: `<input type="hidden" id="trivial-id" value="${game?.id ?? ''}">
                <input type="hidden" id="trivial-owner-user-id" value="${game?.created_by_user_id ?? ''}">`,
        back: { action: 'navigateWithUnsavedChangesGuard(() => renderVistaTrivial())', label: _t('admin.custom.btn_back', null, 'Volver') },
        name: { id: 'trivial-name', label: _t('admin.trivial.label_name', null, 'Nombre del juego') },
        pin: { id: 'trivial-pin', label: _t('admin.trivial.label_pin', null, 'PIN'), placeholder: _t('admin.trivial.ph_pin', null, 'ej. TRV01') },
        visible: { id: 'trivial-visible', label: _t('admin.trivial.label_visible', null, 'Visible para el presentador') },
        languageId: 'trivial-language',
        coverKind: 'trivial',
        randomPrefix: 'trivial',
        extraGeneralHtml: `
                        <div class="xeh-field" title="${_t('admin.trivial.hint_outer', null, 'Calculado automáticamente: múltiplo de N×(N+1) más cercano a 42')}">
                            <label class="xeh-field__label" for="trivial-outer">${_t('admin.trivial.label_outer', null, 'Casillas externas')}</label>
                            <input id="trivial-outer" type="number" value="${outerDefault}" readonly class="xeh-input xeh-input--readonly">
                        </div>`,
        streaks: {
            keys,
            toggle: 'trivial-use-streaks',
            panel: 'trivialStreakConfigPanel',
            threshold: 'trivial-streak-threshold',
            bonus: 'trivial-streak-bonus',
            onToggle: 'toggleTrivialStreakConfig()'
        },
        doubleStreaks: {
            keys,
            toggle: 'trivial-use-double-streaks',
            panel: 'trivialDoubleStreakConfigPanel',
            threshold: 'trivial-double-threshold',
            bonus: 'trivial-double-bonus',
            onToggle: 'toggleTrivialDoubleStreakConfig()'
        }
    };
}

async function renderEditorTrivial(game, cats) {
    activeView = null; // Salir de la vista de grid
    const [rB, rG, rC] = await Promise.all([
        fetchWithAuth('/api/banks'),
        fetchWithAuth('/api/games'),
        fetchWithAuth('/api/custom-games')
    ]);
    const [allBanks, allGames, allCGs] = await Promise.all([rB.json(), rG.json(), rC.json()]);
    window._trivialSources = {
        bank: allBanks.map(b => ({ id: b.id, name: b.name })),
        game: allGames.map(g => ({ id: g.id, name: g.name })),
        custom_game: allCGs.map(c => ({ id: c.id, name: c.name }))
    };

    const defaultCats =
        cats.length > 0
            ? cats
            : [
                { category_name: 'Categoría 1', color: TRIVIAL_COLORS[0], source_type: 'bank', source_id: null },
                { category_name: 'Categoría 2', color: TRIVIAL_COLORS[1], source_type: 'bank', source_id: null },
                { category_name: 'Categoría 3', color: TRIVIAL_COLORS[2], source_type: 'bank', source_id: null }
            ];
    const N = defaultCats.length;
    const outerDefault = Math.floor(42 / (N * (N + 1))) * (N * (N + 1));

    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        ${renderEditorHeader(_trivialHeaderConfig(game, outerDefault))}

        <div class="xiro-editor-body">
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
            ${renderSaveBar(_t('admin.savebar.btn_save_changes'))}
        </div>`);

    // Store bankOptions for dynamic add
    _trivialSyncColorOptions();
    _trivialSyncSrcOptions();
    const gameId = game?.id || null;
    bindSaveBar({
        guard: 'trivial',
        root: 'editorArea',
        cleanText: gameId ? null : _t('admin.savebar.new_item'),
        save: guardarTrivial,
        discard: () => (gameId ? cargarEditorTrivial(gameId) : prepararNuevoTrivial()),
        snapshot: _trivialEditorSnapshot
    });
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
    const colorOpts = TRIVIAL_COLORS.map(
        c => `<option value="${c}"${c === color ? ' selected' : ''}>${colorLabels[c] || c}</option>`
    ).join('');
    const sources = (window._trivialSources || {})[srcType] || [];
    const srcOpts = sources
        .map(
            s =>
                `<option value="${s.id}"${String(s.id) === String(srcId) ? ' selected' : ''}>${escapeHtml(s.name)}</option>`
        )
        .join('');
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
    if (count >= 6)
        return mostrarModalError(
            _t('admin.common.warning_title', null, '⚠️ Advertencia'),
            _t('admin.trivial.error_max_categories', null, 'Máximo 6 categorías.'),
            'warning'
        );
    const usedColors = Array.from(container.querySelectorAll('.cat-color')).map(s => s.value);
    const freeColor =
        TRIVIAL_COLORS.find(c => !usedColors.includes(c)) || TRIVIAL_COLORS[count % TRIVIAL_COLORS.length];
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
    const used = new Set(
        rows
            .map(r => {
                const t = r.querySelector('.cat-src-type')?.value || '';
                const v = r.querySelector('.cat-src-id')?.value || '';
                return v ? `${t}:${v}` : '';
            })
            .filter(Boolean)
    );
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
    if (container.querySelectorAll('.trivial-cat-row').length <= 2)
        return mostrarModalError(
            _t('admin.common.warning_title', null, '⚠️ Advertencia'),
            _t('admin.trivial.error_min_categories', null, 'Mínimo 2 categorías.'),
            'warning'
        );
    btn.closest('.trivial-cat-row').remove();
    _trivialSyncColorOptions();
    _trivialSyncSrcOptions();
    _trivialRecalcOuter();
}
