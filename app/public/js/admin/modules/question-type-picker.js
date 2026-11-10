// Selector del tipo de pregunta en el editor de bancos (questionCardHtml, en
// question-editor-card.js): una rejilla de radios en lugar del antiguo <select>.
// Estilos en css/admin-question-type-picker.css; el color de cada tipo sale de
// su data-type, el mismo color que su chip en la lista.

// Orden de lectura en 5x2: elegir respuesta (quiz, múltiple y las dos encuestas),
// ordenar o estimar, y palabras. En contenedores estrechos pasa a 2 columnas.
const QUESTION_TYPE_PICKER = [
    { type: 'quiz', icon: 'fa-check', name: 'Quiz', hint: 'Una respuesta correcta' },
    {
        type: 'multiple_choice',
        icon: 'fa-list-check',
        name: 'Selección múltiple',
        hint: 'De 1 a 6 respuestas correctas'
    },
    { type: 'survey', icon: 'fa-square-poll-vertical', name: 'Encuesta', hint: 'Votos, sin respuesta correcta' },
    {
        type: 'survey_multiple',
        icon: 'fa-square-poll-horizontal',
        name: 'Encuesta de selección múltiple',
        hint: 'Varias respuestas por jugador'
    },
    { type: 'order', icon: 'fa-list-ol', name: 'Ordena', hint: 'Arrastrar al orden correcto' },
    { type: 'matching', icon: 'fa-right-left', name: 'Emparejar', hint: 'Unir dos columnas' },
    { type: 'numeric_approximation', icon: 'fa-bullseye', name: 'Numérica', hint: 'Acercarse a un número' },
    { type: 'word_scramble', icon: 'fa-shuffle', name: 'Anagrama', hint: 'Descifrar la palabra' },
    { type: 'word_search', icon: 'fa-table-cells', name: 'Sopa de letras', hint: 'Encontrar las palabras' },
    { type: 'fill_blanks', icon: 'fa-i-cursor', name: 'Completa la frase', hint: 'Rellenar los huecos' }
];

// Tipos que sustituyen las opciones al elegirlos (ver cambiarTipoPregunta y
// applyWordTypeDefaults en helpers.js). Los demás conservan las opciones que haya.
const TYPES_THAT_RESET_OPTIONS = new Set([
    'numeric_approximation',
    'matching',
    'word_scramble',
    'word_search',
    'fill_blanks'
]);

/** Botón que abre o cierra la rejilla (el mismo id en los dos estados: el foco no se pierde). */
function _typePickerToggleHtml(qIdx, open) {
    const label = open
        ? _t('admin.q.type_picker_close', null, 'Ocultar tipos')
        : _t('admin.q.type_picker_open', null, 'Cambiar tipo');
    return `<button type="button" id="qtype-toggle-${qIdx}" class="xq-link" aria-expanded="${open}" aria-controls="qtype-grid-${qIdx}"
                            data-admin-click="alternarSelectorTipo(${qIdx})">${label}</button>`;
}

/**
 * Tipo de una pregunta. Ya elegido, es una línea con el tipo y "Cambiar tipo": la
 * rejilla de 10 baldosas solo se abre en preguntas nuevas o al pedirla.
 */
function questionTypePickerHtml(q, qIdx) {
    if (!isTypePickerOpen(q)) {
        const entry = QUESTION_TYPE_PICKER.find(t => t.type === q.type);
        const hint = entry ? _t(`admin.q.type_${q.type}_hint`, null, entry.hint) : '';
        return `
                    <div class="xq-typebar">
                        <span class="xq-label xq-typebar__label">${_t('admin.q.type_label', null, 'Tipo de pregunta')}</span>
                        <span class="xq-typebar__name"><i class="fas ${entry?.icon || 'fa-question'}" aria-hidden="true"></i>${questionTypeName(q.type)}</span>
                        ${hint ? `<span class="xq-typebar__hint">${hint}</span>` : ''}
                        ${_typePickerToggleHtml(qIdx, false)}
                    </div>`;
    }
    return _typePickerGridHtml(q, qIdx);
}

