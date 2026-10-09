/**
 * @fileoverview Barra de guardado común de las pestañas de Configuración del servidor.
 * Muestra "Todo guardado" / "Cambios sin guardar" y los botones "Descartar cambios" y
 * "Guardar configuración". Cada pestaña, tras pintarse, llama a bindConfigSaveBar con:
 *   snapshot() → objeto serializable con los valores actuales del formulario
 *   save(initial) → Promise<{ ok: boolean, message?: string }>; initial = snapshot al pintar
 *   discard() → vuelve a pintar la pestaña con lo guardado
 * La barra compara snapshot() con el valor inicial en cada input/change dentro de
 * #config-tab-content y registra el guard de unsaved-changes.js, así que cambiar de
 * pestaña, de sección o cerrar la página con cambios pide confirmación.
 * Estilos en css/config-savebar.css.
 */

let _cfgSaveBar = null;
let _cfgSaveBarDelegationReady = false;

function renderConfigSaveBar() {
    return `
        <div class="cfg-savebar" id="cfg-savebar" data-state="idle">
            <p class="cfg-savebar__status" id="cfg-save-status" role="status" aria-live="polite"></p>
            <div class="cfg-savebar__actions">
                <button type="button" data-savebar-action="discard" id="cfg-discard-btn" class="cfg-savebar__btn cfg-savebar__btn--ghost" disabled>
                    <i class="fas fa-undo"></i> ${_t('admin.config.savebar.btn_discard')}
                </button>
                <button type="button" data-savebar-action="save" id="cfg-save-btn" class="cfg-savebar__btn cfg-savebar__btn--primary" disabled>
                    <i class="fas fa-save"></i> ${_t('admin.config.savebar.btn_save')}
                </button>
            </div>
        </div>`;
}

function _cfgSignature(snapshot) {
    try {
        return JSON.stringify(snapshot());
    } catch {
        return null;
    }
}

function _cfgSetStatus(state, html) {
    const bar = document.getElementById('cfg-savebar');
    const statusEl = document.getElementById('cfg-save-status');
    if (!bar || !statusEl) return;
    bar.dataset.state = state;
    const locked = state === 'idle' || state === 'saving' || state === 'clean' || state === 'ok';
    document.getElementById('cfg-save-btn').disabled = locked;
    document.getElementById('cfg-discard-btn').disabled = locked;
    const icon = { saving: 'fa-spin fa-circle-notch', ok: 'fa-check-circle', error: 'fa-times-circle' }[state];
    statusEl.innerHTML = _tHtml((icon ? `<i class="fas ${icon}"></i>` : '<span class="cfg-savebar__dot"></span>') + `<span>${html}</span>`);
}

/**
 * Conecta la barra con la pestaña recién pintada.
 * @param {{ snapshot: Function, save: Function, discard: Function }} opts
 */
function bindConfigSaveBar(opts) {
    _cfgSaveBar = { ...opts, initial: _cfgSignature(opts.snapshot) };
    if (typeof setUnsavedChangesGuard === 'function') setUnsavedChangesGuard('config', opts.snapshot);
    _cfgSetStatus('clean', _t('admin.config.savebar.clean'));
}

/** Desconecta la barra (cambio de pestaña o de sección); queda en espera hasta el siguiente bind. */
function unbindConfigSaveBar() {
    _cfgSaveBar = null;
    if (typeof clearUnsavedChangesGuard === 'function') clearUnsavedChangesGuard();
    _cfgSetStatus('idle', _t('admin.config.server.loading'));
}

function isConfigSaveBarDirty() {
    return Boolean(_cfgSaveBar) && _cfgSignature(_cfgSaveBar.snapshot) !== _cfgSaveBar.initial;
}

/** Recalcula el estado; llamarlo tras cambios que no disparan input/change (botones, valores puestos por código). */
function refreshConfigSaveBar() {
    const bar = document.getElementById('cfg-savebar');
    if (!_cfgSaveBar || !bar || bar.dataset.state === 'saving') return;
    if (isConfigSaveBarDirty()) _cfgSetStatus('dirty', _t('admin.config.savebar.dirty'));
    else _cfgSetStatus('clean', _t('admin.config.savebar.clean'));
}

/** Corrige el valor inicial cuando algo se guarda fuera de la barra (p. ej. borrar la imagen elegida). */
function patchConfigSaveBarInitial(changes) {
    if (!_cfgSaveBar) return;
    const initial = JSON.parse(_cfgSaveBar.initial || '{}');
    _cfgSaveBar.initial = JSON.stringify({ ...initial, ...changes });
    if (typeof markUnsavedChangesAsSaved === 'function' && !isConfigSaveBarDirty()) markUnsavedChangesAsSaved();
    refreshConfigSaveBar();
}

async function saveConfigSaveBar() {
    const bar = _cfgSaveBar;
    const barEl = document.getElementById('cfg-savebar');
    if (!bar || !barEl || barEl.dataset.state === 'saving' || !isConfigSaveBarDirty()) return;

    _cfgSetStatus('saving', _t('admin.config.savebar.saving'));
    let result;
    try {
        result = await bar.save(JSON.parse(bar.initial));
    } catch {
        result = { ok: false, message: _t('admin.config.savebar.error_net') };
    }
    if (_cfgSaveBar !== bar) return; // la pestaña se volvió a pintar mientras se guardaba

    if (!result || !result.ok) {
        _cfgSetStatus('error', (result && result.message) || _t('admin.tools.error_unknown'));
        return;
    }
    bar.initial = _cfgSignature(bar.snapshot);
    if (typeof markUnsavedChangesAsSaved === 'function') markUnsavedChangesAsSaved();
    _cfgSetStatus('ok', result.message || _t('admin.config.savebar.saved'));
    setTimeout(() => {
        const live = document.getElementById('cfg-savebar');
        if (_cfgSaveBar === bar && live && live.dataset.state === 'ok') refreshConfigSaveBar();
    }, 2500);
}

function discardConfigSaveBar() {
    if (_cfgSaveBar && document.getElementById('cfg-savebar')?.dataset.state !== 'saving') _cfgSaveBar.discard();
}

function _initConfigSaveBarDelegation() {
    if (_cfgSaveBarDelegationReady) return;
    _cfgSaveBarDelegationReady = true;

    const onEdit = event => {
        const content = document.getElementById('config-tab-content');
        if (_cfgSaveBar && content && content.contains(event.target)) refreshConfigSaveBar();
    };
    document.addEventListener('input', onEdit);
    document.addEventListener('change', onEdit);

    document.addEventListener('click', event => {
        const button = event.target.closest('[data-savebar-action]');
        if (!button) return;
        if (button.dataset.savebarAction === 'save') saveConfigSaveBar();
        else if (button.dataset.savebarAction === 'discard') discardConfigSaveBar();
    });
}

_initConfigSaveBarDelegation();
