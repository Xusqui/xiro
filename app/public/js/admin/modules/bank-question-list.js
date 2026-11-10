/**
 * @fileoverview Lista de preguntas del editor de bancos: añadir (al principio o al final),
 * duplicar, mover, plegar y eliminar preguntas; marcar correctas y añadir o quitar
 * opciones. Los cambios dentro de una pregunta repintan solo su tarjeta (dibujarPregunta);
 * los que cambian la lista o los números, la lista entera (dibujarPreguntas, helpers.js).
 * Con más de COLLAPSE_ON_LOAD preguntas el banco se abre plegado, como índice.
 */

const COLLAPSE_ON_LOAD = 5;

/** Pregunta vacía, tipo quiz, con dos opciones (la primera, correcta). */
function _newBankQuestion() {
    return {
        questionText: '',
        justification: '',
        type: 'quiz',
        tipo_contenido: 'texto',
        url_recurso: null,
        question_image_url: null,
        time_limit: getDefaultQuestionTimeLimit(),
        options: [
            { optionText: '', isCorrect: true, order_index: 0, option_image_url: null },
            { optionText: '', isCorrect: false, order_index: 1, option_image_url: null }
        ],
        correctAnswer: null,
        correctWord: null,
        maxPoints: null,
        toleranceMode: 'hybrid',
        toleranceValue: 25,
        toleranceCap: 1000,
        hint: ''
    };
}

/** Pone la pregunta en idx, con el selector de tipo abierto, y lleva el foco a su enunciado. */
function _insertQuestion(question, idx, { openPicker }) {
    preguntasData.splice(idx, 0, question);
    setTypePickerOpen(question, openPicker);
    setQuestionFocus(`q-text-${idx}`, true);
    dibujarPreguntas();
}

/**
 * Añade una pregunta nueva.
 * @param {'start'|'end'} [position='end'] - Al principio (botón de arriba) o al final
 */
function añadirPregunta(position = 'end') {
    const idx = position === 'start' ? 0 : preguntasData.length;
    _insertQuestion(_newBankQuestion(), idx, { openPicker: true });
}

/** Copia la pregunta justo debajo (sin id: el servidor la crea como nueva). */
function duplicarPregunta(idx) {
    const original = preguntasData[idx];
    if (!original) return;
    const copy = JSON.parse(JSON.stringify(original));
    delete copy.id;
    (copy.options || []).forEach(opt => delete opt.id);
    _insertQuestion(copy, idx + 1, { openPicker: false });
}

/** Sube (-1) o baja (+1) una pregunta; el foco sigue en la misma flecha. */
function moverPregunta(idx, delta) {
    const target = idx + delta;
    if (!preguntasData[idx] || target < 0 || target >= preguntasData.length) return;
    const [moved] = preguntasData.splice(idx, 1);
    preguntasData.splice(target, 0, moved);
    const atEdge = target === 0 || target === preguntasData.length - 1;
    const sameArrow = delta < 0 ? 'up' : 'down';
    const otherArrow = delta < 0 ? 'down' : 'up';
    setQuestionFocus(`q-${atEdge ? otherArrow : sameArrow}-${target}`);
    dibujarPreguntas();
}

/** true si la pregunta tiene algo escrito (para no pedir confirmación al borrar una vacía). */
function questionHasContent(q) {
    const texts = [q.questionText, q.justification, q.correctWord, q.hint, q.url_recurso, q.question_image_url];
    const options = (q.options || []).flatMap(o => [o.optionText, o.match_value, o.option_image_url]);
    return [...texts, ...options].some(value => String(value ?? '').trim() !== '') || q.correctAnswer != null;
}

function _removeQuestion(idx) {
    preguntasData.splice(idx, 1);
    const next = Math.min(idx, preguntasData.length - 1);
    setQuestionFocus(next >= 0 ? `q-toggle-${next}` : 'q-add-first');
    dibujarPreguntas();
}

/** Elimina una pregunta; si tiene contenido, antes pide confirmación. */
function eliminarPregunta(idx) {
    const q = preguntasData[idx];
    if (!q) return;
    if (!questionHasContent(q)) {
        _removeQuestion(idx);
        return;
    }
    const n = idx + 1;
    mostrarModalConfirmacion(
        _t('admin.q.delete_title', { n }, '¿Eliminar la pregunta {n}?'),
        _t('admin.q.delete_msg', null, 'Se quitará del banco al guardar. Hasta entonces puedes recuperarla con «Descartar cambios», que deshace todo lo que no se ha guardado.'),
        () => _removeQuestion(idx),
        () => document.getElementById(`q-del-${idx}`)?.focus(),
        _t('admin.q.delete_confirm', null, 'Eliminar pregunta'),
        null,
        { danger: true }
    );
}

/** Pliega o despliega una tarjeta. */
function alternarPreguntaPlegada(idx) {
    const q = preguntasData[idx];
    if (!q) return;
    setQuestionCollapsed(q, !isQuestionCollapsed(q));
    setQuestionFocus(`q-toggle-${idx}`);
    dibujarPregunta(idx);
}

