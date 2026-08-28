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
        <div class="max-w-3xl mx-auto p-8">
            <div class="flex items-center gap-3 mb-8">
                <button data-admin-click="navigateWithUnsavedChangesGuard(() => renderVistaTrivial())" class="text-slate-400 hover:text-slate-700 transition">
                    <i class="fas fa-arrow-left text-xl"></i>
                </button>
                <h1 class="text-3xl font-black text-slate-900">
                    ${game ? 'Editar Trivial' : 'Nuevo Trivial'}
                </h1>
            </div>
            <input type="hidden" id="trivial-id" value="${game?.id ?? ''}">
            <input type="hidden" id="trivial-owner-user-id" value="${game?.created_by_user_id ?? ''}">
            <div class="bg-white rounded-2xl shadow p-6 space-y-5 mb-6">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Nombre del juego</label>
                    <input id="trivial-name" type="text" value="${escapeHtml(game?.name ?? '')}"
                        class="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1">PIN</label>
                        <input id="trivial-pin" type="text" value="${game?.pin ?? ''}" placeholder="ej. TRV01"
                            class="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1">Casillas externas</label>
                        <input id="trivial-outer" type="number" value="${outerDefault}" readonly
                            class="w-full border rounded-lg px-4 py-2 bg-slate-100 text-slate-500 cursor-not-allowed">
                        <p class="text-xs text-slate-400 mt-1">Calculado automáticamente: múltiplo de N×(N+1) más cercano a 42</p>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">${_t('common.label_language', null, 'Idioma de las preguntas')}</label>
                    ${renderLanguageSelect({ id: 'trivial-language', value: game?.language })}
                </div>
            </div>
            <div class="bg-white rounded-2xl shadow p-6 space-y-4 mb-6">
                <h3 class="text-xl font-black text-slate-700 uppercase">
                    <i class="fas fa-sliders-h text-orange-500 mr-2"></i>Configuración del juego
                </h3>

                <!-- Visible al presentador -->
                <div class="flex items-center gap-3">
                    <input id="trivial-visible" type="checkbox" class="w-4 h-4 accent-orange-500"
                        ${game?.visible_to_presenter !== false ? 'checked' : ''}>
                    <label for="trivial-visible" class="text-sm font-bold text-slate-700">
                        Visible para el presentador
                    </label>
                </div>

                <hr class="border-slate-100">

                <!-- Rachas -->
                <div>
                    <label class="flex items-center gap-3 cursor-pointer mb-1">
                        <input type="checkbox" id="trivial-use-streaks" ${game?.use_streaks ? 'checked' : ''} class="w-4 h-4 accent-orange-500" data-admin-change="toggleTrivialStreakConfig()">
                        <span class="text-sm font-bold text-slate-700">
                            <i class="fas fa-fire text-orange-400 mr-2"></i>Usar Rachas
                        </span>
                    </label>
                    <p class="text-slate-400 text-xs ml-7">Aplica bonus de puntos a jugadores con respuestas correctas consecutivas</p>
                </div>

                <div id="trivialStreakConfigPanel" class="${game?.use_streaks ? '' : 'hidden'} grid grid-cols-2 gap-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Preguntas para activar Racha</label>
                        <input type="number" id="trivial-streak-threshold" min="1" max="20" value="${game?.streak_threshold ?? 3}"
                            class="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm">
                        <p class="text-xs text-slate-400 mt-1">Nº de aciertos consecutivos para entrar en racha</p>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Multiplicador de bonus racha</label>
                        <input type="number" id="trivial-streak-bonus" min="0" max="2" step="0.05" value="${game?.streak_bonus_percentage ?? 0.5}"
                            class="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm">
                        <p class="text-xs text-slate-400 mt-1">Ej: 0.50 = +50% de los puntos base</p>
                    </div>
                </div>

                <hr class="border-slate-100">

                <!-- Dobles Rachas -->
                <div>
                    <label class="flex items-center gap-3 cursor-pointer mb-1">
                        <input type="checkbox" id="trivial-use-double-streaks" ${game?.use_double_streaks ? 'checked' : ''} class="w-4 h-4 accent-red-500" data-admin-change="toggleTrivialDoubleStreakConfig()">
                        <span class="text-sm font-bold text-slate-700">
                            <i class="fas fa-fire text-red-500 mr-1"></i><i class="fas fa-fire text-red-500 mr-2"></i>Usar Dobles Rachas
                        </span>
                    </label>
                    <p class="text-slate-400 text-xs ml-7">Bonus adicional para jugadores que superan un umbral mayor de aciertos consecutivos</p>
                </div>

                <div id="trivialDoubleStreakConfigPanel" class="${game?.use_double_streaks ? '' : 'hidden'} grid grid-cols-2 gap-4 p-4 bg-red-50 rounded-xl border border-red-100">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Preguntas para Doble Racha</label>
                        <input type="number" id="trivial-double-threshold" min="1" max="20" value="${game?.double_streak_threshold ?? 5}"
                            class="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm">
                        <p class="text-xs text-slate-400 mt-1">Nº de aciertos consecutivos para la doble racha</p>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Multiplicador bonus doble racha</label>
                        <input type="number" id="trivial-double-bonus" min="0" max="2" step="0.05" value="${game?.double_streak_bonus_percentage ?? 1.0}"
                            class="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm">
                        <p class="text-xs text-slate-400 mt-1">Ej: 1.00 = +100% de los puntos base</p>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-2xl shadow p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-black text-slate-700">Categorías</h3>
                    <button data-admin-click="trivialAddCategory()" id="btn-add-cat"
                        class="text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-3 py-1 rounded-lg transition">
                        <i class="fas fa-plus mr-1"></i> Añadir
                    </button>
                </div>
                <div id="trivial-cats-container" class="space-y-3">
                    ${defaultCats.map((c, i) => _trivialCatRow(c, i)).join('')}
                </div>
                <p class="text-xs text-slate-400 mt-3">Mínimo 2, máximo 6 categorías.</p>
            </div>
            <div class="flex gap-3">
                <button data-admin-click="guardarTrivial(false)"
                    class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl text-lg shadow transition">
                    <i class="fas fa-save mr-2"></i> ${game ? 'Guardar cambios' : 'Crear Trivial'}
                </button>
                <button data-admin-click="guardarTrivial(true)"
                    class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl text-lg shadow-lg transition">
                    <i class="fas fa-sign-out-alt mr-2"></i> Guardar y salir
                </button>
            </div>
        </div>`);

    // Store bankOptions for dynamic add
    _trivialSyncColorOptions();
    _trivialSyncSrcOptions();
    setUnsavedChangesGuard('trivial', () => {
        const cats = Array.from(document.querySelectorAll('.trivial-cat-row')).map(r => ({
            src: r.querySelector('.cat-src-id')?.value,
            type: r.querySelector('.cat-src-type')?.value,
            color: r.querySelector('.cat-color')?.value
        }));
        return {
            name: document.getElementById('trivial-name')?.value || '',
            pin: document.getElementById('trivial-pin')?.value || '',
            use_streaks: document.getElementById('trivial-use-streaks')?.checked ?? false,
            streak_threshold: document.getElementById('trivial-streak-threshold')?.value ?? 3,
            streak_bonus_percentage: document.getElementById('trivial-streak-bonus')?.value ?? 0.5,
            use_double_streaks: document.getElementById('trivial-use-double-streaks')?.checked ?? false,
            double_streak_threshold: document.getElementById('trivial-double-threshold')?.value ?? 5,
            double_streak_bonus_percentage: document.getElementById('trivial-double-bonus')?.value ?? 1.0,
            cats: JSON.stringify(cats)
        };
    });
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

const COLOR_LABELS = {
    '#DB2777': 'Rosa',
    '#16A34A': 'Verde',
    '#2563EB': 'Azul',
    '#F59E0B': 'Ámbar',
    '#8000FF': 'Violeta',
    '#5A2E0C': 'Marrón'
};

function _trivialCatRow(cat, idx) {
    const color = cat.color || TRIVIAL_COLORS[idx % TRIVIAL_COLORS.length];
    const srcType = cat.source_type || 'bank';
    const srcId = cat.source_id || cat.bank_id;
    const colorOpts = TRIVIAL_COLORS.map(c =>
        `<option value="${c}"${c === color ? ' selected' : ''}>${COLOR_LABELS[c] || c}</option>`
    ).join('');
    const sources = (window._trivialSources || {})[srcType] || [];
    const srcOpts = sources.map(s =>
        `<option value="${s.id}"${s.id == srcId ? ' selected' : ''}>${escapeHtml(s.name)}</option>`
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
                <option value="bank"${srcType === 'bank' ? ' selected' : ''}>Banco</option>
                <option value="game"${srcType === 'game' ? ' selected' : ''}>Mezcla</option>
                <option value="custom_game"${srcType === 'custom_game' ? ' selected' : ''}>Personalizado</option>
            </select>
            <select class="cat-src-id flex-1 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                data-admin-change="trivialOnSrcIdChange(this)">
                <option value="">— Seleccionar —</option>
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
    if (count >= 6) return mostrarModalError(_t('admin.common.warning_title', null, '⚠️ Advertencia'), 'Máximo 6 categorías.', 'warning');
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
    const opts = sources.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    row.querySelector('.cat-src-id').innerHTML = _tHtml('<option value="">— Seleccionar —</option>' + opts);
    row.querySelector('.cat-name').value = '';
    _trivialSyncSrcOptions();
}

function trivialOnSrcIdChange(sel) {
    const row = sel.closest('.trivial-cat-row');
    const text = sel.options[sel.selectedIndex]?.text || '';
    row.querySelector('.cat-name').value = text === '— Seleccionar —' ? '' : text;
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
    if (container.querySelectorAll('.trivial-cat-row').length <= 2) return mostrarModalError(_t('admin.common.warning_title', null, '⚠️ Advertencia'), 'Mínimo 2 categorías.', 'warning');
    btn.closest('.trivial-cat-row').remove();
    _trivialSyncColorOptions();
    _trivialSyncSrcOptions();
    _trivialRecalcOuter();
}
