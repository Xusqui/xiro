// Acciones delegadas del panel: cada elemento con data-admin-action="x" ejecuta
// ADMIN_ACTIONS[x](ctx) al pulsarlo. Las funciones de destino son globales de otros
// scripts del panel; se comprueba que existan porque no todas las vistas las cargan.

function parseNullableId(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/** Atributos data-* que usan las acciones, más el evento de clic. */
function readAdminActionContext(element, event) {
    const data = element.dataset;
    return {
        event,
        section: data.section,
        view: data.view,
        panel: data.panel,
        sessionId: data.sessionId,
        bankId: parseNullableId(data.bankId),
        gameId: parseNullableId(data.gameId),
        ownerUserId: parseNullableId(data.ownerUserId),
        resourceLabel: data.resourceLabel,
        provider: data.provider
    };
}

const ADMIN_ACTIONS = {
    'go-home': ({ event }) => {
        event.preventDefault();
        if (typeof goToHome === 'function') goToHome();
    },
    'switch-section-tab': ({ section }) => {
        if (section && typeof switchSectionTab === 'function') switchSectionTab(section);
    },
    'show-view': ({ view }) => {
        if (view && typeof mostrarVista === 'function') mostrarVista(view);
    },
    'show-config-panel': () => {
        if (typeof renderConfigPanel === 'function') renderConfigPanel();
        if (typeof highlightSidebarNav === 'function') highlightSidebarNav('servidor');
    },
    'show-upload-view': () => {
        if (typeof mostrarCargarPreguntas === 'function') mostrarCargarPreguntas();
    },
    'edit-bank': ({ bankId }) => {
        if (bankId !== null && typeof cargarEditorBanco === 'function') cargarEditorBanco(bankId);
    },
    'delete-bank': ({ bankId, event, ownerUserId }) => {
        if (bankId !== null && typeof borrarBanco === 'function') borrarBanco(bankId, event, ownerUserId);
    },
    'edit-game': ({ gameId }) => {
        if (gameId !== null && typeof cargarEditorJuego === 'function') cargarEditorJuego(gameId);
    },
    'delete-game': ({ gameId, event, ownerUserId }) => {
        if (gameId !== null && typeof borrarJuego === 'function') borrarJuego(gameId, event, ownerUserId);
    },
    'edit-custom-game': ({ gameId }) => {
        if (gameId !== null && typeof cargarEditorJuegoPersonalizado === 'function') {
            cargarEditorJuegoPersonalizado(gameId);
        }
    },
    'delete-custom-game': ({ gameId, event, ownerUserId }) => {
        event.stopPropagation();
        if (gameId !== null && typeof borrarJuegoPersonalizado === 'function') {
            borrarJuegoPersonalizado(gameId, ownerUserId);
        }
    },
    'ownership-denied': ({ resourceLabel }) => {
        if (resourceLabel && typeof showOwnershipDeniedModal === 'function') {
            showOwnershipDeniedModal(resourceLabel);
        }
    },
    'history-back': () => {
        if (typeof window !== 'undefined' && window.history) window.history.back();
    },
    'load-bank-from-json': () => {
        if (typeof cargarBancoDesdeJSON === 'function') cargarBancoDesdeJSON();
    },
    'reload-remote-sessions': () => {
        if (typeof recargarSesionesActivas === 'function') recargarSesionesActivas();
    },
    'terminate-remote-session': ({ sessionId }) => {
        if (sessionId && typeof terminarSesionAdmin === 'function') terminarSesionAdmin(sessionId);
    },
    'switch-user-panel': ({ panel }) => {
        if (panel && typeof switchUserPanelView === 'function') switchUserPanelView(panel);
    },
    'ai-discard': () => {
        if (typeof discardAIConfigChanges === 'function') discardAIConfigChanges();
    },
    'ai-delete-key': ({ provider }) => {
        if (provider && typeof deleteAIProviderKey === 'function') deleteAIProviderKey(provider);
    },
    'ai-ollama-load-models': () => {
        if (typeof loadOllamaModels === 'function') loadOllamaModels(false);
    },
    'clear-uploads': () => {
        if (typeof limpiarArchivosHuerfanos === 'function') limpiarArchivosHuerfanos();
    },
    'clear-cache': () => {
        if (typeof limpiarCache === 'function') limpiarCache();
    },
    'delete-logs': () => {
        if (typeof borrarLogs === 'function') borrarLogs();
    },
    'panic-restart': () => {
        if (typeof panicRestart === 'function') panicRestart();
    },
    'logout': () => {
        if (typeof logout === 'function') logout();
    }
};

function setupAdminActionDelegation() {
    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-admin-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.adminAction;
        if (Object.hasOwn(ADMIN_ACTIONS, action)) {
            ADMIN_ACTIONS[action](readAdminActionContext(actionElement, event));
        }
    });
}
