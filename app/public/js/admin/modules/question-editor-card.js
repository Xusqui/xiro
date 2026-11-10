// Editor de preguntas del admin (dibujarPreguntas, en helpers.js): valores por defecto
// de cada pregunta y tarjeta común. Orden de la tarjeta: cabecera (número, tipo, resumen
// y acciones), tipo, enunciado, respuestas (sección propia del tipo) y "Más opciones"
// (imagen, tiempo y multimedia, en question-editor-media.js), de lo esencial a lo opcional.
// El selector de tipo está en question-type-picker.js; las secciones de cada tipo, en
// question-editor-options.js, question-editor-numeric.js y los editores de cada tipo.
// Estilos en css/admin-question-editor.css.

/** Completa en la propia pregunta los campos que el editor necesita. */
function normalizeQuestionDefaults(q) {
    if (!q.tipo_contenido) q.tipo_contenido = 'texto';
    if (!q.url_recurso) q.url_recurso = null;
    if (q.question_image_url === undefined) q.question_image_url = null;
    if (!q.time_limit) q.time_limit = getDefaultQuestionTimeLimit();
    if (!q.type) q.type = 'quiz';
    if (q.type === 'numeric_approximation') {
        q.toleranceMode = q.toleranceMode || 'hybrid';
        q.toleranceValue = Number(q.toleranceValue) || 25;
        if (q.toleranceCap === undefined) q.toleranceCap = 1000;
        // El servidor exige puntos máximos; sin valor no se podría guardar nunca
        if (q.maxPoints == null) q.maxPoints = 100;
    }
    if (q.type === 'order' || q.type === 'matching' || q.type === 'word_search') {
        ensureOrderIndexes(q);
    }
}

/** Nombre corto del tipo, traducido (el de la rejilla de tipos). */
function questionTypeName(type) {
    const fallback = QUESTION_TYPE_PICKER.find(t => t.type === type)?.name || String(type || '').replace(/_/g, ' ');
    return _t(`admin.q.type_${type}_short`, null, fallback);
}

/** Resumen de la cabecera plegada: enunciado y cuántas respuestas tiene. */
function _questionSummaryHtml(q) {
    const text = String(q.questionText || '').trim();
    const statement = text
        ? escapeHtml(text)
        : `<em class="xq-card__missing">${_t('admin.q.summary_no_statement', null, 'Sin enunciado')}</em>`;
    const count = Array.isArray(q.options) ? q.options.length : 0;
    const extra = count ? ` · ${_t('admin.q.summary_answers', { n: count }, 'Respuestas: {n}')}` : '';
    return `<span class="xq-card__summary">${statement}${extra}</span>`;
}

/** Botón de acción de la cabecera: { id, action, icon, label, danger?, disabled? } */
function _questionActionHtml({ id, action, icon, label, danger = false, disabled = false }) {
    return `<button type="button" id="${id}" class="xq-iconbtn${danger ? ' xq-iconbtn--danger' : ''}" data-admin-click="${action}"
                            aria-label="${label}" title="${label}"${disabled ? ' disabled' : ''}><i class="fas ${icon}" aria-hidden="true"></i></button>`;
}

