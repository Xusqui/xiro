/**
 * @module edit-panel
 * @description Panel principal del modo edición.
 *   Lee la diapositiva seleccionada, muestra su rol XIRO actual y
 *   renderiza el editor correspondiente. Escucha cambios de selección.
 * @depends [shared/logger, shared/notes-parser, taskpane-edit/notes-writer,
 *           taskpane-edit/slide-type-selector]
 */

const XiroEditPanel = (() => {

    let _container = null;
    let _debounceT = null;

    /**
     * Monta el panel de edición en el contenedor raíz.
     * @param {HTMLElement} container
     */
    function mount(container) {
        _container = container;
        XiroLog.info('edit-panel', 'mount()'); // eslint-disable-line no-undef
        _container.innerHTML = `
            <div class="edit-panel">
                <div class="edit-panel__header">
                    <span class="xiro-logo">⚡ Xiro!</span>
                    <span class="edit-badge">Modo edición</span>
                </div>
                <div id="ep-slide-info" class="slide-info">
                    <span id="ep-slide-label">Selecciona una diapositiva</span>
                </div>
                <div id="ep-selector-area" class="editor-section"></div>
                <div id="ep-editor-area"   class="editor-content"></div>
            </div>
        `;

        // Escuchar cambios de selección de diapositiva (debounce 180 ms)
        Office.context.document.addHandlerAsync( // eslint-disable-line no-undef
            Office.EventType.DocumentSelectionChanged, // eslint-disable-line no-undef
            _debouncedSlideSelected
        );

        // Cargar estado de la diapositiva actual
        _onSlideSelected();
    }

    /** Refresca el panel leyendo la metadata actual (llamado por los editores tras guardar). */
    function refresh() {
        _onSlideSelected();
    }

    /** @private — evita lecturas duplicadas cuando la selección dispara varias veces */
    function _debouncedSlideSelected() {
        clearTimeout(_debounceT);
        _debounceT = setTimeout(_onSlideSelected, 180);
    }

    /** @private */
    async function _onSlideSelected() {
        const labelEl = document.getElementById('ep-slide-label');
        if (!labelEl) return;

        try {
            const meta = await XiroNotesWriter.readMeta(); // eslint-disable-line no-undef
            const role = meta?.role || null;

            labelEl.textContent = role
                ? `Diapositiva XIRO: ${_roleLabel(role)}`
                : 'Diapositiva sin rol XIRO';

            XiroSlideTypeSelector.mount( // eslint-disable-line no-undef
                document.getElementById('ep-selector-area'),
                document.getElementById('ep-editor-area'),
                role,
                meta
            );
        } catch (err) {
            const msg = err?.message || String(err);
            labelEl.textContent = 'Error al leer diapositiva';
            labelEl.style.color = '#ef4444';
            labelEl.title = msg;                          // tooltip con detalle
            const selectorArea = document.getElementById('ep-selector-area');
            if (selectorArea) {
                selectorArea.innerHTML = `<p style="color:#ef4444;font-size:.8rem;margin-top:.5rem;word-break:break-word">${_esc(msg)}</p>`;
            }
            XiroLog.error('edit-panel', '_onSlideSelected error', err); // eslint-disable-line no-undef
        }
    }

    function _roleLabel(role) {
        return { lobby: 'Lobby', question: 'Pregunta', podium: 'Podio' }[role] || role;
    }

    function _esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function unmount() {
        XiroLog.info('edit-panel', 'unmount()'); // eslint-disable-line no-undef
        clearTimeout(_debounceT);
        Office.context.document.removeHandlerAsync( // eslint-disable-line no-undef
            Office.EventType.DocumentSelectionChanged, // eslint-disable-line no-undef
            { handler: _debouncedSlideSelected }
        );
        XiroSlideTypeSelector.unmount(); // eslint-disable-line no-undef
        if (_container) _container.innerHTML = '';
    }

    return { mount, unmount, refresh };
})();
