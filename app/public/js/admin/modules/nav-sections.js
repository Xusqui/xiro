/**
 * @fileoverview Gestión de las secciones principales del panel de administración
 * Tabs de primer nivel: PREGUNTAS | USER | CONFIGURACIÓN (solo admin)
 * Controla la visibilidad de las subsecciones del sidebar.
 */

/* ===== ESTADO ===== */
let activeSectionTab = 'questions'; // 'questions' | 'user' | 'config'

/* ===== INICIALIZACIÓN ===== */

/**
 * Inyecta los tabs de sección en el sidebar y oculta config si no es admin.
 * Debe llamarse desde applyRolePermissions() (ya con sesión activa).
 */
function initSectionTabs() {
    const tabsContainer = document.getElementById('section-tabs');
    if (!tabsContainer) return;

    // Mostrar u ocultar el tab de Configuración según el rol
    const configTab = document.getElementById('section-tab-config');
    if (configTab) {
        configTab.style.display = isAdmin() ? '' : 'none';
    }

    switchSectionTab('questions', false);
}

/* ===== CAMBIO DE SECCIÓN ===== */

/**
 * Cambia la sección activa del panel.
 * @param {'questions'|'user'|'config'} tab
 * @param {boolean} [guard=true] - pasar por el guard de cambios sin guardar
 */
function switchSectionTab(tab, guard = true) {
    function doSwitch() {
        activeSectionTab = tab;
        _updateTabStyles();

        const navSection = document.getElementById('sidebar-nav-section');
        const utilsSection = document.getElementById('sidebar-utils-section');
        const userSidebar = document.getElementById('user-sidebar-section');
        const configSidebar = document.getElementById('config-sidebar-section');

        if (tab === 'questions') {
            if (navSection) navSection.style.display = '';
            if (utilsSection) utilsSection.style.display = '';
            if (userSidebar) userSidebar.style.display = 'none';
            if (configSidebar) configSidebar.style.display = 'none';
            const editorArea = document.getElementById('editorArea');
            if (editorArea) {
                editorArea.dataset.fromConfig = '';
                renderAdminHome(editorArea);
            }
        } else if (tab === 'user') {
            if (navSection) navSection.style.display = 'none';
            if (utilsSection) utilsSection.style.display = '';
            if (userSidebar) userSidebar.style.display = 'flex';
            if (configSidebar) configSidebar.style.display = 'none';
            if (typeof initUserSidebarNavigation === 'function') {
                initUserSidebarNavigation();
            }
            if (typeof switchUserPanelView === 'function') {
                switchUserPanelView('account');
            } else {
                renderUserPanel();
            }
        } else if (tab === 'config') {
            if (navSection) navSection.style.display = 'none';
            if (userSidebar) userSidebar.style.display = 'none';
            if (utilsSection) utilsSection.style.display = '';
            if (configSidebar) configSidebar.style.display = 'flex';
            renderConfigPanel();
            if (typeof highlightSidebarNav === 'function') highlightSidebarNav('servidor');
        }
    }

    if (guard && tab !== activeSectionTab) {
        navigateWithUnsavedChangesGuard(doSwitch);
    } else {
        doSwitch();
    }
}

/* ===== RE-RENDER ON LANGUAGE CHANGE ===== */

window.addEventListener('xiro:language-changed', () => {
    if (activeSectionTab === 'config' && typeof renderConfigPanel === 'function') {
        renderConfigPanel();
    } else if (activeSectionTab === 'user' && typeof switchUserPanelView === 'function') {
        switchUserPanelView(
            (typeof activeUserPanelView !== 'undefined' ? activeUserPanelView : null) || 'account'
        );
    }
    // 'questions' section is handled by admin-main.js via mostrarVista(activeView);
    // sin vista activa lo que se ve es la portada
    if (activeSectionTab === 'questions' && typeof activeView !== 'undefined' && !activeView) {
        const editorArea = document.getElementById('editorArea');
        if (editorArea) renderAdminHome(editorArea);
    }
});

/* ===== PORTADA DEL ADMIN ===== */
// Antes: logo desvaído y «Selecciona una categoría para comenzar». Ahora lo que
// se busca al entrar: accesos a cada sección, partidas en curso (solo admin),
// las últimas partidas y el estado de la licencia. Cada bloque carga por su
// cuenta y, si su petición falla, se oculta sin romper el resto.

const ADMIN_HOME_SHORTCUTS = [
    { view: 'bancos', key: 'admin.nav.banks', fallback: 'Bancos de Preguntas', icon: 'fa-database', color: '#94438e', tint: '#f9e6f7' },
    { view: 'juegos', key: 'admin.nav.games', fallback: 'Mezcla de Preguntas', icon: 'fa-gamepad', color: '#16a34a', tint: '#dcfce7' },
    { view: 'personalizados', key: 'admin.nav.custom', fallback: 'Juegos Personalizados', icon: 'fa-star', color: '#2563eb', tint: '#dbeafe' },
    { view: 'trivial', key: 'admin.nav.trivial', fallback: 'Trivial Pursuit', icon: 'fa-dice', color: '#ea580c', tint: '#ffedd5' }
];

