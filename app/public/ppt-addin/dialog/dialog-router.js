/**
 * @module dialog-router
 * @description Monta/desmonta vistas del diálogo según el comando recibido.
 *   Expone _notifyParent y _esc como utilidades globales para las vistas.
 * @depends []
 */

// Utilidad global — enviar mensaje al task pane
function _notifyParent(data) {
    Office.context.ui.messageParent(JSON.stringify(data)); // eslint-disable-line no-undef
}

// Utilidad global — escapar HTML (prevenir XSS)
function _esc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

const XiroDialogRouter = (() => {

    let _currentView = null;
    let _container   = null;

    /**
     * Inicializa el router con el contenedor raíz.
     * @param {HTMLElement} container
     */
    function init(container) {
        _container = container;
    }

    /**
     * Arranca el juego según meta.role.
     * @param {{ role: string, [key:string]: any }} meta
     * @param {object} session  — estado del session-keeper
     */
    function start(meta, session) {
        _unmountCurrent();
        switch (meta.role) {
            case 'lobby':    _mount(ViewLobby,    { meta, session }); break;    // eslint-disable-line no-undef
            case 'question': _mount(ViewQuestion, { meta, session }); break;    // eslint-disable-line no-undef
            case 'podium':   _mount(ViewPodium,   { meta, session }); break;    // eslint-disable-line no-undef
            default:
                _container.innerHTML = `<p style="color:#94a3b8;text-align:center;padding:2rem">Rol desconocido: ${_esc(meta.role)}</p>`;
        }
    }

    /** @private */
    function _mount(view, data) {
        _currentView = view;
        if (view && typeof view.mount === 'function') {
            view.mount(_container, data);
        }
    }

    /** @private */
    function _unmountCurrent() {
        if (_currentView && typeof _currentView.unmount === 'function') {
            try { _currentView.unmount(); } catch (_) {}
        }
        _currentView = null;
        if (_container) _container.innerHTML = '';
    }

    return { init, start };
})();
