/**
 * @fileoverview Funcionalidad para mezclar bancos de preguntas
 * Módulo independiente que se integra con bancos-expanded.js
 */

// ===== VISTA PARA MEZCLAR BANCOS =====

/**
 * Muestra la interfaz para seleccionar y mezclar bancos
 */
let _mergeBancosDelegationReady = false;

async function mostrarMezclarBancos() {
    clearUnsavedChangesGuard();

    // Obtener todos los bancos con conteo de preguntas
    const res = await fetchWithAuth('/api/banks?includeCount=true');
    const bancos = await res.json();

    const area = document.getElementById('editorArea');
    area.innerHTML = _tHtml(`
        <div class="max-w-5xl mx-auto p-10">
            <!-- Botón volver -->
            <button data-merge-action="go-bancos" 
                class="mb-6 text-slate-600 hover:text-purple-600 font-bold flex items-center gap-2 transition">
                <i class="fas fa-arrow-left"></i>
                Volver a Bancos de Preguntas
            </button>
            
            <div class="bg-gradient-to-br from-purple-50 to-white rounded-2xl shadow-xl p-8 border border-purple-200">
                <div class="flex items-center gap-4 mb-8">
                    <div class="bg-gradient-to-br from-purple-600 to-purple-700 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <i class="fas fa-layer-group text-3xl"></i>
                    </div>
                    <div>
                        <h1 class="text-3xl font-black text-purple-600">Mezclar Bancos de Preguntas</h1>
                        <p class="text-slate-500">Combina preguntas de varios bancos en uno nuevo</p>
                    </div>
                </div>

                ${bancos.length < 2 ? `
                    <div class="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-center">
                        <i class="fas fa-exclamation-triangle text-yellow-600 text-4xl mb-3"></i>
                        <p class="text-yellow-800 font-bold text-lg mb-2">No hay suficientes bancos</p>
                        <p class="text-yellow-700">Necesitas al menos 2 bancos de preguntas para poder mezclarlos.</p>
                        <button data-merge-action="go-bancos" 
                            class="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-xl font-bold transition">
                            Crear Bancos
                        </button>
                    </div>
                ` : `
                    <!-- Sección de selección de bancos -->
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-black text-slate-800 uppercase">
                                <i class="fas fa-check-square text-purple-600 mr-2"></i>
                                Selecciona los Bancos a Mezclar
                            </h3>
                            <div class="flex gap-2">
                                <button data-merge-action="select-all-bancos" data-select="true"
                                    class="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1 rounded-lg font-bold transition">
                                    Seleccionar todos
                                </button>
                                <button data-merge-action="select-all-bancos" data-select="false"
                                    class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg font-bold transition">
                                    Limpiar
                                </button>
                            </div>
                        </div>

                        <div id="listaBancosSeleccion" class="space-y-2 max-h-96 overflow-y-auto">
                            ${bancos.map(banco => `
                                <label class="flex items-center gap-4 p-4 bg-slate-50 hover:bg-purple-50 rounded-xl border-2 border-slate-200 hover:border-purple-300 transition cursor-pointer group">
                                    <input type="checkbox" 
                                        class="banco-checkbox w-5 h-5 text-purple-600 rounded focus:ring-purple-500" 
                                        data-bank-id="${banco.id}"
                                        data-bank-name="${banco.name.replace(/"/g, '&quot;')}"
                                        data-question-count="${banco.question_count || 0}"
                                        data-merge-action="selection-changed">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-3 mb-1">
                                            <span class="font-bold text-slate-900 group-hover:text-purple-700 transition">${banco.name}</span>
                                            ${banco.pin ? `<span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-mono font-bold">${banco.pin}</span>` : ''}
                                        </div>
                                        <div class="text-xs text-slate-500">
                                            <i class="fas fa-question-circle mr-1"></i>
                                            ${banco.question_count || 0} pregunta${(banco.question_count || 0) === 1 ? '' : 's'}
                                        </div>
                                    </div>
                                </label>
                            `).join('')}
                        </div>

                        <!-- Resumen de selección -->
                        <div id="resumenSeleccion" class="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200 hidden">
                            <div class="flex items-center justify-between">
                                <div>
                                    <span class="text-sm font-bold text-purple-900">
                                        <i class="fas fa-info-circle mr-1"></i>
                                        <span id="numBancosSeleccionados">0</span> banco(s) seleccionado(s)
                                    </span>
                                    <span class="mx-2 text-purple-400">•</span>
                                    <span class="text-sm font-bold text-purple-900">
                                        Total: <span id="totalPreguntasMezcla">0</span> preguntas
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Configuración del nuevo banco -->
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <h3 class="text-lg font-black text-slate-800 uppercase mb-4">
                            <i class="fas fa-cog text-purple-600 mr-2"></i>
                            Configuración del Nuevo Banco
                        </h3>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label class="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">
                                    Nombre del Nuevo Banco
                                </label>
                                <input type="text" 
                                    id="mergeNewBankName" 
                                    class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-purple-500 outline-none transition" 
                                    placeholder="Ej: Banco Combinado 2025">
                            </div>
                            <div>
                                <label class="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">
                                    PIN del Nuevo Banco (opcional)
                                </label>
                                <input type="text" 
                                    id="mergeNewBankPin" 
                                    maxlength="10" 
                                    class="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-purple-500 outline-none transition font-mono" 
                                    placeholder="Ej: MEZCLA25">
                                <p class="text-xs text-slate-400 mt-1">
                                    <i class="fas fa-info-circle mr-1"></i>
                                    Si lo dejas vacío, se generará automáticamente
                                </p>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" 
                                    id="mergeVisibleToPresenter" 
                                    checked 
                                    class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500">
                                <span class="text-sm font-bold text-slate-700">
                                    <i class="fas fa-eye mr-2"></i>Mostrar al presentador
                                </span>
                            </label>
                        </div>

                        <!-- Configuración de rachas -->
                        <div class="border-t border-slate-200 pt-4 mt-4">
                            <div class="flex items-center justify-between mb-2">
                                <div>
                                    <span class="text-sm font-bold text-slate-700">
                                        <i class="fas fa-fire text-orange-500 mr-2"></i>Activar Rachas
                                    </span>
                                    <p class="text-xs text-slate-500 mt-0.5">Bonus por respuestas correctas consecutivas</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="mergeUseStreaks" class="sr-only peer" data-merge-action="toggle-streaks">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                            </div>
                            <div id="mergeStreakConfigPanel" class="hidden mt-3 p-4 bg-orange-50 rounded-xl border border-orange-100 grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Umbral</label>
                                    <input type="number" id="mergeStreakThreshold" value="3" min="1" max="20" 
                                        class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-orange-400 outline-none text-sm">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Bonus (%)</label>
                                    <input type="number" id="mergeStreakBonusPercentage" value="0.50" min="0" max="2" step="0.05" 
                                        class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-orange-400 outline-none text-sm">
                                </div>
                            </div>

                            <div class="flex items-center justify-between mt-4 mb-2">
                                <div>
                                    <span class="text-sm font-bold text-slate-700">
                                        <i class="fas fa-fire-alt text-red-500 mr-2"></i>Activar Dobles Rachas
                                    </span>
                                    <p class="text-xs text-slate-500 mt-0.5">Bonus adicional por rachas más largas</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="mergeUseDoubleStreaks" class="sr-only peer" data-merge-action="toggle-double-streaks">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                            </div>
                            <div id="mergeDoubleStreakConfigPanel" class="hidden mt-3 p-4 bg-red-50 rounded-xl border border-red-100 grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Umbral Doble</label>
                                    <input type="number" id="mergeDoubleStreakThreshold" value="5" min="1" max="20" 
                                        class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-red-400 outline-none text-sm">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Bonus Doble (%)</label>
                                    <input type="number" id="mergeDoubleStreakBonusPercentage" value="1.00" min="0" max="2" step="0.05" 
                                        class="w-full p-2 border-2 border-slate-100 rounded-lg focus:border-red-400 outline-none text-sm">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Botón de acción -->
                    <div class="flex justify-center">
                        <button data-merge-action="execute-merge" 
                            class="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-12 py-5 rounded-2xl font-black text-xl shadow-2xl transition-all transform hover:scale-105 flex items-center gap-3">
                            <i class="fas fa-layer-group text-2xl"></i>
                            Crear Banco Mezclado
                        </button>
                    </div>
                `}
            </div>
        </div>
    `);
}

// ===== FUNCIONES AUXILIARES =====

/**
 * Selecciona o deselecciona todos los bancos
 */
function seleccionarTodosBancos(seleccionar) {
    const checkboxes = document.querySelectorAll('.banco-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = seleccionar;
    });
    actualizarResumenMezcla();
}

/**
 * Actualiza el resumen de bancos seleccionados
 */
function actualizarResumenMezcla() {
    const checkboxes = document.querySelectorAll('.banco-checkbox:checked');
    const numSeleccionados = checkboxes.length;

    let totalPreguntas = 0;
    checkboxes.forEach(checkbox => {
        totalPreguntas += parseInt(checkbox.dataset.questionCount) || 0;
    });

    const resumen = document.getElementById('resumenSeleccion');
    const numBancosSpan = document.getElementById('numBancosSeleccionados');
    const totalPreguntasSpan = document.getElementById('totalPreguntasMezcla');

    if (numSeleccionados > 0) {
        resumen.classList.remove('hidden');
        numBancosSpan.textContent = _t(numSeleccionados);
        totalPreguntasSpan.textContent = _t(totalPreguntas);
    } else {
        resumen.classList.add('hidden');
    }
}

/**
 * Toggle de configuración de rachas
 */
function toggleMergeStreakConfig() {
    const panel = document.getElementById('mergeStreakConfigPanel');
    const checked = document.getElementById('mergeUseStreaks').checked;
    if (panel) panel.classList.toggle('hidden', !checked);
}

/**
 * Toggle de configuración de dobles rachas
 */
function toggleMergeDoubleStreakConfig() {
    const panel = document.getElementById('mergeDoubleStreakConfigPanel');
    const checked = document.getElementById('mergeUseDoubleStreaks').checked;
    if (panel) panel.classList.toggle('hidden', !checked);
}

/**
 * Ejecuta la mezcla de bancos
 */
async function ejecutarMezclaBancos() {
    // Obtener bancos seleccionados
    const checkboxes = document.querySelectorAll('.banco-checkbox:checked');
    const bankIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.bankId));

    // Obtener configuración
    const name = document.getElementById('mergeNewBankName').value.trim();
    const pin = document.getElementById('mergeNewBankPin').value.trim();
    const visibleToPresenter = document.getElementById('mergeVisibleToPresenter').checked;
    const useStreaks = document.getElementById('mergeUseStreaks').checked;
    const streakThreshold = parseInt(document.getElementById('mergeStreakThreshold').value) || 3;
    const streakBonusPercentage = parseFloat(document.getElementById('mergeStreakBonusPercentage').value) || 0.50;
    const useDoubleStreaks = document.getElementById('mergeUseDoubleStreaks').checked;
    const doubleStreakThreshold = parseInt(document.getElementById('mergeDoubleStreakThreshold').value) || 5;
    const doubleStreakBonusPercentage = parseFloat(document.getElementById('mergeDoubleStreakBonusPercentage').value) || 1.00;

    // Validaciones
    if (bankIds.length < 2) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.merge.error_select', null, 'Debes seleccionar al menos 2 bancos para mezclar'), 'warning');
        return;
    }

    if (!name) {
        mostrarModalError(_t('admin.common.validation_title', null, '⚠️ Validación'), _t('admin.merge.error_name', null, 'Por favor, introduce un nombre para el nuevo banco'), 'warning');
        return;
    }

    const bankNames = Array.from(checkboxes).map(cb => cb.dataset.bankName).join(', ');
    const totalPreguntas = Array.from(checkboxes).reduce((sum, cb) => sum + parseInt(cb.dataset.questionCount), 0);

    mostrarModalConfirmacion(
        _t('admin.merge.confirm_title', null, '🔀 Confirmar Mezcla'),
        `¿Deseas crear un nuevo banco "${name}" mezclando estos ${bankIds.length} bancos?\n\nBancos: ${bankNames}\n\nTotal de preguntas: ${totalPreguntas}\n\nLos bancos originales no se modificarán.`,
        async () => {
            try {
                // Mostrar indicador de carga
                const loadingDiv = document.createElement('div');
                loadingDiv.id = 'merge-loading';
                loadingDiv.className = 'fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center';
                loadingDiv.innerHTML = _tHtml(`
                    <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
                        <div class="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <h3 class="text-xl font-bold text-slate-800 mb-2">Mezclando bancos...</h3>
                        <p class="text-slate-600">Por favor espera mientras se crea el nuevo banco</p>
                    </div>
                `);
                document.body.appendChild(loadingDiv);

                // Realizar la petición
                const response = await fetchWithAuth('/api/banks/merge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bankIds,
                        name,
                        pin: pin || null,
                        visible_to_presenter: visibleToPresenter,
                        use_streaks: useStreaks,
                        streak_threshold: streakThreshold,
                        streak_bonus_percentage: streakBonusPercentage,
                        use_double_streaks: useDoubleStreaks,
                        double_streak_threshold: doubleStreakThreshold,
                        double_streak_bonus_percentage: doubleStreakBonusPercentage
                    })
                });

                loadingDiv.remove();

                if (response.ok) {
                    const data = await response.json();
                    mostrarModalError(
                        _t('admin.common.success_title', null, '✅ Éxito'),
                        `¡Banco "${name}" creado exitosamente!\n\nPIN: ${data.pin}\nTotal de preguntas: ${data.totalQuestions}\n\nLos bancos originales permanecen sin cambios.`,
                        'success'
                    );
                    setTimeout(() => { mostrarVista('bancos'); }, 2000);
                } else {
                    const error = await response.json();
                    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), error.message || error.error || _t('admin.merge.error_failed', null, 'Error al mezclar bancos'), 'error');
                }
            } catch (error) {
                console.error('Error al mezclar bancos:', error);
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), _t('admin.common.error_server', null, 'Error de conexión con el servidor'), 'error');
            }
        },
        null,
        _t('admin.merge.btn_create', null, 'Crear Banco Mezclado'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

function _initMergeBancosDelegation() {
    if (_mergeBancosDelegationReady) return;
    _mergeBancosDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-merge-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.mergeAction;
        switch (action) {
            case 'go-bancos':
                if (typeof mostrarVista === 'function') mostrarVista('bancos');
                break;
            case 'select-all-bancos':
                seleccionarTodosBancos(actionElement.dataset.select === 'true');
                break;
            case 'execute-merge':
                ejecutarMezclaBancos();
                break;
            default:
                break;
        }
    });

    document.addEventListener('change', (event) => {
        const actionElement = event.target.closest('[data-merge-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.mergeAction;
        if (action === 'selection-changed') {
            actualizarResumenMezcla();
            return;
        }
        if (action === 'toggle-streaks') {
            toggleMergeStreakConfig();
            return;
        }
        if (action === 'toggle-double-streaks') {
            toggleMergeDoubleStreakConfig();
        }
    });
}

_initMergeBancosDelegation();
