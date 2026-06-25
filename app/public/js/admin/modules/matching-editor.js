/**
 * @fileoverview Editor de pares para preguntas tipo "matching" (Emparejar)
 * Genera el HTML del editor de pares y gestiona añadir/eliminar pares.
 * Exporta: renderMatchingEditor, añadirPar, eliminarPar
 */

/**
 * Renderiza el editor de pares para una pregunta tipo matching.
 * Cada par tiene: item izquierdo (option_text fijo) y par derecho (match_value).
 *
 * @param {number} qIdx    - Índice de la pregunta en preguntasData
 * @param {Array}  options - Array de opciones de la pregunta
 * @returns {string} HTML del editor
 */
function renderMatchingEditor(qIdx, options) {
    const pairs = options || [];
    const canDelete = pairs.length > 2;
    const canAdd = pairs.length < 6;

    const pairRows = pairs.map((opt, oIdx) => `
        <div class="flex items-center gap-3 mb-2" data-pair="${oIdx}">
            <span class="text-xs font-bold text-slate-400 w-4">${oIdx + 1}</span>
            <input
                type="text"
                value="${escapeHtml(opt.optionText || '')}"
                data-admin-change="actualizarPar(${qIdx}, ${oIdx}, 'left', this.value)"
                placeholder="Elemento izquierdo"
                class="flex-1 p-2 border-2 border-slate-100 rounded-xl focus:border-purple-500 outline-none text-sm font-medium"
            >
            <span class="text-slate-300 font-bold">↔</span>
            <input
                type="text"
                value="${escapeHtml(opt.match_value || '')}"
                data-admin-change="actualizarPar(${qIdx}, ${oIdx}, 'right', this.value)"
                placeholder="Par correcto"
                class="flex-1 p-2 border-2 border-slate-100 rounded-xl focus:border-purple-500 outline-none text-sm font-medium"
            >
            ${canDelete ? `
                <button data-admin-click="eliminarPar(${qIdx}, ${oIdx})"
                    class="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                    <i class="fas fa-times text-xs"></i>
                </button>
            ` : '<span class="w-8"></span>'}
        </div>
    `).join('');

    return `
        <div class="mt-4">
            <div class="flex items-center justify-between mb-3">
                <div class="flex gap-8 flex-1">
                    <span class="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex-1 pl-7">
                        Columna Izquierda (fija)
                    </span>
                    <span class="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex-1">
                        Columna Derecha (par correcto)
                    </span>
                </div>
            </div>
            <div id="matchingPairs-${qIdx}">
                ${pairRows}
            </div>
            ${canAdd ? `
                <button data-admin-click="añadirPar(${qIdx})"
                    class="mt-2 text-purple-600 hover:text-purple-800 text-xs font-bold flex items-center gap-1 transition">
                    <i class="fas fa-plus-circle"></i> Añadir par
                </button>
            ` : `
                <p class="mt-2 text-xs text-slate-400 italic">
                    <i class="fas fa-lock mr-1"></i>Máximo 6 pares alcanzado
                </p>
            `}
        </div>
    `;
}

/**
 * Añade un par vacío a la pregunta matching indicada.
 * @param {number} qIdx
 */
function añadirPar(qIdx) {
    const q = preguntasData[qIdx];
    if (!q || !Array.isArray(q.options)) return;
    if (q.options.length >= 6) return;
    q.options.push({
        optionText: '',
        match_value: '',
        isCorrect: false,
        order_index: q.options.length
    });
    dibujarPreguntas();
}

/**
 * Elimina un par de la pregunta matching indicada.
 * Mínimo 2 pares permitidos.
 * @param {number} qIdx
 * @param {number} oIdx
 */
function eliminarPar(qIdx, oIdx) {
    const q = preguntasData[qIdx];
    if (!q || !Array.isArray(q.options) || q.options.length <= 2) return;
    q.options.splice(oIdx, 1);
    // Recalcular order_index
    q.options.forEach((opt, i) => { opt.order_index = i; });
    dibujarPreguntas();
}

/**
 * Actualiza el valor de un lado del par en preguntasData.
 * @param {number} qIdx
 * @param {number} oIdx
 * @param {'left'|'right'} side
 * @param {string} value
 */
function actualizarPar(qIdx, oIdx, side, value) {
    const q = preguntasData[qIdx];
    if (!q || !q.options[oIdx]) return;
    if (side === 'left') {
        q.options[oIdx].optionText = value;
    } else {
        q.options[oIdx].match_value = value;
    }
}

/**
 * Escapa caracteres HTML para evitar XSS en valores de atributos.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
