/**
 * @fileoverview Botón «Anterior» del presentador (juegos personalizados).
 * Abajo a la izquierda, frente a «Siguiente». El servidor dice cuándo se puede
 * retroceder (`canGoBack` en 'new-question' y 'reveal-answer'): en diapositivas
 * sin respuesta y en preguntas ya reveladas, nunca en la primera.
 * Sin imports: se prueba cargando el fuente (presenter-slide-nav.test.js).
 */

const PREV_BUTTON_ID = 'btn-prev';

function prevButtonHtml() {
    const label = _t('presenter.game.previous_slide', null, 'Anterior');
    return `<button id="${PREV_BUTTON_ID}" data-presenter-action="previous-slide" class="fixed bottom-10 left-10 bg-white/10 text-white border-2 border-white/30 px-10 py-5 rounded-3xl font-black text-2xl shadow-2xl hover:bg-plum-600 transition italic uppercase" style="z-index: 10000;"><i class="fas fa-chevron-left mr-2"></i>${label}</button>`;
}

/**
 * Pone o quita el botón según lo que diga el servidor.
 * @param {boolean} canGoBack
 * @param {Document} [doc]
 */
export function syncPrevButton(canGoBack, doc = document) {
    const existing = doc.getElementById(PREV_BUTTON_ID);
    if (!canGoBack) {
        if (existing) existing.remove();
        return;
    }
    if (existing) return;
    doc.body.insertAdjacentHTML('beforeend', _tHtml(prevButtonHtml()));
}

/**
 * Actividad revisada: solo lectura, sin el panel para asignar puntos (el servidor
 * también los rechaza).
 * @param {Document} [doc]
 */
export function lockActivityPoints(doc = document) {
    const panel = doc.getElementById('manual-points-grid')?.parentElement;
    if (panel) panel.remove();
}

/**
 * Pide al servidor la diapositiva anterior.
 * @returns {boolean} true si se ha emitido
 */
export function emitPreviousSlide(socket, sessionId) {
    if (!socket || !socket.connected || !sessionId) return false;
    socket.emit('previous-slide', sessionId);
    return true;
}
