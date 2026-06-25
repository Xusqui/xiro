/**
 * @module dialog
 * @description Bootstrap del diálogo fullscreen.
 *   1. Notifica 'ready' al task pane.
 *   2. Espera el mensaje 'init' con { meta, session } → arranca la vista.
 *   3. Escucha mensajes 'navigate' para cambiar de vista sin cerrar/reabrir
 *      el diálogo (PowerPoint solo permite un diálogo activo a la vez).
 * @depends [dialog-router, views/*]
 */

Office.initialize = function () { // eslint-disable-line no-undef
    const root = document.getElementById('xiro-root');
    XiroDialogRouter.init(root);

    // Notificar al task pane que el diálogo está listo
    _notifyParent({ event: 'ready' });

    // Escuchar mensajes del task pane
    Office.context.ui.addHandlerAsync( // eslint-disable-line no-undef
        Office.EventType.DialogParentMessageReceived, // eslint-disable-line no-undef
        (args) => {
            let msg;
            try { msg = JSON.parse(args.message); } catch (_) { return; }

            if ((msg.action === 'init' || msg.action === 'navigate') && msg.meta) {
                // Tanto la inicialización como la navegación usan el mismo router.
                // El router llama a _unmountCurrent() antes de montar la nueva vista,
                // desconectando sockets pendientes correctamente.
                XiroDialogRouter.start(msg.meta, msg.session || {});
            }
        }
    );
};
