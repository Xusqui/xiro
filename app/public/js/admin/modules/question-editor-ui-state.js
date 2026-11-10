/**
 * @fileoverview Estado de vista del editor de preguntas de bancos: tarjetas plegadas,
 * selector de tipo abierto, bloques <details> abiertos ("Más opciones", "Cómo funciona"),
 * errores de validación y a qué campo va el foco al repintar.
 * Vive en WeakSet/WeakMap por objeto pregunta y NUNCA en preguntasData: la barra de
 * guardado compara preguntasData, y plegar o abrir no es un cambio que haya que guardar.
 * Exporta (globales): isQuestionCollapsed, setQuestionCollapsed, isTypePickerOpen,
 * setTypePickerOpen, isQuestionDetailsOpen, setQuestionFocus, getQuestionError,
 * setQuestionError, clearQuestionErrors, dibujarPregunta, afterQuestionsRender
 */

const _collapsedQuestions = new WeakSet();
const _openTypePickers = new WeakSet();
const _openDetails = new WeakMap();
const _questionErrors = new WeakMap();
let _pendingQuestionFocus = null;

function _setMembership(set, item, on) {
    if (!item) return;
    if (on) set.add(item);
    else set.delete(item);
}

function isQuestionCollapsed(q) {
    return _collapsedQuestions.has(q);
}

function setQuestionCollapsed(q, collapsed) {
    _setMembership(_collapsedQuestions, q, collapsed);
}

function isTypePickerOpen(q) {
    return _openTypePickers.has(q);
}

function setTypePickerOpen(q, open) {
    _setMembership(_openTypePickers, q, open);
}

/** Abierto si el usuario lo abrió; si nunca lo tocó, lo decide fallback. */
function isQuestionDetailsOpen(q, key, fallback = false) {
    const state = _openDetails.get(q);
    return state && Object.hasOwn(state, key) ? state[key] : fallback;
}

function _rememberDetails(q, key, open) {
    if (!q || !key) return;
    _openDetails.set(q, { ...(_openDetails.get(q) || {}), [key]: open });
}

/**
 * Campo que recibe el foco tras el siguiente repintado.
 * @param {string} id - id del elemento
 * @param {boolean} [scroll=false] - además, desplazar la vista hasta él
 */
function setQuestionFocus(id, scroll = false) {
    _pendingQuestionFocus = id ? { id, scroll } : null;
}

/** @returns {{ fieldId: string|null, message: string }|undefined} */
function getQuestionError(q) {
    return _questionErrors.get(q);
}

function setQuestionError(q, problem) {
    if (q) _questionErrors.set(q, problem);
}

function clearQuestionErrors() {
    (globalThis.preguntasData || []).forEach(q => _questionErrors.delete(q));
}

/** Repinta solo la tarjeta qIdx (cambios dentro de una pregunta: opciones, tipo, plegado). */
function dibujarPregunta(qIdx) {
    const card = document.getElementById(`q-card-${qIdx}`);
    const q = globalThis.preguntasData?.[qIdx];
    if (!card || !q) {
        dibujarPreguntas();
        return;
    }
    const activeId = document.activeElement?.id || null;
    normalizeQuestionDefaults(q);
    const template = document.createElement('template');
    template.innerHTML = questionCardHtml(q, qIdx).trim();
    const fresh = template.content.firstElementChild;
    card.replaceWith(fresh);
    afterQuestionsRender(fresh, activeId);
}

function _restoreQuestionFocus(activeId) {
    const pending = _pendingQuestionFocus;
    _pendingQuestionFocus = null;
    const target = document.getElementById(pending?.id || activeId || '');
    if (!target || target === document.body) return;
    // Centrado: arriba lo taparía la cabecera fija; abajo, la barra de guardado
    if (pending?.scroll) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.focus({ preventScroll: true });
}

function _hydrateAudio(root) {
    root.querySelectorAll('.audio-placeholder').forEach(placeholder => {
        const audioSrc = placeholder.dataset.audioSrc;
        if (!audioSrc) return;
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'none';
        audio.src = audioSrc;
        audio.className = 'w-full';
        placeholder.appendChild(audio);
        placeholder.classList.remove('audio-placeholder');
    });
}

/** Marca el campo con error de cada tarjeta pintada (aria-invalid + el aviso como descripción). */
function _markInvalidFields(root) {
    const cards = root.matches?.('.xq-card') ? [root] : [...(root.querySelectorAll?.('.xq-card') || [])];
    cards.forEach(card => {
        const problem = getQuestionError(globalThis.preguntasData?.[Number(card.dataset.qIdx)]);
        const field = problem?.fieldId && document.getElementById(problem.fieldId);
        if (!field) return;
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', `q-error-${card.dataset.qIdx}`);
    });
}

/** Tras pintar (una tarjeta o la lista): campos con error, altura de los campos, foco, audio y zonas de arrastre. */
function afterQuestionsRender(root, activeId) {
    _markInvalidFields(root);
    requestAnimationFrame(() => {
        // Primero la altura de los campos que crecen: el desplazamiento al foco depende de ella
        if (typeof autoGrowFields === 'function') autoGrowFields(root);
        _restoreQuestionFocus(activeId);
        setTimeout(() => {
            _hydrateAudio(root);
            if (typeof inicializarDragAndDrop === 'function') inicializarDragAndDrop(root);
        }, 100);
    });
}

function _questionIndexOf(element) {
    const card = element?.closest?.('.xq-card[data-q-idx]');
    return card ? Number(card.dataset.qIdx) : -1;
}

/** Recuerda los <details> abiertos y quita el aviso de error al corregir el campo. */
function _initQuestionEditorListeners() {
    // toggle no burbujea: se escucha en captura
    document.addEventListener(
        'toggle',
        event => {
            const details = event.target;
            if (!details?.matches?.('details[data-q-details]')) return;
            const q = globalThis.preguntasData?.[_questionIndexOf(details)];
            _rememberDetails(q, details.dataset.qDetails, details.open);
        },
        true
    );
    document.addEventListener('input', event => {
        const card = event.target?.closest?.('.xq-card--invalid');
        if (!card) return;
        _questionErrors.delete(globalThis.preguntasData?.[_questionIndexOf(card)]);
        card.classList.remove('xq-card--invalid');
        card.querySelector('.xq-error')?.remove();
        card.querySelectorAll('[aria-invalid="true"]').forEach(el => {
            el.removeAttribute('aria-invalid');
            el.removeAttribute('aria-describedby');
        });
    });
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    _initQuestionEditorListeners();
}
