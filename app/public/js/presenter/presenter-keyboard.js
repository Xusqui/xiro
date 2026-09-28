/**
 * @fileoverview Atajo de teclado del presentador: Intro o flecha derecha
 * pulsan "Siguiente pregunta" cuando #btn-next está visible (tras revelar
 * respuesta o en diapositivas sin respuesta).
 */

const NEXT_KEYS = new Set(['Enter', 'ArrowRight']);
const NEXT_COOLDOWN_MS = 1000;
const EDITABLE_SELECTOR = 'input, textarea, select, button, [contenteditable]:not([contenteditable="false"])';

let lastTriggerAt = 0;

function isShortcutEvent(event) {
    if (!NEXT_KEYS.has(event.key) || event.repeat || event.defaultPrevented) return false;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
    // Intro sobre un control enfocado ya tiene su propio comportamiento (p. ej. click nativo)
    const target = event.target;
    return !(target && typeof target.closest === 'function' && target.closest(EDITABLE_SELECTOR));
}

function findVisibleNextButton(doc) {
    const btn = doc.getElementById('btn-next');
    if (!btn || btn.classList.contains('hidden')) return null;
    return btn.getClientRects().length > 0 ? btn : null;
}

export function handleNextQuestionKey(event, doc = document, now = Date.now()) {
    if (!isShortcutEvent(event)) return false;
    const btn = findVisibleNextButton(doc);
    if (!btn || now - lastTriggerAt < NEXT_COOLDOWN_MS) return false;

    lastTriggerAt = now;
    event.preventDefault();
    btn.click();
    return true;
}

export function setupNextQuestionShortcut() {
    document.addEventListener('keydown', (event) => handleNextQuestionKey(event));
}
