/**
 * @fileoverview Mando remoto: botón para silenciar o reactivar las reacciones con emoji de
 * la sala. Se oculta hasta conocer el estado y sigue los cambios del presentador
 * ('reactions-state'). Las ráfagas no se pintan en el mando.
 */

const BUTTON_ID = 'btn-remote-reactions';

let currentSocket = null;
let enabled = false;
let pending = false;

/** Botón secundario (mismo estilo que «Anterior»), oculto hasta conocer el estado. */
export function remoteReactionsButtonHtml() {
    return `<button class="remote-btn remote-btn-prev" id="${BUTTON_ID}" type="button" hidden>
        <i class="fas fa-comment-slash"></i><span></span>
    </button>`;
}

function render(state) {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn || !state) return;
    enabled = state.enabled === true;
    const label = enabled
        ? _t('reactions.presenter.mute', null, 'Silenciar reacciones')
        : _t('reactions.presenter.unmute', null, 'Activar reacciones');
    btn.querySelector('i').className = 'fas ' + (enabled ? 'fa-comment-slash' : 'fa-face-smile');
    btn.querySelector('span').textContent = label;
    btn.hidden = false;
}

function onToggle() {
    if (pending || !currentSocket) return;
    pending = true;
    currentSocket.emit('set-reactions', { enabled: !enabled }, res => {
        pending = false;
        if (res && res.ok) render(res);
    });
}

/** Tras pintar el panel del mando: pide el estado, liga el botón y escucha los cambios. */
export function mountRemoteReactions(socket) {
    currentSocket = socket;
    socket.off('reactions-state', render);
    socket.on('reactions-state', render);
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.onclick = onToggle;
    socket.emit('get-reactions', {}, res => {
        if (res && res.ok) render(res);
    });
}
