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
                editorArea.innerHTML = _tHtml(`
                    <div class="h-full flex flex-col items-center justify-center relative overflow-hidden">
                        <img src="/images/logo.svg" alt=""
                            class="absolute pointer-events-none select-none"
                            style="width:80%;max-width:80%;opacity:0.1;">
                        <div class="relative z-10 flex flex-col items-center text-slate-400">
                            <i class="fas fa-th-large text-5xl mb-4"></i>
                            <p class="text-xl font-bold">${_t('admin.home.empty.title', null, 'Selecciona una categoría para comenzar')}</p>
                            <p class="text-sm mt-2">${_t('admin.home.empty.sub', null, 'Usa el menú lateral para navegar')}</p>
                        </div>
                    </div>`);
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
    // 'questions' section is handled by admin-main.js via mostrarVista(activeView)
});

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