function renderAdminHome(editorArea) {
    const shortcuts = ADMIN_HOME_SHORTCUTS.map(s => `
        <button data-admin-action="show-view" data-view="${s.view}"
            class="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition p-5 flex items-center gap-4 text-left">
            <span class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style="background:${s.tint};color:${s.color}">
                <i class="fas ${s.icon} text-xl"></i>
            </span>
            <span class="font-bold text-slate-800">${_t(s.key, null, s.fallback)}</span>
        </button>`).join('');

    editorArea.innerHTML = _tHtml(`
        <div class="p-6 max-w-6xl mx-auto">
            <div class="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">${_t('admin.home.title', null, 'Inicio')}</h2>
                    <p class="text-slate-500 text-sm mt-1">${_t('admin.home.subtitle', null, 'Resumen del servidor y accesos rápidos')}</p>
                </div>
                <div id="admin-home-license"></div>
            </div>
            <div class="admin-home-shortcuts mb-6">${shortcuts}</div>
            <div id="admin-home-live" class="mb-6"></div>
            <div id="admin-home-recent"></div>
        </div>`);

    _renderAdminHomeLicense();
    _renderAdminHomeLive();
    _renderAdminHomeRecent();
}

function _adminHomeFetch(url, withAuth) {
    const headers = withAuth && typeof getAuthToken === 'function' ? { Authorization: 'Bearer ' + getAuthToken() } : {};
    return fetch(url, { headers }).then(res => (res.ok ? res.json() : null)).catch(() => null);
}

function _adminHomePanel(title, body, extra) {
    return `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                <h3 class="font-black text-slate-800">${title}</h3>${extra || ''}
            </div>
            ${body}
        </div>`;
}

async function _renderAdminHomeLicense() {
    const box = document.getElementById('admin-home-license');
    const data = await _adminHomeFetch('/api/license/public-status', false);
    if (!box || !data || !data.success) return;
    let until = '';
    if (data.licensed && data.expiresAt) {
        const date = new Date(data.expiresAt).toLocaleDateString(document.documentElement.lang || undefined);
        until = ' · ' + _t('admin.home.license_until', { date }, 'hasta {date}').replace('{date}', date);
    }
    const ok = Boolean(data.licensed);
    box.innerHTML = _tHtml(`
        <span class="inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold px-3 py-1.5 rounded-full ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}">
            <i class="fas ${ok ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            ${ok ? _t('admin.home.license_ok', null, 'Licencia activa') : _t('admin.home.license_missing', null, 'Sin licencia')}${until}
        </span>`);
}

async function _renderAdminHomeLive() {
    const box = document.getElementById('admin-home-live');
    // Solo administradores: para un editor responde 403 y el bloque no aparece
    const data = await _adminHomeFetch('/api/admin/active-sessions', true);
    if (!box || !data || !Array.isArray(data.sessions)) return;
    const playersLabel = _t('admin.history.col_players', null, 'Jugadores');
    const body = data.sessions.length === 0
        ? `<p class="px-5 py-6 text-sm text-slate-400">${_t('admin.home.live_empty', null, 'No hay ninguna partida en curso')}</p>`
        : `<ul class="admin-home-list">${data.sessions.map(s => {
            const where = s.state === 'lobby'
                ? _t('admin.home.lobby', null, 'En sala')
                : _t('admin.home.question_of', { n: (s.currentIndex || 0) + 1, total: s.totalQuestions || 0 }, 'Pregunta {n} de {total}')
                    .replace('{n}', (s.currentIndex || 0) + 1).replace('{total}', s.totalQuestions || 0);
            return `<li class="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                <span class="font-mono font-bold text-slate-700">${escapeHtml(s.sessionId || s.pin || '')}</span>
                <span class="text-slate-500">${where}</span>
                <span class="text-slate-500 whitespace-nowrap">${s.playerCount || 0} ${playersLabel.toLowerCase()}</span>
            </li>`;
        }).join('')}</ul>`;
    box.innerHTML = _tHtml(_adminHomePanel(_t('admin.home.live_title', null, 'Partidas en curso'), body));
}

async function _renderAdminHomeRecent() {
    const box = document.getElementById('admin-home-recent');
    const sessions = await _adminHomeFetch('/api/results/history?limit=5', true);
    if (!box || !Array.isArray(sessions)) return;
    const fmtDate = typeof _fmtDate === 'function' ? _fmtDate : (d => d || '—');
    const fmtType = typeof _fmtType === 'function' ? _fmtType : (t => t || '—');
    const body = sessions.length === 0
        ? `<p class="px-5 py-6 text-sm text-slate-400">${_t('admin.history.empty_title', null, 'No hay partidas registradas todavía')}</p>`
        : `<ul class="admin-home-list">${sessions.map(s => `
            <li class="px-5 py-3 flex items-center gap-4 text-sm">
                <span class="font-mono font-bold text-slate-700 w-24 shrink-0">${escapeHtml(s.pin || '')}</span>
                <span class="text-slate-500 flex-1">${fmtDate(s.played_at)}</span>
                <span class="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">${escapeHtml(fmtType(s.game_type))}</span>
                <span class="text-slate-500 whitespace-nowrap w-12 text-right">${s.player_count ?? '—'} <i class="fas fa-user text-xs"></i></span>
            </li>`).join('')}</ul>`;
    const seeAll = `<button data-admin-action="show-view" data-view="historial"
        class="text-sm font-bold text-aubergine-600 whitespace-nowrap">${_t('admin.home.see_all', null, 'Ver historial completo')} <i class="fas fa-arrow-right text-xs"></i></button>`;
    box.innerHTML = _tHtml(_adminHomePanel(_t('admin.home.recent_title', null, 'Últimas partidas'), body, seeAll));
}

/* ===== ESTILOS DE TABS ===== */

function _updateTabStyles() {
    const tabs = {
        questions: 'section-tab-questions',
        user: 'section-tab-user',
        config: 'section-tab-config'
    };
    for (const [key, id] of Object.entries(tabs)) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (key === activeSectionTab) {
            el.classList.add('bg-slate-700', 'text-white');
            el.classList.remove('text-slate-400', 'hover:text-white');
        } else {
            el.classList.remove('bg-slate-700', 'text-white');
            el.classList.add('text-slate-400', 'hover:text-white');
        }
    }
}
