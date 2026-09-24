/**
 * @fileoverview Tab "Juegos en Curso" del panel de administración
 * Muestra las partidas activas y permite abrir el control remoto móvil.
 *
 * Dependencias globales (cargadas antes en admin.html):
 *   getAuthToken(), handleUnauthorized()  ← core/auth.js
 */

/* ── Estado del módulo ───────────────────────────────────────────────────── */

let _remoteRefreshTimer = null;

/* ── Punto de entrada ────────────────────────────────────────────────────── */

async function renderVistaRemote() {
    const area = document.getElementById('editorArea');
    if (!area) return;

    stopRemoteRefresh();

    area.innerHTML = _tHtml(`
    <div class="p-6 max-w-3xl mx-auto">
        <div class="flex items-center justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <i class="fas fa-satellite-dish text-green-600"></i>
                    Juegos en Curso
                </h2>
                <p class="text-slate-500 text-sm mt-1">
                    Abre "Controlar" en tu móvil para usar el mando a distancia
                </p>
            </div>
            <button data-admin-action="reload-remote-sessions"
                class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg
                       font-bold text-sm flex items-center gap-2 transition">
                <i class="fas fa-sync-alt"></i> Actualizar
            </button>
        </div>
        <div id="remote-sessions-list">
            <div class="text-slate-400 text-center py-12">
                <i class="fas fa-spinner fa-spin text-3xl mb-3 block"></i>
                <p>Cargando sesiones activas...</p>
            </div>
        </div>
    </div>`);

    await cargarSesionesActivas();
    _remoteRefreshTimer = setInterval(cargarSesionesActivas, 8000);
}

/* ── Carga de datos ──────────────────────────────────────────────────────── */

async function cargarSesionesActivas() {
    const list = document.getElementById('remote-sessions-list');
    if (!list) { stopRemoteRefresh(); return; }

    try {
        const token = getAuthToken();
        const res = await fetch('/api/admin/active-sessions', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        renderSessionsList(data.sessions || []);
    } catch (err) {
        const l2 = document.getElementById('remote-sessions-list');
        if (l2) {
            l2.innerHTML = _tHtml(`
            <div class="text-red-500 text-center py-8">
                <i class="fas fa-exclamation-triangle text-2xl mb-2 block"></i>
                <p>Error al cargar sesiones: ${_escHtml(err.message)}</p>
            </div>`);
        }
    }
}

async function recargarSesionesActivas() {
    await cargarSesionesActivas();
}

function stopRemoteRefresh() {
    if (_remoteRefreshTimer) {
        clearInterval(_remoteRefreshTimer);
        _remoteRefreshTimer = null;
    }
}

/* ── Renderizado ─────────────────────────────────────────────────────────── */

function renderSessionsList(sessions) {
    const list = document.getElementById('remote-sessions-list');
    if (!list) return;

    if (!sessions.length) {
        list.innerHTML = _tHtml(`
        <div class="text-center py-16 text-slate-400">
            <i class="fas fa-tv text-5xl mb-4 opacity-40 block"></i>
            <p class="text-lg font-bold">${_t('admin.remote.empty_title', null, 'No hay partidas activas ahora mismo')}</p>
            <p class="text-sm mt-1">
                ${_t('admin.remote.empty_msg', null, 'Inicia una partida desde el presentador para controlarla aquí')}
            </p>
        </div>`);
        return;
    }

    list.innerHTML = sessions.map(s => {
        const stateLabel = s.state === 'lobby'
            ? 'En lobby'
            : `P ${s.currentIndex + 1}/${s.totalQuestions}`;
        const stateCss = s.state === 'lobby'
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-green-100 text-green-700';
        const url = `/presentador.html?pin=${encodeURIComponent(s.pin)}&remote=true`;
        const players = `${s.playerCount} jugador${s.playerCount !== 1 ? 'es' : ''}`;
        const sessionIdEsc = _escHtml(s.sessionId);

        return `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5
                    flex items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 bg-green-100 rounded-xl flex items-center
                            justify-center flex-shrink-0">
                    <span class="text-green-700 font-black text-xl">
                        ${_escHtml(s.pin)}
                    </span>
                </div>
                <div>
                    <p class="font-bold text-slate-800">PIN: ${_escHtml(s.pin)}</p>
                    <p class="text-slate-500 text-sm">${_escHtml(players)}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 rounded-full
                                 text-xs font-bold ${stateCss}">
                        ${_escHtml(stateLabel)}
                    </span>
                </div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
                <a href="${url}"
                   class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-3
                          rounded-xl flex items-center gap-2 transition whitespace-nowrap">
                    <i class="fas fa-mobile-alt"></i> Controlar
                </a>
                <button data-admin-action="terminate-remote-session" data-session-id="${sessionIdEsc}"
                   class="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-4 py-3
                          rounded-xl flex items-center gap-2 transition whitespace-nowrap">
                    <i class="fas fa-times-circle"></i> Terminar
                </button>
            </div>
        </div>`;
    }).join('');
}

/* ── Terminar sesión ─────────────────────────────────────────────────────── */

async function terminarSesionAdmin(sessionId) {
    mostrarModalConfirmacion(
        '⚠️ Terminar sesión',
        `¿Terminar la sesión ${sessionId}? Se expulsará a todos los jugadores.`,
        async () => {
            try {
                const token = getAuthToken();
                const res = await fetch('/api/admin/terminate-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ sessionId })
                });

                if (res.status === 401 || res.status === 403) { handleUnauthorized(); return; }

                const data = await res.json();
                if (data.success) {
                    await cargarSesionesActivas();
                } else {
                    mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), `Error al terminar sesión: ${data.error || 'Error desconocido'}`, 'error');
                }
            } catch (err) {
                mostrarModalError(_t('admin.common.error_title', null, '❌ Error'), err.message, 'error');
            }
        }
    );
}

/* ── Utilidades ──────────────────────────────────────────────────────────── */

function _escHtml(str) {
    return String(str).replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c])
    );
}
