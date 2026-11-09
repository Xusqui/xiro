/**
 * @fileoverview Modal de novedades que se interpone entre «Actualizar ahora» y la actualización.
 * Requiere update-changelog-view.js cargado previamente y usa _updHeaders y _updStart de update-panel.js.
 */

const _UCL_FETCH_TIMEOUT_MS = 15000;
const _UCL_FOCUSABLE = 'a[href], button:not([disabled]), [tabindex="0"]';

/** Modal abierto: { overlay, opener, force, older, olderRendered } o null. */
let _uclState = null;

/**
 * Pide las novedades al backend.
 * @returns {Promise<Object>} Respuesta de GET /api/admin/update/changelog
 * @throws {Error} Si la petición falla o el servidor la rechaza
 */
async function _uclFetch() {
    const response = await fetch('/api/admin/update/changelog', {
        headers: _updHeaders(),
        signal: AbortSignal.timeout(_UCL_FETCH_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
}

/**
 * Ajusta el pie del modal a lo que se va a hacer al confirmar.
 * @param {string} latest - Versión de destino
 * @param {number} activeSessions - Partidas o salas en curso
 * @returns {void}
 */
function _uclUpdateFooter(latest, activeSessions) {
    const sessions = document.getElementById('xuc-sessions');
    sessions.hidden = activeSessions === 0;
    if (activeSessions > 0) sessions.textContent = _t('admin.updates.active_sessions', { count: activeSessions });

    const confirmButton = document.getElementById('xuc-confirm');
    confirmButton.textContent = activeSessions > 0
        ? _t('admin.updates.btn_update_anyway')
        : _t('admin.updates.changelog.confirm', { version: latest });
    confirmButton.disabled = false;
}

/**
 * Pinta el resultado de la carga. El servidor manda sobre los datos con los que se abrió el modal.
 * @param {Object} state - Estado del modal
 * @param {Object} changelog - Novedades recibidas
 * @returns {void}
 */
function _uclShowChangelog(state, changelog) {
    state.force = changelog.activeSessions > 0;
    state.older = changelog.older;
    document.getElementById('xuc-route-from').textContent = changelog.current;
    document.getElementById('xuc-route-to').textContent = changelog.latest;
    document.getElementById('xuc-body').innerHTML = _uclContentHtml(changelog);
    _uclUpdateFooter(changelog.latest, changelog.activeSessions);
}

/**
 * Carga las novedades; si no se puede, deja actualizar igualmente.
 * @param {Object} state - Estado del modal abierto al pedir la carga
 * @param {{current: string, latest: string}} versions - Versiones con las que se abrió el modal
 * @returns {Promise<void>}
 */
async function _uclLoad(state, versions) {
    let changelog;
    try {
        changelog = await _uclFetch();
        if (!changelog.success) throw new Error(changelog.code || 'UPDATE_CHANGELOG_FAILED');
    } catch (err) {
        console.warn('No se pudieron cargar las novedades:', err.message);
        changelog = { ...versions, available: false, activeSessions: 0, older: [] };
    }
    if (state === _uclState) _uclShowChangelog(state, changelog);
}

/** Mantiene el foco dentro del modal al tabular. */
function _uclTrapTab(event, overlay) {
    const focusable = [...overlay.querySelectorAll(_UCL_FOCUSABLE)].filter(element => element.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

/** Atiende Escape y Tab; detiene Escape para que no lo reciba lo que hay debajo. */
function _uclHandleKeydown(event) {
    if (event.key === 'Escape') {
        event.stopPropagation();
        _uclClose();
    } else if (event.key === 'Tab') {
        _uclTrapTab(event, event.currentTarget);
    }
}

/** Cierra el modal y devuelve el foco al botón que lo abrió. */
function _uclClose() {
    if (!_uclState) return;
    const { overlay, opener } = _uclState;
    _uclState = null;
    overlay.remove();
    if (opener) opener.focus();
}

/**
 * Despliega o pliega el historial anterior; solo lo pinta la primera vez.
 * @param {HTMLButtonElement} toggle - Botón pulsado
 * @returns {void}
 */
function _uclToggleOlder(toggle) {
    if (!_uclState) return;
    const container = document.getElementById('xuc-older');
    if (!_uclState.olderRendered) {
        container.innerHTML = _uclOlderListHtml(_uclState.older);
        _uclState.olderRendered = true;
    }
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    container.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.innerHTML = _uclOlderToggleLabel(expanded);
}

/** Cierra el modal y lanza la actualización. Con partidas en curso, el aviso del pie ya se ha aceptado. */
function _uclConfirm() {
    if (!_uclState) return;
    const { force, opener } = _uclState;
    _uclClose();
    _updStart(force, opener);
}

/**
 * Abre el modal de novedades desde el botón «Actualizar ahora».
 * @param {HTMLButtonElement} opener - Botón con data-current y data-latest
 * @returns {void}
 */
function _uclOpen(opener) {
    if (_uclState) return;
    const versions = { current: opener.dataset.current, latest: opener.dataset.latest };

    const template = document.createElement('template');
    template.innerHTML = _uclDialogHtml(versions).trim();
    const overlay = template.content.firstElementChild;
    overlay.addEventListener('keydown', _uclHandleKeydown);
    overlay.addEventListener('click', event => {
        if (event.target === overlay) _uclClose();
    });
    document.body.appendChild(overlay);

    const state = { overlay, opener, force: false, older: [], olderRendered: false };
    _uclState = state;
    document.getElementById('xuc-confirm').textContent = _t('admin.updates.changelog.confirm', { version: versions.latest });
    document.getElementById('xuc-body').focus();
    _uclLoad(state, versions);
}
