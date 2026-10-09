/**
 * @fileoverview Acciones delegadas del panel de Configuración (data-config-action).
 * Ninguna guarda nada: solo cambian el formulario; el guardado va por la barra común
 * (config-savebar.js). Subir y borrar imágenes de personalización son la excepción
 * (operaciones de fichero inmediatas).
 * Depende de: config-panel.js, config-panel-ui.js, config-panel-fireworks.js,
 * config-personalization.js, config-team-names.js y unsaved-changes.js.
 */

let _configPanelDelegationReady = false;

/** Cambia de pestaña; si hay cambios sin guardar, pide confirmación (unsaved-changes.js). */
function _requestConfigTab(tabId) {
    if (typeof navigateWithUnsavedChangesGuard === 'function') {
        navigateWithUnsavedChangesGuard(() => switchConfigTab(tabId));
    } else {
        switchConfigTab(tabId);
    }
}

/** Acciones de clic del panel, con el elemento que la dispara. */
const _CONFIG_CLICK_ACTIONS = {
    'switch-tab': el => { if (el.dataset.tabId) _requestConfigTab(el.dataset.tabId); },
    'toggle-personalization-enabled': el => togglePersonalizationEnabled(el.checked),
    'select-personalization-image': el => { if (el.dataset.filename) selectPersonalizationImage(el.dataset.filename); },
    'delete-personalization-image': el => { if (el.dataset.filename) deletePersonalizationImage(el.dataset.filename); },
    'set-tv-card-mode': el => { if (el.dataset.mode) setTvCardMode(el.dataset.mode, el); },
    'preview-fireworks': () => previewFireworks(),
    'toggle-sensitive': el => { if (el.dataset.key) toggleSensitiveField(el.dataset.key); },
    'reset-team-names': () => resetTeamNames()
};

function _initConfigPanelDelegation() {
    if (_configPanelDelegationReady) return;
    _configPanelDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-config-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.configAction;
        if (Object.hasOwn(_CONFIG_CLICK_ACTIONS, action)) _CONFIG_CLICK_ACTIONS[action](actionElement);
    });

    document.addEventListener('input', (event) => {
        const actionElement = event.target.closest('[data-config-action]');
        if (!actionElement) return;
        if (actionElement.dataset.configAction === 'update-fireworks-slider' && actionElement.dataset.key) {
            updateFireworksSlider(actionElement.dataset.key, actionElement.value);
        }
    });

    document.addEventListener('change', (event) => {
        const actionElement = event.target.closest('[data-config-action="upload-personalization-image"]');
        if (!actionElement || !actionElement.files || !actionElement.files[0]) return;
        uploadPersonalizationImage(actionElement.files[0]);
        actionElement.value = '';
    });
}

_initConfigPanelDelegation();