/** Cabecera de la tarjeta: botón de plegar (número, tipo, resumen) y acciones. */
function questionCardHeadHtml(q, qIdx) {
    const n = qIdx + 1;
    const total = Array.isArray(globalThis.preguntasData) ? globalThis.preguntasData.length : n;
    const collapsed = isQuestionCollapsed(q);
    const label = _t('admin.q.card_title', { n }, 'Pregunta {n}');
    return `
                    <header class="xq-card__head">
                        <button type="button" id="q-toggle-${qIdx}" class="xq-card__toggle" aria-expanded="${!collapsed}" aria-controls="q-body-${qIdx}"
                            data-admin-click="alternarPreguntaPlegada(${qIdx})">
                            <i class="fas fa-chevron-down xq-card__chevron" aria-hidden="true"></i>
                            <span class="xq-card__num" id="q-title-${qIdx}">${label}</span>
                            <span class="xq-chip">${questionTypeName(q.type)}</span>
                            ${_questionSummaryHtml(q)}
                        </button>
                        <div class="xq-card__actions">
                            ${_questionActionHtml({ id: `q-up-${qIdx}`, action: `moverPregunta(${qIdx}, -1)`, icon: 'fa-arrow-up', label: _t('admin.q.move_up', { n }, 'Subir la pregunta {n}'), disabled: qIdx === 0 })}
                            ${_questionActionHtml({ id: `q-down-${qIdx}`, action: `moverPregunta(${qIdx}, 1)`, icon: 'fa-arrow-down', label: _t('admin.q.move_down', { n }, 'Bajar la pregunta {n}'), disabled: qIdx >= total - 1 })}
                            ${_questionActionHtml({ id: `q-dup-${qIdx}`, action: `duplicarPregunta(${qIdx})`, icon: 'fa-copy', label: _t('admin.q.duplicate', { n }, 'Duplicar la pregunta {n}') })}
                            ${_questionActionHtml({ id: `q-del-${qIdx}`, action: `eliminarPregunta(${qIdx})`, icon: 'fa-trash-alt', label: _t('admin.q.delete_n', { n }, 'Eliminar la pregunta {n}'), danger: true })}
                        </div>
                    </header>`;
}

/** Enunciado: en «Completa la frase» se escribe en su propia sección, con los corchetes. */
function questionStatementHtml(q, qIdx) {
    const label = _t('admin.q.label', null, 'Enunciado de la pregunta');
    if (q.type === 'fill_blanks') {
        return `
                    <div>
                        <p class="xq-label">${label}</p>
                        <p class="xq-hint">${_t('admin.q.fillblanks_statement_note', null, 'La frase se escribe más abajo, con las palabras a adivinar entre corchetes.')}</p>
                    </div>`;
    }
    const placeholder = escapeHtml(_t('admin.q.statement_placeholder', null, 'Escribe aquí la pregunta'));
    return `
                    <div>
                        <label class="xq-label" for="q-text-${qIdx}">${label}</label>
                        <textarea id="q-text-${qIdx}" rows="1" class="xq-field xq-field--statement" data-autogrow data-single-line
                            data-admin-input="preguntasData[${qIdx}].questionText = this.value" placeholder="${placeholder}">${escapeHtml(q.questionText || '')}</textarea>
                    </div>`;
}

/** Aviso de validación de esta pregunta (lo pone la barra de guardado al fallar). */
function questionErrorHtml(q, qIdx) {
    const problem = getQuestionError(q);
    if (!problem) return '';
    return `
                    <p class="xq-error" id="q-error-${qIdx}" role="alert">
                        <i class="fas fa-circle-exclamation" aria-hidden="true"></i><span>${escapeHtml(problem.message)}</span>
                    </p>`;
}

/** HTML de la tarjeta de una pregunta en el editor. */
function questionCardHtml(q, qIdx) {
    const collapsed = isQuestionCollapsed(q);
    const state = (collapsed ? '' : ' xq-card--open') + (getQuestionError(q) ? ' xq-card--invalid' : '');
    const isHybridToleranceMode = (q.toleranceMode || 'hybrid') === 'hybrid';
    return `
                <article class="xq-card${state}" id="q-card-${qIdx}" data-q-idx="${qIdx}" data-type="${escapeHtml(q.type)}" aria-labelledby="q-title-${qIdx}">
                    ${questionCardHeadHtml(q, qIdx)}
                    <div class="xq-card__body" id="q-body-${qIdx}"${collapsed ? ' hidden' : ''}>
                        ${questionErrorHtml(q, qIdx)}
                        ${questionTypePickerHtml(q, qIdx)}
                        ${questionStatementHtml(q, qIdx)}
                        ${questionTypeSectionHtml(q, qIdx, isHybridToleranceMode)}
                        ${questionMoreOptionsHtml(q, qIdx)}
                    </div>
                </article>`;
}
