/**
 * @fileoverview Barra de guardado común del panel admin: pestañas de Configuración y
 * editores de Preguntas (bancos, mezclas, personalizados, trivial).
 * Muestra "Todo guardado" / "Cambios sin guardar" y los botones "Descartar cambios" y
 * "Guardar". La vista pinta renderSaveBar() y, ya en pantalla, llama a bindSaveBar con:
 *   snapshot() → objeto serializable con los valores actuales del formulario
 *   save(initial) → Promise<{ ok: boolean, message?: string }>; initial = snapshot al pintar
 *   discard() → vuelve a pintar la vista con lo guardado
 *   guard → nombre para unsaved-changes.js (avisa al salir con cambios); por defecto 'config'
 *   root → id del contenedor cuyos input/change recalculan el estado al momento
 *   cleanText → texto del estado "sin cambios" (p. ej. "Todavía sin guardar" en uno nuevo)
 * Mientras está conectada revisa además el estado cada segundo: en los editores muchos
 * cambios no pasan por input/change (añadir, quitar o reordenar, modales, imágenes).
 * Hasta que el usuario toca la vista (pulsación o tecla dentro de root), lo que cambie solo
 * se toma como parte de la carga (datos que llegan o se normalizan al pintar) y pasa a ser
 * el estado guardado: así no aparecen "cambios" que nadie ha hecho.
 * Estilos en css/admin-savebar.css.
 */

const _SAVE_BAR_POLL_MS = 1000;

let _saveBar = null;
let _saveBarTimer = null;
let _saveBarDelegationReady = false;

/** @param {string} [saveLabel] - texto del botón de guardar (por defecto "Guardar configuración") */
function renderSaveBar(saveLabel) {
    return `
        <div class="savebar" id="savebar" data-state="idle">
            <p class="savebar__status" id="savebar-status" role="status" aria-live="polite"></p>
            <div class="savebar__actions">
                <button type="button" data-savebar-action="discard" id="savebar-discard-btn" class="savebar__btn savebar__btn--ghost" disabled>
                    <i class="fas fa-undo"></i> ${_t('admin.savebar.btn_discard')}
                </button>
                <button type="button" data-savebar-action="save" id="savebar-save-btn" class="savebar__btn savebar__btn--primary" disabled>
                    <i class="fas fa-save"></i> ${saveLabel || _t('admin.savebar.btn_save')}
                </button>
            </div>
        </div>`;
}

function _saveBarSignature(snapshot) {
    try {
        return JSON.stringify(snapshot());
    } catch {
        return null;
    }
}

function _saveBarSetStatus(state, html) {
    const bar = document.getElementById('savebar');
    const statusEl = document.getElementById('savebar-status');
    if (!bar || !statusEl) return;
    bar.dataset.state = state;
    const locked = state === 'idle' || state === 'saving' || state === 'clean' || state === 'ok';
    document.getElementById('savebar-save-btn').disabled = locked;
    document.getElementById('savebar-discard-btn').disabled = locked;
    const icon = { saving: 'fa-spin fa-circle-notch', ok: 'fa-check-circle', error: 'fa-times-circle' }[state];
    statusEl.innerHTML = _tHtml((icon ? `<i class="fas ${icon}"></i>` : '<span class="savebar__dot"></span>') + `<span>${html}</span>`);
}

/** Pone "sin cambios" o "cambios sin guardar" según el formulario. */
function _saveBarShowDirtyState() {
    if (isSaveBarDirty()) _saveBarSetStatus('dirty', _t('admin.savebar.dirty'));
    else _saveBarSetStatus('clean', (_saveBar && _saveBar.cleanText) || _t('admin.savebar.clean'));
}

/**
 * Conecta la barra con la vista recién pintada.
 * @param {{ snapshot: Function, save: Function, discard: Function, guard?: string, root?: string, cleanText?: string }} opts
 */
function bindSaveBar(opts) {
    const initial = _saveBarSignature(opts.snapshot);
    const bar = { guard: 'config', root: 'config-tab-content', ...opts, initial, lastSeen: initial, touched: false };
    _saveBar = bar;
    // El guard caduca cuando esta vista deja de estar en pantalla; antes de que decida,
    // se recalcula la barra para absorber lo que haya cargado en el último segundo
    const isActive = () => {
        refreshSaveBar();
        return _saveBar === bar && Boolean(document.getElementById('savebar'));
    };
    if (typeof setUnsavedChangesGuard === 'function') setUnsavedChangesGuard(bar.guard, opts.snapshot, isActive);
    clearInterval(_saveBarTimer);
    _saveBarTimer = setInterval(refreshSaveBar, _SAVE_BAR_POLL_MS);
    _saveBarShowDirtyState();
}

