/**
 * @module slide-watcher
 * @description Detecta cambios de diapositiva en modo presentación
 *   y abre el diálogo XIRO correspondiente según el tag XIRO_META.
 *   Usa polling (setInterval 700ms) en vez de DocumentSelectionChanged
 *   porque durante el slideshow en PowerPoint Desktop el evento no se
 *   dispara aunque el runtime del task pane siga corriendo en background.
 * @depends [shared/state, taskpane-present/session-keeper, modules/slide-inserter]
 */

const XiroSlideWatcher = (() => {

    let _started = false;
    let _pollTimer = null;
    let _lastSlideId = null;   // ID de la última diapositiva vista (evita reentrada)
    let _pendingMeta = null;

    // ── Public API ────────────────────────────────────────────────────────────

    function start() {
        if (_started) return;
        _started = true;
        _lastSlideId = null;
        _pollTimer = setInterval(_poll, 700);
        XiroLog.info('slide-watcher', 'polling started');  // eslint-disable-line no-undef
    }

    function stop() {
        if (!_started) return;
        clearInterval(_pollTimer);
        _pollTimer = null;
        _started = false;
        _lastSlideId = null;
        XiroLog.info('slide-watcher', 'polling stopped');  // eslint-disable-line no-undef
    }

    /**
     * Fuerza la comprobación de la diapositiva actual, ignorando el caché de ID.
     * Útil al activar el modo presentación para no esperar hasta el próximo ciclo.
     */
    function checkCurrentSlide() {
        _lastSlideId = null;   // el próximo _poll (≤700ms) detectará "cambio"
    }

    // ── Polling ───────────────────────────────────────────────────────────────

    function _poll() {
        Office.context.document.getSelectedDataAsync(               // eslint-disable-line no-undef
            Office.CoercionType.SlideRange,                         // eslint-disable-line no-undef
            async (result) => {
                if (result.status !== Office.AsyncResultStatus.Succeeded) return; // eslint-disable-line no-undef
                const slides = result.value && result.value.slides;
                if (!slides || !slides.length) return;

                const slideId = slides[0].id;
                const slideIdx = slides[0].index || 1;  // 1-based
                if (slideId === _lastSlideId) return;   // sin cambio
                _lastSlideId = slideId;
                _lastSlideIdx = slideIdx;

                const idx = slideIdx - 1;
                XiroLog.debug('slide-watcher', 'slide changed idx=' + idx + ' id=' + slideId); // eslint-disable-line no-undef

                try {
                    const meta = await _getMetaForIdx(idx);
                    _handleMetaChange(meta);
                } catch (err) {
                    XiroLog.warn('slide-watcher', 'getMetaForIdx: ' + err.message); // eslint-disable-line no-undef
                }
            }
        );
    }

    /**
     * Abre o navega el diálogo según la metadata de la diapositiva.
     *
     * PowerPoint solo permite UN diálogo activo por add-in.
     * En vez de cerrar+abrir, enviamos un mensaje 'navigate' al diálogo existente
     * para que cambie su vista internamente. Esto evita el error
     * "este complemento ya tiene un diálogo activo".
     *
     * @param {object|null} meta  — metadata XIRO_META de la diapositiva, o null
     */
    function _handleMetaChange(meta) {
        const dlg = XiroState.get('dialog');                       // eslint-disable-line no-undef

        if (!meta) {
            return;
        }

        // Al llegar a la diapositiva de podio, indicar al servidor que termine el juego.
        // El servidor guardará la sesión y emitirá results-ready → session-keeper lo capturará.
        if (meta.role === 'podium') {
            const ended = typeof XiroSessionKeeper !== 'undefined' && // eslint-disable-line no-undef
                XiroSessionKeeper.emitEndGame();                       // eslint-disable-line no-undef
            XiroLog.info('slide-watcher', 'podium slide: emitEndGame=' + ended); // eslint-disable-line no-undef
        }

        if (dlg) {
            _pendingMeta = meta;
            XiroLog.info('slide-watcher', 'navigate dialog role=' + meta.role); // eslint-disable-line no-undef
            dlg.messageChild(JSON.stringify({
                action: 'navigate',
                meta,
                session: XiroSessionKeeper.getInitPayload(),       // eslint-disable-line no-undef
            }));
        } else {
            openXiroDialog(meta);
        }
    }

    async function _getMetaForIdx(idx) {
        return PowerPoint.run(async (ctx) => {                      // eslint-disable-line no-undef
            const tag = ctx.presentation.slides
                .getItemAt(idx).tags.getItemOrNullObject('XIRO_META');
            tag.load(['isNullObject', 'value']);
            await ctx.sync();
            if (tag.isNullObject) return null;
            try { return JSON.parse(tag.value); } catch (_) { return null; }
        });
    }

    // ── Dialog lifecycle ──────────────────────────────────────────────────────

    function openXiroDialog(meta) {
        const existing = XiroState.get('dialog');                  // eslint-disable-line no-undef
        if (existing) {
            try { existing.close(); } catch (_) { }
            XiroState.set('dialog', null);                         // eslint-disable-line no-undef
        }
        _pendingMeta = meta;

        const dialogUrl = window.location.origin + '/ppt-addin/dialog/dialog.html';
        XiroLog.info('slide-watcher', 'opening dialog role=' + meta.role); // eslint-disable-line no-undef
        Office.context.ui.displayDialogAsync(                      // eslint-disable-line no-undef
            dialogUrl,
            { width: 100, height: 100, displayInIframe: false },
            (result) => {
                if (result.status !== Office.AsyncResultStatus.Succeeded) { // eslint-disable-line no-undef
                    XiroLog.error('slide-watcher', 'displayDialogAsync failed: ' + (result.error && result.error.message)); // eslint-disable-line no-undef
                    _pendingMeta = null;
                    return;
                }
                const dlg = result.value;
                XiroState.set('dialog', dlg);                      // eslint-disable-line no-undef

                dlg.addEventHandler(Office.EventType.DialogMessageReceived, // eslint-disable-line no-undef
                    (args) => { try { _onDialogMessage(JSON.parse(args.message)); } catch (_) { } }
                );
                dlg.addEventHandler(Office.EventType.DialogEventReceived,   // eslint-disable-line no-undef
                    (args) => { if (args.error === 12006) _onDialogClosed(); }
                );
            }
        );
    }

    function _onDialogMessage(msg) {
        const dlg = XiroState.get('dialog');                       // eslint-disable-line no-undef

        switch (msg.event) {
            case 'ready':
                if (dlg && _pendingMeta) {
                    dlg.messageChild(JSON.stringify({
                        action: 'init',
                        meta: _pendingMeta,
                        session: XiroSessionKeeper.getInitPayload(), // eslint-disable-line no-undef
                    }));
                }
                break;

            case 'session-created':
                XiroSessionKeeper.init(msg.data);                  // eslint-disable-line no-undef
                if (typeof XiroStatusBar !== 'undefined')          // eslint-disable-line no-undef
                    XiroStatusBar.update(XiroSessionKeeper.getState()); // eslint-disable-line no-undef
                break;

            case 'question-done': {
                XiroSessionKeeper.setQuestionIndex(msg.index);     // eslint-disable-line no-undef
                // Cerrar el diálogo desde el task-pane (igual que lobby-done) para
                // evitar la race condition "ya tiene un diálogo activo" al cambiar slide.
                const dlgQ = XiroState.get('dialog');               // eslint-disable-line no-undef
                if (dlgQ) { try { dlgQ.close(); } catch (_) { } }
                _onDialogClosed();
                _advanceToNextSlide();
                break;
            }

            case 'lobby-done': {
                // Cerrar el diálogo desde el task-pane (evita race con window.close)
                // y avanzar a la siguiente diapositiva.
                // Al llegar a la diapositiva de pregunta el polling detecta el cambio,
                // no hay diálogo activo, y openXiroDialog abre uno nuevo con ViewQuestion.
                const dlgToClose = XiroState.get('dialog');          // eslint-disable-line no-undef
                if (dlgToClose) {
                    try { dlgToClose.close(); } catch (_) { }
                }
                _onDialogClosed();   // limpieza: dialog=null, pendingMeta=null
                _advanceToNextSlide();
                break;
            }

            case 'insert-podium':
                _insertPodium(msg.data);
                break;

            case 'dialog-closed':
                _onDialogClosed();
                break;
        }
    }

    /**
     * Avanza a la diapositiva siguiente en la presentación.
     */
    function _advanceToNextSlide() {
        XiroLog.info('slide-watcher', 'advancing to next slide'); // eslint-disable-line no-undef
        Office.context.document.goToByIdAsync(                    // eslint-disable-line no-undef
            Office.Index.Next,                                    // eslint-disable-line no-undef
            Office.GoToType.Index,                                // eslint-disable-line no-undef
            (asyncResult) => {
                if (asyncResult.status === 'failed') {
                    XiroLog.warn('slide-watcher', 'goToNextSlide: ' + asyncResult.error.message); // eslint-disable-line no-undef
                    return;
                }
                // Forzar re-poll para detectar la nueva diapositiva
                _lastSlideId = null;
                _lastSlideIdx = null;
            }
        );
    }

    function _onDialogClosed() {
        XiroState.set('dialog', null);                             // eslint-disable-line no-undef
        _pendingMeta = null;
        if (typeof XiroStatusBar !== 'undefined')                  // eslint-disable-line no-undef
            XiroStatusBar.update(XiroSessionKeeper.getState());    // eslint-disable-line no-undef
    }

    async function _insertPodium(data) {
        try {
            await XiroSlideInserter.insertPodiumSlide(data);       // eslint-disable-line no-undef
            const dlg = XiroState.get('dialog');                   // eslint-disable-line no-undef
            if (dlg) dlg.messageChild(JSON.stringify({ action: 'podium-inserted' }));
        } catch (err) {
            XiroLog.error('slide-watcher', 'insertPodiumSlide: ' + err.message); // eslint-disable-line no-undef
        }
    }

    function isRunning() { return _started; }

    return { start, stop, openXiroDialog, checkCurrentSlide, isRunning };
})();