/** Pliega (true) o despliega (false) todas las tarjetas. */
function plegarTodasLasPreguntas(collapsed) {
    preguntasData.forEach(q => setQuestionCollapsed(q, collapsed));
    dibujarPreguntas();
}

/** Al abrir un banco grande, sus preguntas empiezan plegadas (se lee como índice). */
function collapseQuestionsOnLoad() {
    const collapse = preguntasData.length > COLLAPSE_ON_LOAD;
    preguntasData.forEach(q => setQuestionCollapsed(q, collapse));
}

// ===== OPCIONES (repintan solo su tarjeta) =====

function marcarCorrecta(qIdx, oIdx) {
    preguntasData[qIdx].options.forEach((opt, i) => (opt.isCorrect = i === oIdx));
    dibujarPregunta(qIdx);
}

function marcarCorrectaMultiple(qIdx, oIdx) {
    preguntasData[qIdx].options[oIdx].isCorrect = !preguntasData[qIdx].options[oIdx].isCorrect;
    dibujarPregunta(qIdx);
}

function añadirOpcion(qIdx) {
    const question = preguntasData[qIdx];
    if (!question) return;
    if (!Array.isArray(question.options)) question.options = [];
    question.options.push({ optionText: '', isCorrect: false, order_index: question.options.length, option_image_url: null });
    setQuestionFocus(`opt-${qIdx}-${question.options.length - 1}`);
    dibujarPregunta(qIdx);
}

function eliminarOpcion(qIdx, oIdx) {
    const options = preguntasData[qIdx]?.options;
    if (!options) return;
    options.splice(oIdx, 1);
    setQuestionFocus(`opt-${qIdx}-${Math.min(oIdx, options.length - 1)}`);
    dibujarPregunta(qIdx);
}

// ===== CABECERA Y ESTADO VACÍO =====

/** Banco sin preguntas: el primer paso, con el camaleón del banco de preguntas. */
function bankQuestionsEmptyHtml() {
    return `
                <div class="xq-empty">
                    <img src="/images/chamaleon/banco-de-preguntas.svg" alt="" width="144" height="144" class="xq-empty__img">
                    <h3 class="xq-empty__title">${_t('admin.q.empty_title', null, 'Este banco aún no tiene preguntas')}</h3>
                    <p class="xq-empty__text">${_t('admin.q.empty_text', null, 'Elige el tipo, escribe el enunciado y sus respuestas. Lo demás es opcional.')}</p>
                    <button type="button" id="q-add-first" class="xq-btn xq-btn--primary" data-admin-click="añadirPregunta('end')">
                        <i class="fas fa-plus" aria-hidden="true"></i> ${_t('admin.q.btn_add_first', null, 'Crear la primera pregunta')}
                    </button>
                </div>`;
}

/** Barra de la lista: título con el número de preguntas y acciones que solo tienen sentido con preguntas. */
function bankQuestionsToolbarHtml() {
    return `
                <div class="xq-listbar">
                    <h2 class="xq-listbar__title">${_t('admin.q.list_title', null, 'Preguntas')} <span class="xq-listbar__count" id="q-list-count"></span></h2>
                    <div class="xq-listbar__actions" id="q-list-actions">
                        <button type="button" class="xq-btn xq-btn--ghost" data-admin-click="plegarTodasLasPreguntas(true)">
                            <i class="fas fa-compress" aria-hidden="true"></i> ${_t('admin.q.collapse_all', null, 'Plegar todas')}</button>
                        <button type="button" class="xq-btn xq-btn--ghost" data-admin-click="plegarTodasLasPreguntas(false)">
                            <i class="fas fa-expand" aria-hidden="true"></i> ${_t('admin.q.expand_all', null, 'Desplegar todas')}</button>
                        <button type="button" id="q-add-start" class="xq-btn xq-btn--add" data-admin-click="añadirPregunta('start')">
                            <i class="fas fa-plus" aria-hidden="true"></i> ${_t('admin.q.btn_add_start', null, 'Añadir al principio')}</button>
                    </div>
                </div>`;
}

/** Botón de abajo: añade al final (donde está). */
function bankQuestionsFooterHtml() {
    return `
                <div class="xq-listfoot" id="q-list-foot">
                    <button type="button" id="q-add-end" class="xq-btn xq-btn--add" data-admin-click="añadirPregunta('end')">
                        <i class="fas fa-plus" aria-hidden="true"></i> ${_t('admin.q.btn_add_end', null, 'Añadir pregunta al final')}</button>
                </div>`;
}

/** Actualiza el número de preguntas y oculta las acciones de lista si está vacía. */
function actualizarCabeceraPreguntas() {
    const total = preguntasData.length;
    const count = document.getElementById('q-list-count');
    if (count) count.textContent = total ? `(${total})` : '';
    document.getElementById('q-list-actions')?.toggleAttribute('hidden', total === 0);
    document.getElementById('q-list-foot')?.toggleAttribute('hidden', total === 0);
}