/** Desconecta la barra (cambio de pestaña o de vista); queda en espera hasta el siguiente bind. */
function unbindSaveBar() {
    _saveBar = null;
    clearInterval(_saveBarTimer);
    if (typeof clearUnsavedChangesGuard === 'function') clearUnsavedChangesGuard();
    _saveBarSetStatus('idle', _t('admin.config.server.loading'));
}

function isSaveBarDirty() {
    return Boolean(_saveBar) && _saveBarSignature(_saveBar.snapshot) !== _saveBar.initial;
}

/**
 * Recalcula el estado si el formulario cambió desde la última vez (así un error o un
 * "guardado" se quedan a la vista hasta que se toca algo).
 */
function refreshSaveBar() {
    if (!_saveBar) return;
    const bar = document.getElementById('savebar');
    if (!bar) {
        // La vista ya no está (se navegó a otra): se suelta; su guard caduca solo (isActive)
        _saveBar = null;
        clearInterval(_saveBarTimer);
        return;
    }
    if (bar.dataset.state === 'saving') return;
    const signature = _saveBarSignature(_saveBar.snapshot);
    if (signature === _saveBar.lastSeen && bar.dataset.state !== 'idle') return;
    _saveBar.lastSeen = signature;
    if (!_saveBar.touched && signature !== _saveBar.initial) {
        // Aún cargando (nadie ha tocado la vista): lo nuevo es el punto de partida
        _saveBar.initial = signature;
        if (typeof markUnsavedChangesAsSaved === 'function') markUnsavedChangesAsSaved();
    }
    _saveBarShowDirtyState();
}

/** Muestra "guardado" un momento y vuelve al estado normal (también tras repintar la vista). */
function announceSaveBarSaved(message) {
    const bar = _saveBar;
    _saveBarSetStatus('ok', message || _t('admin.savebar.saved'));
    setTimeout(() => {
        if (_saveBar === bar && document.getElementById('savebar')?.dataset.state === 'ok') _saveBarShowDirtyState();
    }, 2500);
}

/** Corrige el valor inicial cuando algo se guarda fuera de la barra (p. ej. borrar la imagen elegida). */
function patchSaveBarInitial(changes) {
    if (!_saveBar) return;
    const initial = JSON.parse(_saveBar.initial || '{}');
    _saveBar.initial = JSON.stringify({ ...initial, ...changes });
    if (typeof markUnsavedChangesAsSaved === 'function' && !isSaveBarDirty()) markUnsavedChangesAsSaved();
    _saveBarShowDirtyState();
}

async function triggerSaveBarSave() {
    const bar = _saveBar;
    const barEl = document.getElementById('savebar');
    if (!bar || !barEl || barEl.dataset.state === 'saving' || !isSaveBarDirty()) return;

    _saveBarSetStatus('saving', _t('admin.savebar.saving'));
    let result;
    try {
        result = await bar.save(JSON.parse(bar.initial));
    } catch {
        result = { ok: false, message: _t('admin.savebar.error_net') };
    }
    if (_saveBar !== bar) return; // la vista se volvió a pintar al guardar; ya avisa ella

    if (!result || !result.ok) {
        bar.lastSeen = _saveBarSignature(bar.snapshot);
        _saveBarSetStatus('error', (result && result.message) || _t('admin.tools.error_unknown'));
        return;
    }
    bar.initial = _saveBarSignature(bar.snapshot);
    bar.lastSeen = bar.initial;
    if (typeof markUnsavedChangesAsSaved === 'function') markUnsavedChangesAsSaved();
    announceSaveBarSaved(result.message);
}

function triggerSaveBarDiscard() {
    if (_saveBar && document.getElementById('savebar')?.dataset.state !== 'saving') _saveBar.discard();
}

function _initSaveBarDelegation() {
    if (_saveBarDelegationReady) return;
    _saveBarDelegationReady = true;

    const inRoot = target => {
        const root = _saveBar && document.getElementById(_saveBar.root);
        return Boolean(root && root.contains(target));
    };
    // Solo eventos del usuario (isTrusted): los que lanza el propio código al pintar no cuentan
    const onTouch = event => { if (event.isTrusted && inRoot(event.target)) _saveBar.touched = true; };
    const onEdit = event => {
        if (!inRoot(event.target)) return;
        if (event.isTrusted) _saveBar.touched = true;
        refreshSaveBar();
    };
    // En captura: cuenta como "tocado" antes de que el clic cambie nada
    document.addEventListener('pointerdown', onTouch, true);
    document.addEventListener('keydown', onTouch, true);
    document.addEventListener('input', onEdit);
    document.addEventListener('change', onEdit);

    document.addEventListener('click', event => {
        const button = event.target.closest('[data-savebar-action]');
        if (!button) return;
        if (button.dataset.savebarAction === 'save') triggerSaveBarSave();
        else if (button.dataset.savebarAction === 'discard') triggerSaveBarDiscard();
    });
}

_initSaveBarDelegation();
