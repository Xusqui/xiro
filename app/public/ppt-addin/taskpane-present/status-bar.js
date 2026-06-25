/**
 * @module status-bar
 * @description UI mínima del task pane en modo presentación.
 *   Solo muestra: estado de conexión + ID de sesión + botón de emergencia.
 *   No contiene controles de juego — todo ocurre en el diálogo.
 * @depends [shared/state, taskpane-present/session-keeper]
 */

const XiroStatusBar = (() => {

    let _container = null;
    let _onStart = null;

    function mount(container, onStartPolling) {
        _container = container;
        _onStart = onStartPolling || null;
        _render();
    }

    function _render() {
        if (!_container) return;
        const polling = typeof XiroSlideWatcher !== 'undefined' && XiroSlideWatcher.isRunning(); // eslint-disable-line no-undef
        const sk = typeof XiroSessionKeeper !== 'undefined' ? XiroSessionKeeper.getState() : {}; // eslint-disable-line no-undef
        const sessionId = sk.sessionId || null;
        const hasDialog = !!(typeof XiroState !== 'undefined' && XiroState && XiroState.get('dialog')); // eslint-disable-line no-undef

        _container.innerHTML = `
            <div class="sv-card">
                <div class="sv-status-row${polling && sessionId ? ' sv-status-row--live' : ''}">
                    <span class="sv-dot${polling && sessionId ? ' sv-dot--live' : polling ? ' sv-dot--ready' : ''}"></span>
                    <span class="sv-status-label">${sessionId ? 'Sesión activa' : polling ? 'En espera' : 'Sin conexión'
            }</span>
                </div>
                ${sessionId ? `
                <div class="sv-session">
                    <span class="sv-session__label">ID de sesión</span>
                    <span class="sv-session__value" id="sb-session-id">${sessionId}</span>
                </div>` : ''}
                <p class="sv-hint">Avanza la diapositiva para que XIRO abra automáticamente el diálogo correcto.</p>
                ${!polling && _onStart ? `<button id="sb-start-btn" class="save-btn">Iniciar XIRO</button>` : ''}
                ${hasDialog ? `<button id="sb-close-dialog" class="sv-emergency-btn">✕ Cerrar diálogo bloqueado</button>` : ''}
            </div>
        `;

        if (!polling && _onStart) {
            document.getElementById('sb-start-btn').addEventListener('click', () => {
                if (_onStart) _onStart();
            });
        }
        if (hasDialog) {
            document.getElementById('sb-close-dialog').addEventListener('click', _onEmergencyClose);
        }
    }

    function refresh() {
        _render();
    }

    function update(state) {
        _render();
    }

    function _onEmergencyClose() {
        const dlg = typeof XiroState !== 'undefined' && XiroState && XiroState.get('dialog'); // eslint-disable-line no-undef
        if (dlg) {
            try { dlg.close(); } catch (_) { }
            if (typeof XiroState !== 'undefined') XiroState.set('dialog', null); // eslint-disable-line no-undef
        }
        _render();
    }

    return { mount, update, refresh };
})();
