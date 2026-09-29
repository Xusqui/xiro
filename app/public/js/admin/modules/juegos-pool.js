/**
 * @fileoverview Modo "pool" para bancos sin cantidad fija en Mezcla de Preguntas.
 * Bancos marcados como pool se combinan y aportan un número total de
 * preguntas configurable a nivel de juego (games.pool_question_count),
 * en vez de una cuota fija por banco.
 */

let poolQuestionCountInicial = null;

function bancoEsPool(gb) {
    return gb.question_count === null || gb.question_count === undefined;
}

function toggleBancoPool(idx) {
    const checked = document.getElementById(`bancoPoolCheckbox${idx}`)?.checked ?? false;
    currentBanks[idx].question_count = checked ? null : 1;
    dibujarBancosJuego();
}

function renderPoolCheckboxHtml(gb, idx, totalQuestions) {
    const isPool = bancoEsPool(gb);
    return `
        <div class="w-40">
            <label class="flex items-center gap-2 mb-1 cursor-pointer">
                <input type="checkbox" id="bancoPoolCheckbox${idx}" ${isPool ? 'checked' : ''} data-admin-change="toggleBancoPool(${idx})" class="w-4 h-4 text-purple-600 rounded">
                <span class="text-[10px] font-bold uppercase text-slate-400 tracking-widest">${_t('admin.games.pool_toggle_label', null, 'Sin cantidad fija')}</span>
            </label>
            ${isPool
        ? `<div class="p-2 bg-purple-50 border-2 border-purple-200 rounded-lg text-center text-purple-600 text-xs font-bold">${_t('admin.games.pool_badge', null, 'Pool compartido')}</div>`
        : `<label class="block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest">${_t('admin.games.quantity_label', null, 'Cantidad')}</label>
                <input type="number" min="1" max="${totalQuestions}" value="${Math.min(gb.question_count, totalQuestions)}" data-admin-change="currentBanks[${idx}].question_count = parseInt(this.value)" class="w-full p-2 border-2 border-slate-100 rounded-lg text-sm font-medium text-center">`}
        </div>
    `;
}

function dibujarSeccionPool() {
    const wrapper = document.getElementById('poolTotalWrapper');
    if (!wrapper) return;

    if (!currentBanks.some(bancoEsPool)) {
        wrapper.innerHTML = '';
        return;
    }

    const valorActual = document.getElementById('gamePoolQuestionCount')?.value || poolQuestionCountInicial || '';
    wrapper.innerHTML = _tHtml(`
        <div class="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 mt-4">
            <label class="block text-[10px] font-bold uppercase text-purple-500 mb-2 tracking-widest">${_t('admin.games.pool_total_label', null, 'Total de preguntas del pool')}</label>
            <input type="number" id="gamePoolQuestionCount" min="1" value="${valorActual}" class="w-32 p-2 border-2 border-purple-200 rounded-lg text-sm font-medium text-center">
            <p class="text-purple-400 text-xs mt-2">${_t('admin.games.pool_total_help', null, 'Cuántas preguntas en total se sacan al azar de los bancos marcados como "sin cantidad fija", combinados entre sí.')}</p>
        </div>
    `);
}

function obtenerPoolQuestionCount() {
    if (!currentBanks.some(bancoEsPool)) return null;
    const raw = document.getElementById('gamePoolQuestionCount')?.value;
    return raw ? parseInt(raw, 10) : null;
}

function validarConfigPool(banks, poolQuestionCount) {
    const hasPoolBank = banks.some(bancoEsPool);
    if (hasPoolBank && (!poolQuestionCount || poolQuestionCount < 1)) {
        return _t('admin.games.error_pool_count', null, 'Indica cuántas preguntas se sacan del pool compartido');
    }
    return null;
}
