/**
 * @fileoverview Menú del panel en pantallas estrechas (<1024 px): la barra lateral de
 * escritorio pasa a menú deslizante y una barra superior muestra la pantalla actual.
 * Desde 1024 px este módulo no interviene. Estilos en css/admin-mobile.css.
 */

const _adminMenuQuery = window.matchMedia('(max-width: 1023.98px)');
const _ADMIN_MENU_BACKGROUND_IDS = ['editorArea', 'admin-mobile-bar'];

function _setAdminMenuState(open) {
    const root = document.getElementById('admin-content');
    if (!root) return;
    root.dataset.menu = open ? 'open' : 'closed';
    document.getElementById('admin-menu-toggle')?.setAttribute('aria-expanded', String(open));
    // Lo que queda bajo el menú no recibe foco ni lo anuncia el lector de pantalla
    _ADMIN_MENU_BACKGROUND_IDS.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.inert = open;
    });
}

function isAdminMenuOpen() {
    return document.getElementById('admin-content')?.dataset.menu === 'open';
}

/** Abre el menú y lleva el foco a su botón de cierre. */
function openAdminMenu() {
    _setAdminMenuState(true);
    document.getElementById('admin-menu-close')?.focus();
}

/**
 * Cierra el menú si está abierto.
 * @param {boolean} [returnFocus=true] - devolver el foco al botón que lo abre
 */
function closeAdminMenu(returnFocus = true) {
    if (!isAdminMenuOpen()) return;
    _setAdminMenuState(false);
    if (returnFocus) document.getElementById('admin-menu-toggle')?.focus();
}

/**
 * Copia en la barra superior el nombre de la entrada activa del menú. Se copia la clave
 * data-i18n, no solo el texto: al cambiar de idioma i18n-dom.js retraduce el título.
 */
function syncAdminMobileTitle() {
    const title = document.getElementById('admin-mobile-title');
    const label = document.querySelector('#admin-sidebar .nav-button.is-active :is(span, p)[data-i18n]');
    if (!title || !label) return;
    title.dataset.i18n = label.dataset.i18n;
    title.textContent = _t(label.dataset.i18n, null, label.textContent);
}

/** Vuelve a la portada del panel, respetando los cambios sin guardar. */
function showAdminHome() {
    navigateWithUnsavedChangesGuard(() => switchSectionTab('questions', false));
}

/** Abre Juegos en curso desde cualquier pantalla; el menú queda en la sección Config. */
function showLiveGames() {
    navigateWithUnsavedChangesGuard(() => {
        showSidebarSection('config');
        mostrarVista('remote');
    });
}

/* Cambiar de pestaña de sección no es un destino: aún falta elegir la entrada */
function _onAdminSidebarClick(event) {
    const destination = event.target.closest('a[href], [data-admin-action]');
    if (destination && destination.dataset.adminAction !== 'switch-section-tab') closeAdminMenu();
}

function _initAdminMobileNav() {
    document.getElementById('admin-menu-toggle')?.addEventListener('click', openAdminMenu);
    document.getElementById('admin-menu-close')?.addEventListener('click', () => closeAdminMenu());
    document.getElementById('admin-nav-veil')?.addEventListener('click', () => closeAdminMenu());
    document.getElementById('admin-sidebar')?.addEventListener('click', _onAdminSidebarClick);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeAdminMenu();
    });
    _adminMenuQuery.addEventListener('change', () => closeAdminMenu(false));
}

_initAdminMobileNav();
