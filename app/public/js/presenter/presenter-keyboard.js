/**
 * @fileoverview Atajos de teclado del presentador: Intro o flecha derecha
 * pulsan "Siguiente pregunta" cuando #btn-next está visible (tras revelar
 * respuesta o en diapositivas sin respuesta); la flecha izquierda pulsa
 * «Anterior» (#btn-prev, juegos personalizados) cuando está visible.
 */

const KEY_TARGETS = { Enter: 'btn-next', ArrowRight: 'btn-next', ArrowLeft: 'btn-prev' };
const NEXT_COOLDOWN_MS = 1000;
// También vídeos y audios enfocados: ahí Intro reproduce/pausa y → adelanta el vídeo
const EDITABLE_SELECTOR =
    'input, textarea, select, button, video, audio, [contenteditable]:not([contenteditable="false"])';

let lastTriggerAt = 0;

function isShortcutEvent(event) {
    if (!Object.hasOwn(KEY_TARGETS, event.key) || event.repeat || event.defaultPrevented) return false;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
    // Intro sobre un control enfocado ya tiene su propio comportamiento (p. ej. click nativo)
    const target = event.target;
    return !(target && typeof target.closest === 'function' && target.closest(EDITABLE_SELECTOR));
}

function findVisibleButton(doc, id) {
    const btn = doc.getElementById(id);
    if (!btn || btn.classList.contains('hidden')) return null;
    return btn.getClientRects().length > 0 ? btn : null;
}

export function handleNextQuestionKey(event, doc = document, now = Date.now()) {
    if (!isShortcutEvent(event)) return false;
    const btn = findVisibleButton(doc, KEY_TARGETS[event.key]);
    if (!btn || now - lastTriggerAt < NEXT_COOLDOWN_MS) return false;

    lastTriggerAt = now;
    event.preventDefault();
    btn.click();
    return true;
}

export function setupNextQuestionShortcut() {
    document.addEventListener('keydown', event => handleNextQuestionKey(event));
}
