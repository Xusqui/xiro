/**
 * @fileoverview Historial de partidas - módulo del panel de administración
 * Muestra las últimas partidas jugadas con acceso a descarga de CSV.
 * Soporta selección múltiple para borrado en lote.
 */

/**
 * Descarga el CSV de una sesión de forma autenticada (fetch+Blob).
 * Funciona tanto para rutas públicas (/shared/:token) como protegidas (/session/:id).
 * Los <a href download> nativos no envían el header Authorization, por eso usamos fetch.
 */
let _historialDelegationReady = false;

async function _downloadSessionFile(url, filename) {
    try {
        const res = await fetchWithAuth(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || 'resultados.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (err) {
        mostrarModalError(_t('admin.history.error_download', null, 'Error al descargar'), err.message, 'error');
    }
}

/* ===== RENDER PRINCIPAL ===== */

async function renderVistaHistorial() {
    const editorArea = document.getElementById('editorArea');
    editorArea.innerHTML = _tHtml(`
        <div class="p-6 max-w-6xl mx-auto">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                    <button data-historial-action="go-config"
                        class="text-slate-400 hover:text-slate-700 transition p-1" title="Volver a Config">
                        <i class="fas fa-arrow-left text-xl"></i>
                    </button>
                    <div>
                        <h2 class="text-2xl font-black text-slate-800">${_t('admin.history.title', null, 'Historial de partidas')}</h2>
                        <p class="text-slate-500 text-sm mt-1">${_t('admin.history.subtitle', null, 'Descarga los resultados de cualquier partida jugada')}</p>
                    </div>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <a href="/xiro-results-viewer.html" target="_blank"
                        class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-lg transition flex items-center gap-2">
                        <i class="fas fa-chart-bar"></i> ${_t('admin.history.btn_viewer', null, 'Visor gráfico')}
                    </a>
                    <button data-historial-action="refresh"
                        class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2 rounded-lg transition flex items-center gap-2">
                        <i class="fas fa-sync-alt"></i> ${_t('admin.common.refresh', null, 'Actualizar')}
                    </button>
                    <button data-historial-action="delete-all"
                        class="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-4 py-2 rounded-lg transition flex items-center gap-2">
                        <i class="fas fa-trash-alt"></i> ${_t('admin.history.btn_delete_all', null, 'Borrar todo')}
                    </button>
                </div>
            </div>
            <div id="historial-content">
                <div class="flex items-center justify-center py-16 text-slate-400">
                    <i class="fas fa-spinner fa-spin text-3xl mr-3"></i>
                    <span>${_t('admin.history.loading', null, 'Cargando historial…')}</span>
                </div>
            </div>
        </div>`);

    try {
        const res = await fetch('/api/results/history?limit=100', {
            headers: { 'Authorization': 'Bearer ' + getAuthToken() }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const sessions = await res.json();
        _renderHistorialTable(sessions);
    } catch (err) {
        document.getElementById('historial-content').innerHTML = _tHtml(`
            <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                ${_t('admin.history.error_load', null, 'Error al cargar el historial')}: ${err.message}
            </div>`);
    }
}

/* ===== HELPERS ===== */

function _fmtDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function _fmtDuration(ms) {
    if (!ms || ms < 0) return '—';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const _gameTypeLabels = {
    custom_game: 'Personalizado',
    bank: 'Banco',
    game: 'Juego',
    quiz: 'Quiz',
    trivial: 'Trivial'
};

function _fmtType(type) {
    return _gameTypeLabels[type] || type || '—';
}

/* ===== SELECCIÓN Y BORRADO EN LOTE ===== */

function _getSelectedIds() {
    return Array.from(document.querySelectorAll('.historial-row-checkbox:checked'))
        .map(cb => parseInt(cb.dataset.id, 10));
}

function _updateBatchBar() {
    const selected = _getSelectedIds();
    const bar = document.getElementById('historial-batch-bar');
    const count = document.getElementById('historial-batch-count');
    const btn = document.querySelector('[data-historial-action="delete-selected"]');
    if (!count) return;
    const none = selected.length === 0;
    count.textContent = selected.length;
    if (bar) bar.style.opacity = none ? '0.4' : '1';
    if (btn) {
        btn.disabled = none;
        btn.style.cursor = none ? 'not-allowed' : 'pointer';
    }
}

function _toggleSelectAll(masterCb) {
    const checkboxes = document.querySelectorAll('.historial-row-checkbox');
    checkboxes.forEach(cb => { cb.checked = masterCb.checked; });
    _updateBatchBar();
}

async function _borrarSeleccionadas() {
    const ids = _getSelectedIds();
    if (ids.length === 0) return;
    mostrarModalConfirmacion(
        _t('admin.historial.confirm_delete_selected_title', { n: ids.length }, `🗑️ Borrar ${ids.length} partida${ids.length !== 1 ? 's' : ''}`),
        _t('admin.historial.confirm_delete_selected_msg', { n: ids.length }, `¿Estás seguro de que quieres borrar las ${ids.length} partidas seleccionadas? Esta acción no se puede deshacer.`),
        async () => {
            try {
                const res = await fetch('/api/results/sessions/batch', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + getAuthToken(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ids })
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                renderVistaHistorial();
            } catch (err) {
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), 'Error al borrar: ' + err.message, 'error');
            }
        },
        null,
        _t('admin.historial.btn_delete_selected', null, 'Borrar seleccionadas'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

/* ===== BORRADO INDIVIDUAL ===== */

async function _borrarSesion(id, btn) {
    mostrarModalConfirmacion(
        _t('admin.historial.confirm_delete_one_title', null, '🗑️ Borrar partida'),
        _t('admin.historial.confirm_delete_one_msg', null, '¿Estás seguro de que quieres borrar esta partida? Esta acción no se puede deshacer.'),
        async () => {
            btn.disabled = true;
            btn.innerHTML = _tHtml('<i class="fas fa-spinner fa-spin"></i>');
            try {
                const res = await fetch(`/api/results/session/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + getAuthToken() }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                btn.closest('tr').remove();
                _updateBatchBar();
            } catch (err) {
                btn.disabled = false;
                btn.innerHTML = _tHtml('<i class="fas fa-trash-alt"></i>');
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), 'Error al borrar: ' + err.message, 'error');
            }
        },
        null,
        _t('admin.common.delete', null, 'Borrar'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

async function _confirmarBorrarHistorial() {
    mostrarModalConfirmacion(
        _t('admin.historial.confirm_delete_all_title', null, '⚠️ Borrar todo el historial'),
        _t('admin.historial.confirm_delete_all_msg', null, '¿Estás seguro de que quieres borrar TODAS las partidas guardadas? Esta acción no se puede deshacer.'),
        async () => {
            try {
                const res = await fetch('/api/results/history', {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + getAuthToken() }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                renderVistaHistorial();
            } catch (err) {
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), 'Error al borrar: ' + err.message, 'error');
            }
        },
        null,
        _t('admin.history.btn_delete_all', null, 'Borrar todo'),
        _t('admin.common.cancel', null, 'Cancelar')
    );
}

function _renderHistorialTable(sessions) {
    const container = document.getElementById('historial-content');
    if (!sessions || sessions.length === 0) {
        container.innerHTML = _tHtml(`
            <div class="bg-slate-100 rounded-xl p-12 text-center text-slate-400">
                <i class="fas fa-inbox text-5xl mb-4"></i>
                <p class="font-bold text-lg">${_t('admin.history.empty_title', null, 'No hay partidas registradas todavía')}</p>
                <p class="text-sm mt-1">${_t('admin.history.empty_subtitle', null, 'Las partidas se guardan automáticamente al finalizar')}</p>
            </div>`);
        return;
    }

    const rows = sessions.map(s => {
        const csvUrl = s.share_token ? '/api/results/shared/' + s.share_token + '/export.csv' : '/api/results/session/' + s.id + '/export.csv';
        const csvFilename = 'partida-' + s.pin + '-' + s.id + '.csv';
        const logsUrl = '/api/results/session/' + s.id + '/export-logs?format=txt';
        const logsFilename = 'logs-' + s.pin + '-' + s.id + '.txt';
        let reasonBadge = '';
        if (s.reason === 'completed') {
            reasonBadge = `<span class="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">${_t('admin.history.status_completed', null, '✓ Completada')}</span>`;
        } else if (s.reason === 'manual') {
            reasonBadge = `<span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">${_t('admin.history.status_finalized', null, '✓ Finalizada')}</span>`;
        } else if (s.reason === 'aborted' || s.reason === 'abandoned') {
            reasonBadge = `<span class="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">${_t('admin.history.status_abandoned', null, '✗ Abandonada')}</span>`;
        } else if (s.reason === 'auto-saved') {
            reasonBadge = `<span class="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">${_t('admin.history.status_autosaved', null, '⏳ Auto-saved')}</span>`;
        } else {
            reasonBadge = `<span class="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">${s.reason || '—'}</span>`;
        }

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="py-3 px-3">
                    <input type="checkbox" class="historial-row-checkbox w-4 h-4 accent-indigo-600 cursor-pointer"
                        data-id="${s.id}" data-historial-action="row-select">
                </td>
                <td class="py-3 px-4 font-mono font-bold text-slate-700">${s.pin}</td>
                <td class="py-3 px-4 text-slate-600">${_fmtDate(s.played_at)}</td>
                <td class="py-3 px-4 whitespace-nowrap">
                    <span class="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">${_fmtType(s.game_type)}</span>
                </td>
                <td class="py-3 px-2 text-center text-slate-600">${s.player_count ?? '—'}</td>
                <td class="py-3 px-2 text-center text-slate-600">${s.question_count || '—'}</td>
                <td class="py-3 px-4 text-slate-500 text-sm">${_fmtDuration(s.duration_ms)}</td>
                <td class="py-3 px-4">${reasonBadge}</td>
                <td class="py-3 px-4">
                    <div class="flex gap-1">
                        <a href="${s.share_token ? '/xiro-results-viewer.html?token=' + s.share_token : '/xiro-results-viewer.html?id=' + s.id}" target="_blank"
                            class="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold w-8 h-8 rounded-lg transition"
                            title="Ver resultados">
                            <i class="fas fa-chart-bar"></i>
                        </a>
                        <button data-historial-action="download-csv" data-url="${csvUrl}" data-filename="${csvFilename}"
                            class="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold w-8 h-8 rounded-lg transition"
                            title="Descargar resultados CSV">
                            <i class="fas fa-download"></i>
                        </button>
                        <button data-historial-action="download-logs" data-url="${logsUrl}" data-filename="${logsFilename}"
                            class="inline-flex items-center justify-center bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold w-8 h-8 rounded-lg transition"
                            title="Descargar logs TXT">
                            <i class="fas fa-file-alt"></i>
                        </button>
                        <button data-historial-action="delete-session" data-id="${s.id}"
                            class="inline-flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold w-8 h-8 rounded-lg transition"
                            title="Borrar esta partida">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    container.innerHTML = _tHtml(`
        <!-- Barra de selección / borrado en lote -->
        <div id="historial-batch-bar" style="opacity:0.4;transition:opacity 0.15s" class="mb-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span class="text-indigo-800 font-bold text-sm">
                <i class="fas fa-check-square mr-2"></i>
                <span id="historial-batch-count">0</span> ${_t('admin.history.batch_label', { n: '' }, '{n} partida(s) seleccionada(s)').replace('{n}', '').trim()}
            </span>
            <button data-historial-action="delete-selected" disabled
                style="cursor:not-allowed"
                class="bg-red-600 hover:bg-red-500 text-white font-bold text-sm px-4 py-1.5 rounded-lg flex items-center gap-2">
                <i class="fas fa-trash-alt"></i> ${_t('admin.historial.btn_delete_selected', null, 'Borrar seleccionadas')}
            </button>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                        <th class="py-3 px-3">
                            <input type="checkbox" class="w-4 h-4 accent-indigo-600 cursor-pointer"
                                title="Seleccionar todas" data-historial-action="select-all">
                        </th>
                        <th class="py-3 px-4 text-left font-bold">PIN</th>
                        <th class="py-3 px-4 text-left font-bold">${_t('admin.history.col_date', null, 'Fecha')}</th>
                        <th class="py-3 px-4 text-left font-bold">${_t('admin.history.col_type', null, 'Tipo')}</th>
                        <th class="py-3 px-2 text-center font-bold w-16">${_t('admin.history.col_players', null, 'Jugadores')}</th>
                        <th class="py-3 px-2 text-center font-bold w-16">${_t('admin.history.col_questions', null, 'Preguntas')}</th>
                        <th class="py-3 px-4 text-left font-bold">${_t('admin.history.col_duration', null, 'Duración')}</th>
                        <th class="py-3 px-4 text-left font-bold">${_t('admin.history.col_status', null, 'Estado')}</th>
                        <th class="py-3 px-4 text-left font-bold">${_t('admin.history.col_actions', null, 'Acciones')}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            </div>
            <div class="p-4 text-xs text-slate-400 border-t border-slate-100">
                ${_t('admin.history.footer', { n: sessions.length, s: sessions.length !== 1 ? 's' : '' }, '{n} partida{s} registrada{s}').replace(/\{n\}/g, sessions.length).replace(/\{s\}/g, sessions.length !== 1 ? 's' : '')}
            </div>
        </div>`);
}

function _initHistorialDelegation() {
    if (_historialDelegationReady) return;
    _historialDelegationReady = true;

    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-historial-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.historialAction;
        switch (action) {
            case 'go-config':
                if (typeof switchSectionTab === 'function') switchSectionTab('config', false);
                break;
            case 'refresh':
                renderVistaHistorial();
                break;
            case 'delete-all':
                _confirmarBorrarHistorial();
                break;
            case 'download-csv':
                if (actionElement.dataset.url) {
                    _downloadSessionFile(actionElement.dataset.url, actionElement.dataset.filename || 'resultados.csv');
                }
                break;
            case 'download-logs':
                if (actionElement.dataset.url) {
                    _downloadSessionFile(actionElement.dataset.url, actionElement.dataset.filename || 'logs.txt');
                }
                break;
            case 'delete-session':
                if (actionElement.dataset.id) {
                    _borrarSesion(parseInt(actionElement.dataset.id, 10), actionElement);
                }
                break;
            case 'delete-selected':
                _borrarSeleccionadas();
                break;
            default:
                break;
        }
    });

    document.addEventListener('change', (event) => {
        const actionElement = event.target.closest('[data-historial-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.historialAction;
        if (action === 'row-select') {
            _updateBatchBar();
            return;
        }
        if (action === 'select-all') {
            _toggleSelectAll(actionElement);
        }
    });
}

_initHistorialDelegation();

