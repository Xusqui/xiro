/**
 * @module taskpane
 * @description Bootstrap del task pane y del runtime compartido (Shared Runtime).
 *
 *   Con el manifest V1_1 + Shared Runtime el JS runtime persiste aunque el
 *   usuario cierre el panel lateral. Esto permite que el polling detecte
 *   cambios de diapositiva durante el slideshow F5 sin interaccion del usuario.
 *
 *   FLUJO SIN PANEL LATERAL:
 *     1. El usuario hace clic en "Iniciar XIRO" en la cinta. Esto ejecuta
 *        xiroStartPresenting() via ExecuteFunction SIN abrir el panel.
 *     2. El usuario pulsa F5 para iniciar el slideshow. El panel se oculta
 *        pero el runtime sigue vivo (Shared Runtime).
 *     3. Al cambiar de diapositiva el polling detecta el cambio y abre/navega
 *        el dialogo XIRO automaticamente.
 *
 *   FLUJO CON PANEL LATERAL (configuracion de slides):
 *     - El usuario hace clic en "Configurar" en la cinta. Se abre el panel
 *       con el editor de roles de diapositivas.
 *
 * @depends [shared/state, modules/slide-watcher, taskpane-edit/*, shared/logger]
 */

/* ── Función del botón de cinta "Iniciar XIRO" (ExecuteFunction) ─────────────
   Se registra con Office.actions.associate dentro de Office.initialize para
   asegurar que la API de Office ya está cargada cuando se hace el registro. */

/* ── Ciclo de vida del runtime ───────────────────────────────────────────── */

Office.initialize = function () {  // eslint-disable-line no-undef
    XiroLog.info('taskpane', 'Office.initialize');  // eslint-disable-line no-undef
    XiroLog.mountPanel(document.body);              // eslint-disable-line no-undef

    // Registrar la función del botón de cinta "Iniciar XIRO" (ExecuteFunction).
    // Con Shared Runtime esta asociación persiste incluso si el panel se cierra.
    if (Office.actions) {                           // eslint-disable-line no-undef
        Office.actions.associate('xiroStartPresenting', function (event) {  // eslint-disable-line no-undef
            XiroLog.info('taskpane', 'xiroStartPresenting — activado desde la cinta');  // eslint-disable-line no-undef
            _activatePolling();
            event.completed();
        });
    }

    // Arrancar el polling SIEMPRE al iniciar. El runtime del task pane
    // sigue vivo cuando el panel queda oculto durante el slideshow F5,
    // por lo que el polling detecta cambios de diapositiva sin accion del usuario.
    _activatePolling();

    // El panel se inicializa con el editor de slides
    _mountPanelUI();

    // Con Shared Runtime el panel puede cerrarse y reabrirse sin reiniciar
    // el runtime. onVisibilityModeChanged nos notifica cuando vuelve a ser visible.
    try {
        Office.addin.onVisibilityModeChanged(function (args) {  // eslint-disable-line no-undef
            XiroLog.info('taskpane', 'visibilityModeChanged → ' + args.visibilityMode);  // eslint-disable-line no-undef
            if (args.visibilityMode === 'Taskpane') {
                XiroLog.mountPanel(document.body);  // eslint-disable-line no-undef
                _mountPanelUI();
            }
        });
    } catch (_) { /* Office antiguo sin Shared Runtime, se ignora */ }
};

/* ── UI del panel lateral ───────────────────────────────────────────────── */

function _mountPanelUI() {
    const toggleBtn = document.getElementById('tp-mode-toggle');
    const content = document.getElementById('tp-content');

    if (!content) return;

    const savedView = localStorage.getItem('xiro_pane_view') || 'edit';

    // El badge refleja la vista activa
    _updateBadge(savedView);

    // Boton toggle: alterna entre el editor de slides y el estado de sesion
    const fresh = toggleBtn.cloneNode(true);  // evita acumulacion de listeners al reabrir
    toggleBtn.parentNode.replaceChild(fresh, toggleBtn);

    _applyView(savedView, content, fresh);

    fresh.addEventListener('click', () => {
        const cur = localStorage.getItem('xiro_pane_view') || 'edit';
        const next = cur === 'edit' ? 'status' : 'edit';
        localStorage.setItem('xiro_pane_view', next);
        _applyView(next, content, fresh);
    });
}

function _applyView(view, content, toggleBtn) {
    _updateBadge(view);
    if (view === 'edit') {
        if (toggleBtn) toggleBtn.textContent = 'Sesión';
        XiroEditPanel.mount(content);  // eslint-disable-line no-undef
        XiroLog.info('taskpane', 'edit panel mounted');  // eslint-disable-line no-undef
    } else {
        if (toggleBtn) toggleBtn.textContent = 'Edición';
        _mountStatusView(content);
    }
}

function _mountStatusView(content) {
    try { XiroEditPanel.unmount(); } catch (_) { }  // eslint-disable-line no-undef
    content.innerHTML = '';
    XiroStatusBar.mount(content, _onStartPolling);  // eslint-disable-line no-undef
    XiroLog.info('taskpane', 'status view mounted');  // eslint-disable-line no-undef
}

function _onStartPolling() {
    _activatePolling();
    _updateBadge('status');
    XiroStatusBar.refresh();  // eslint-disable-line no-undef
}

function _updateBadge(view) {
    const badge = document.getElementById('tp-mode-badge');
    if (!badge) return;
    if (view === 'edit') {
        badge.textContent = 'EDICIÓN';
        badge.classList.remove('active');
    } else {
        const polling = XiroSlideWatcher.isRunning();  // eslint-disable-line no-undef
        badge.textContent = polling ? 'EN VIVO' : 'INACTIVO';
        badge.classList.toggle('active', polling);
    }
    badge.style.background = '';
}

/* ── Polling ─────────────────────────────────────────────────────────────── */

function _activatePolling() {
    if (XiroSlideWatcher.isRunning()) return;  // eslint-disable-line no-undef
    XiroSlideWatcher.start();                  // eslint-disable-line no-undef
    XiroSlideWatcher.checkCurrentSlide();      // eslint-disable-line no-undef
    XiroLog.info('taskpane', 'polling started');  // eslint-disable-line no-undef
}