function _typePickerGridHtml(q, qIdx) {
    const tiles = QUESTION_TYPE_PICKER.map(({ type, icon, name, hint }) => {
        const id = `qtype-${qIdx}-${type}`;
        return `
                            <label class="xq-type__tile" data-type="${type}" for="${id}">
                                <input type="radio" class="xq-type__input" id="${id}" name="qtype-${qIdx}" value="${type}"${q.type === type ? ' checked' : ''}
                                    data-admin-change="solicitarCambioTipo(${qIdx}, this.value)" aria-describedby="${id}-hint">
                                <span class="xq-type__pit" aria-hidden="true"><span class="xq-type__dot"></span></span>
                                <i class="fas ${icon} xq-type__icon" aria-hidden="true"></i>
                                <span class="xq-type__text">
                                    <span class="xq-type__name">${_t(`admin.q.type_${type}_short`, null, name)}</span>
                                    <span class="xq-type__hint" id="${id}-hint">${_t(`admin.q.type_${type}_hint`, null, hint)}</span>
                                </span>
                            </label>`;
    }).join('');
    return `
                    <fieldset class="xq-type">
                        <legend class="xq-type__legend">${_t('admin.q.type_label', null, 'Tipo de pregunta')}</legend>
                        <div class="xq-type__grid" id="qtype-grid-${qIdx}">${tiles}
                        </div>
                        <div class="xq-type__foot">${_typePickerToggleHtml(qIdx, true)}</div>
                    </fieldset>`;
}

/** Abre o cierra la rejilla de tipos de una pregunta. */
function alternarSelectorTipo(qIdx) {
    const q = preguntasData[qIdx];
    if (!q) return;
    const open = !isTypePickerOpen(q);
    setTypePickerOpen(q, open);
    // Al abrir, el foco va al tipo elegido (las flechas recorren la rejilla)
    if (open) setQuestionFocus(`qtype-${qIdx}-${q.type}`);
    dibujarPregunta(qIdx);
}

/** true si pasar la pregunta a newType tiraría opciones con texto ya escrito. */
function typeChangeDiscardsAnswers(q, newType) {
    if (!q || q.type === newType || !TYPES_THAT_RESET_OPTIONS.has(newType)) return false;
    const options = Array.isArray(q.options) ? q.options : [];
    return options.some(o => String(o?.optionText ?? '').trim() || String(o?.match_value ?? '').trim());
}

/**
 * Cambia el tipo de una pregunta desde la rejilla. Si el cambio borraría
 * respuestas ya escritas, pide confirmación; al cancelar se repinta con el
 * tipo anterior y el foco vuelve a su radio.
 */
function solicitarCambioTipo(qIdx, newType) {
    const question = preguntasData[qIdx];
    if (!question) return;
    if (!typeChangeDiscardsAnswers(question, newType)) {
        cambiarTipoPregunta(qIdx, newType);
        return;
    }
    const previousType = question.type;
    const fallbackName = QUESTION_TYPE_PICKER.find(t => t.type === newType)?.name || newType;
    const typeName = _t(`admin.q.type_${newType}_short`, null, fallbackName);
    const restore = () => {
        dibujarPregunta(qIdx);
        document.getElementById(`qtype-${qIdx}-${previousType}`)?.focus();
    };
    mostrarModalConfirmacion(
        _t('admin.q.type_change_title', null, '¿Cambiar el tipo de pregunta?'),
        _t(
            'admin.q.type_change_msg',
            { type: escapeHtml(typeName) },
            'Al pasar a «{type}» se borrarán las opciones y respuestas que ya has escrito en esta pregunta.'
        ),
        () => cambiarTipoPregunta(qIdx, newType),
        restore,
        _t('admin.q.type_change_confirm', null, 'Cambiar tipo'),
        null,
        { danger: true }
    );
}
