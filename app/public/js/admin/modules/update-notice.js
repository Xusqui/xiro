/**
 * @fileoverview Aviso de versión nueva en la barra lateral del panel (solo administradores).
 * Consulta /api/admin/update/status al entrar y cada hora (el servidor cachea la consulta a Docker Hub una hora);
 * al pulsarlo abre Configuración → Actualizaciones.
 */
const _UPD_NOTICE_INTERVAL_MS = 60 * 60 * 1000;
let _updNoticeTimer = null;

/**
 * @async
 * @function checkForUpdateNotice
 * @description Verifica si hay una nueva versión disponible y muestra un aviso en el sidebar si es así.
 */
async function checkForUpdateNotice() {
    if (typeof getUserRole !== 'function' || getUserRole() !== 'admin') return;

    if (!_updNoticeTimer) {
        _updNoticeTimer = setInterval(checkForUpdateNotice, _UPD_NOTICE_INTERVAL_MS);
    }

    try {
        const res = await fetch('/api/admin/update/status', {
            headers: { 'Authorization': 'Bearer ' + getAuthToken() }
        });
        const body = await res.json();
        _updRenderNotice(body && body.success && body.updateAvailable ? body.latest : null);
    } catch {
        // sin aviso si falla
    }
}

/**
 * @function _updRenderNotice
 * @description Renderiza el aviso de actualización en el sidebar.
 * @param {string|null} version - Versión disponible o null si no hay actualización.
 */
function _updRenderNotice(version) {
    let notice = document.getElementById('update-notice');
    if (!version) {
        if (notice) notice.remove();
        return;
    }

    if (!notice) {
        const badge = document.getElementById('role-badge');
        if (!badge) return;

        notice = document.createElement('button');
        notice.id = 'update-notice';
        notice.type = 'button';
        notice.dataset.updateAction = 'open-tab';
        notice.className = 'mt-2 w-full px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-1.5 cursor-pointer border-0';
        badge.insertAdjacentElement('afterend', notice);
    }

    notice.title = _t('admin.updates.notice_title');
    notice.innerHTML = '<i class="fas fa-cloud-download-alt"></i> ' + escapeHtml(_t('admin.updates.notice', { version }));
}

/**
 * @function handleUpdateNoticeClick
 * @description Maneja el clic en el aviso de actualización para abrir la pestaña de actualizaciones.
 * @param {Event} event - Evento de clic.
 */
function handleUpdateNoticeClick(event) {
    const btn = event.target.closest('[data-update-action="open-tab"]');
    if (!btn) return;

    if (typeof openConfigTab === 'function') openConfigTab('updates');
}

// Escuchar clics en el documento para manejar el aviso de actualización
document.addEventListener('click', handleUpdateNoticeClick);
