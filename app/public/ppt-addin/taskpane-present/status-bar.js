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

    /** Estado actual: sondeo de diapositivas activo, sesión y diálogo abierto. */
    function _readStatus() {
        const polling = typeof XiroSlideWatcher !== 'undefined' && XiroSlideWatcher.isRunning(); // eslint-disable-line no-undef
        const sk = typeof XiroSessionKeeper !== 'undefined' ? XiroSessionKeeper.getState() : {}; // eslint-disable-line no-undef
        const sessionId = sk.sessionId || null;
        const hasDialog = !!(typeof XiroState !== 'undefined' && XiroState && XiroState.get('dialog')); // eslint-disable-line no-undef
        return { polling, sessionId, hasDialog };
    }

    function _dotModifier(polling, sessionId) {
        if (polling && sessionId) return ' sv-dot--live';
        return polling ? ' sv-dot--ready' : '';
    }

    function _statusLabel(polling, sessionId) {
        if (sessionId) return 'Sesión activa';
        return polling ? 'En espera' : 'Sin conexión';
    }

    function _statusHtml({ polling, sessionId, hasDialog }, canStart) {
        return `
            <div class="sv-card">
                <div class="sv-status-row${polling && sessionId ? ' sv-status-row--live' : ''}">
                    <span class="sv-dot${_dotModifier(polling, sessionId)}"></span>
                    <span class="sv-status-label">${_statusLabel(polling, sessionId)}</span>
                </div>
                ${sessionId ? `
                <div class="sv-session">
                    <span class="sv-session__label">ID de sesión</span>
                    <span class="sv-session__value" id="sb-session-id">${sessionId}</span>
                </div>` : ''}
                <p class="sv-hint">Avanza la diapositiva para que XIRO abra automáticamente el diálogo correcto.</p>
                ${canStart ? `<button id="sb-start-btn" class="save-btn">Iniciar XIRO</button>` : ''}
                ${hasDialog ? `<button id="sb-close-dialog" class="sv-emergency-btn">✕ Cerrar diálogo bloqueado</button>` : ''}
            </div>
        `;
    }

    function _render() {
        if (!_container) return;
        const status = _readStatus();
        const canStart = !status.polling && !!_onStart;

        _container.innerHTML = _statusHtml(status, canStart);

        if (canStart) {
            document.getElementById('sb-start-btn').addEventListener('click', () => {
                if (_onStart) _onStart();
            });
        }
        if (status.hasDialog) {
            document.getElementById('sb-close-dialog').addEventListener('click', _onEmergencyClose);
        }
    }

    function refresh() {
        _render();
    }

    function update(_state) {
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
