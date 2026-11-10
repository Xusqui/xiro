/**
 * @fileoverview Editor de pares para preguntas tipo "matching" (Emparejar)
 * Genera el HTML del editor de pares y gestiona añadir/eliminar pares.
 * Exporta: renderMatchingEditor, matchingEditorSectionHtml, añadirPar, eliminarPar, actualizarPar
 */

/** Una fila de par: número, lado izquierdo, ↔, lado derecho y quitar. */
function _matchingPairHtml(qIdx, opt, oIdx, canDelete) {
    const n = oIdx + 1;
    const left = _t('admin.matching.pair_left', { n }, 'Par {n}, columna izquierda');
    const right = _t('admin.matching.pair_right', { n }, 'Par {n}, columna derecha');
    const remove = _t('admin.matching.pair_remove', { n }, 'Quitar el par {n}');
    return `
                            <div class="xq-pair">
                                <span class="xq-num" aria-hidden="true">${n}</span>
                                <input type="text" id="pair-left-${qIdx}-${oIdx}" class="xq-field" value="${escapeHtml(opt.optionText || '')}" aria-label="${left}"
                                    placeholder="${_t('admin.matching.ph_left', null, 'Elemento izquierdo')}" data-admin-change="actualizarPar(${qIdx}, ${oIdx}, 'left', this.value)">
                                <span class="xq-pair__arrow" aria-hidden="true">↔</span>
                                <input type="text" id="pair-right-${qIdx}-${oIdx}" class="xq-field" value="${escapeHtml(opt.match_value || '')}" aria-label="${right}"
                                    placeholder="${_t('admin.matching.ph_right', null, 'Par correcto')}" data-admin-change="actualizarPar(${qIdx}, ${oIdx}, 'right', this.value)">
                                ${canDelete ? optionIconButtonHtml(`pair-del-${qIdx}-${oIdx}`, `eliminarPar(${qIdx}, ${oIdx})`, 'fa-xmark', remove) : '<span class="xq-pair__spacer"></span>'}
                            </div>`;
}

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
    const add = pairs.length < 6
        ? `<button type="button" id="pair-add-${qIdx}" data-admin-click="añadirPar(${qIdx})" class="xq-btn xq-btn--dashed">
                                <i class="fas fa-plus-circle" aria-hidden="true"></i> ${_t('admin.matching.btn_add', null, 'Añadir par')}</button>`
        : `<p class="xq-hint"><i class="fas fa-lock" aria-hidden="true"></i> ${_t('admin.matching.max_pairs', null, 'Máximo 6 pares alcanzado')}</p>`;
    return `
                        <div class="xq-pairs">
                            <div class="xq-pair xq-pair--head" aria-hidden="true">
                                <span></span><span class="xq-label">${_t('admin.matching.label_left', null, 'Columna izquierda (fija)')}</span>
                                <span></span><span class="xq-label">${_t('admin.matching.label_right', null, 'Columna derecha (par correcto)')}</span><span></span>
                            </div>
                            ${pairs.map((opt, oIdx) => _matchingPairHtml(qIdx, opt, oIdx, canDelete)).join('')}
                        </div>
                        ${add}`;
}

/** Emparejar: sección de la tarjeta (questionTypeSectionHtml). */
function matchingEditorSectionHtml(q, qIdx) {
    const help = questionHelpHtml(q, [
        _t('admin.matching.help_left', null, 'Columna izquierda: fija, no se puede arrastrar'),
        _t('admin.matching.help_right', null, 'Columna derecha: el jugador la reordena arrastrando'),
        _t('admin.matching.help_points', null, 'Puntuación: 20 pts por cada par correcto'),
        _t('admin.matching.help_streak', null, 'Racha: con todos los pares suma, con la mitad o más se mantiene y con menos se reinicia')
    ]);
    return questionSectionHtml(
        _t('admin.matching.section_title', null, 'Pares'),
        _t('admin.matching.hint', null, 'Escribe cada elemento junto a su pareja correcta; el jugador verá la columna derecha desordenada.'),
        renderMatchingEditor(qIdx, q.options) + help
    );
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
    setQuestionFocus(`pair-left-${qIdx}-${q.options.length - 1}`);
    dibujarPregunta(qIdx);
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
    q.options.forEach((opt, i) => {
        opt.order_index = i;
    });
    setQuestionFocus(q.options.length > 2 ? `pair-del-${qIdx}-${Math.min(oIdx, q.options.length - 1)}` : `pair-add-${qIdx}`);
    dibujarPregunta(qIdx);
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
