'use strict';

/**
 * Guard de acceso para el Bot Runner (/autorun/index.html).
 *
 * Esta herramienta solo debe estar disponible para administradores. Como las
 * páginas estáticas no pueden validar el JWT en el servidor (el token vive en
 * localStorage, igual que en el panel admin), replicamos aquí el mismo patrón
 * de protección que usa admin.html: verificamos la sesión contra la API y solo
 * cargamos bots.js si el usuario está autenticado con rol 'admin'.
 */
(function () {
    const ADMIN_TOKEN_KEY = 'adminToken';
    const ADMIN_SESSION_KEY = 'adminSession';
    // Mismas claves que limpia el panel admin (core/auth.js → clearAdminSession).
    const ADMIN_SESSION_KEYS = [
        ADMIN_SESSION_KEY,
        ADMIN_TOKEN_KEY,
        'adminRole',
        'adminUserId',
        'adminUsername'
    ];
    const LOGIN_URL = '/admin.html';
    const BOTS_SCRIPT = '/autorun/bots.js?v=20260615-130508';

    function redirectToLogin() {
        window.location.replace(LOGIN_URL);
    }

    function logout() {
        ADMIN_SESSION_KEYS.forEach(key => localStorage.removeItem(key));
        window.location.replace(LOGIN_URL);
    }

    function isSessionExpired() {
        try {
            const raw = localStorage.getItem(ADMIN_SESSION_KEY);
            if (!raw) return true;
            const parsed = JSON.parse(raw);
            return !(parsed && parsed.expires && parsed.expires > Date.now());
        } catch {
            return true;
        }
    }

    function grantAccess() {
        const gate = document.getElementById('authGate');
        const appRoot = document.getElementById('appRoot');
        if (gate) gate.remove();
        if (appRoot) appRoot.style.display = '';

        const logoutBtn = document.getElementById('btnLogout');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);

        // Cargar la herramienta solo tras verificar el rol de administrador.
        const script = document.createElement('script');
        script.src = BOTS_SCRIPT;
        document.body.appendChild(script);
    }

    async function verify() {
        if (isSessionExpired()) return redirectToLogin();

        try {
            const res = await fetch('/api/admin/account/me', {
                credentials: 'include'
            });
            if (!res.ok) return redirectToLogin();

            const data = await res.json();
            if (!data || !data.success || !data.user || data.user.role !== 'admin') {
                return redirectToLogin();
            }

            grantAccess();
        } catch {
            redirectToLogin();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verify);
    } else {
        verify();
    }
}());
