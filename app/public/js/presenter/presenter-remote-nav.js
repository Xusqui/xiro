/**
 * @fileoverview Botón «Anterior» del mando remoto (juegos personalizados).
 * Se ve durante la partida cuando el servidor dice que se puede retroceder
 * (`canGoBack` en 'remote-join-success', 'new-question' y 'reveal-answer').
 * Sin imports: se prueba cargando el fuente (presenter-remote-nav.test.js).
 */

const REMOTE_PREV_ID = 'btn-remote-prev';

/** Marcado del botón (oculto hasta que se pueda retroceder). */
export function remotePrevButtonHtml() {
    return `<button class="remote-btn remote-btn-prev" id="${REMOTE_PREV_ID}" style="display:none">
                <i class="fas fa-chevron-left"></i>
                <span>${_t('presenter.remote.previous', null, 'Anterior')}</span>
            </button>`;
}

/**
 * @param {{ canGoBack: boolean, isLobby: boolean, isFinal: boolean }} state
 * @param {Document} [doc]
 */
export function syncRemotePrevButton({ canGoBack, isLobby, isFinal }, doc = document) {
    const btn = doc.getElementById(REMOTE_PREV_ID);
    if (!btn) return;
    btn.style.display = canGoBack && !isLobby && !isFinal ? '' : 'none';
}
