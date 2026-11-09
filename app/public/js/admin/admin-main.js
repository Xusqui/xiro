/**
 * @fileoverview Punto de entrada principal del panel de administración
 * Código extraído 1:1 del original admin.js
 *
 * Este archivo carga después de todos los módulos y contiene:
 * - showAdmin: mostrar panel tras login
 * - mostrarVista: sistema de navegación
 * - applyRolePermissions: permisos por rol
 * - Login form handler
 * - DOMContentLoaded
 * - logout
 * - cargarListas (deprecated stub)
 */

if (window.XiroI18n && typeof window.XiroI18n.addSections === 'function') {
    void window.XiroI18n.addSections(['admin'], { reload: false });
}

// ===== MOSTRAR PANEL ADMIN =====

function showAdmin() {
    // Se elimina del DOM (no solo se oculta) porque contiene varios <input type="password">
    // (login, reset, registro). Dejarlos ocultos con display:none seguía haciendo que el
    // gestor de contraseñas del navegador los tuviera en cuenta junto a los campos sensibles
    // del panel de Config (SMTP_PASS, CONTACT_TOKEN_SECRET), provocando autorrellenados/
    // vaciados inesperados de esos campos. No hace falta recuperarlo: logout() recarga la página.
    // El selector de idioma vive en la tarjeta de acceso: antes de quitarla, pasa al pie del sidebar
    const langSwitcher = document.getElementById('xiro-lang-switcher');
    const sidebarLangSlot = document.querySelector('[data-lang-slot="sidebar"]');
    if (langSwitcher && sidebarLangSlot) sidebarLangSlot.appendChild(langSwitcher);
    document.getElementById('login-overlay').remove();
    document.getElementById('admin-content').style.display = '';
    applyRolePermissions();
    cargarListas();
    // Portada con accesos, partidas y licencia (nav-sections.js) en vez del
    // estado vacío estático de admin.html
    const editorArea = document.getElementById('editorArea');
    if (editorArea && typeof window.renderAdminHome === 'function') window.renderAdminHome(editorArea);
}

// ===== SISTEMA DE NAVEGACIÓN Y VISTAS =====

// Marca `nav-${vista}` como botón activo del sidebar y limpia el resaltado
// del resto. Usada tanto por las vistas de grid (mostrarVista) como por
// pantallas ajenas a esa lista, como "Cargar Preguntas" y los paneles de
// la pestaña User.
function highlightSidebarNav(vista) {
    // El estado activo es un escalón de superficie (admin-sidebar.css, .is-active),
    // igual para todas las secciones: sin un color distinto por entrada
    document
        .querySelectorAll(
            '#sidebar-nav-section .nav-button, #user-sidebar-section .nav-button, #config-sidebar-section .nav-button'
        )
        .forEach(btn => {
            btn.classList.remove('is-active');
            btn.removeAttribute('aria-current');
        });

    const btnActivo = document.getElementById(`nav-${vista}`);
    if (btnActivo) {
        btnActivo.classList.add('is-active');
        btnActivo.setAttribute('aria-current', 'page');
    }
    if (typeof syncAdminMobileTitle === 'function') syncAdminMobileTitle();
}

function mostrarVista(vista) {
    navigateWithUnsavedChangesGuard(() => {
        activeView = vista;
        highlightSidebarNav(vista);

        // Renderizar la vista correspondiente
        switch (vista) {
            case 'bancos':
                stopRemoteRefresh();
                renderVistaBancos();
                break;
            case 'juegos':
                stopRemoteRefresh();
                renderVistaJuegos();
                break;
            case 'personalizados':
                stopRemoteRefresh();
                renderVistaPersonalizados();
                break;
            case 'trivial':
                stopRemoteRefresh();
                renderVistaTrivial();
                break;
            case 'ai-generator':
                stopRemoteRefresh();
                renderVistaAIGenerator();
                break;
            case 'historial':
                stopRemoteRefresh();
                renderVistaHistorial();
                break;
            case 'remote':
                renderVistaRemote();
                break;
        }
    });
}

// ===== PERMISOS POR ROL =====

function applyRolePermissions() {
    const role = getUserRole();

    // Agregar badge de rol
    const sidebar = document.querySelector('.w-80.bg-slate-900');
    const logoDiv = sidebar?.querySelector('.p-6.border-b');
    if (logoDiv && !document.getElementById('role-badge')) {
        const badge = document.createElement('div');
        badge.id = 'role-badge';
        badge.className = `text-center mt-3 px-3 py-1.5 rounded-full text-xs font-bold ${role === 'admin' ? 'bg-plum-600' : 'bg-blue-600'}`;
        badge.innerHTML =
            role === 'admin'
                ? '<div class="text-2xl">🔑</div><div class="text-xs font-bold uppercase tracking-wider">ADMIN</div>'
                : '<div class="text-2xl">✏️</div><div class="text-xs font-bold uppercase tracking-wider">EDITOR</div>';
        logoDiv.appendChild(badge);
    }

    // Inicializar tabs de sección (Preguntas / Configuración)
    initSectionTabs();

    // Aviso de versión nueva (solo admin; ver update-notice.js)
    if (typeof checkForUpdateNotice === 'function') checkForUpdateNotice();
}

// ===== LOGIN HANDLER =====

const loginForm = document.getElementById('admin-login-form');
const registerForm = document.getElementById('admin-register-form');
const registerButton = document.getElementById('admin-register-btn');
const registerBackButton = document.getElementById('register-back-btn');
const registerSubmitButton = document.getElementById('register-submit-btn');
const loginCardTitle = document.getElementById('login-card-title');

const loginError = document.getElementById('login-error');
const loginHelper = document.getElementById('login-helper');
const registerError = document.getElementById('register-error');
const registerHelper = document.getElementById('register-helper');

let setupRequired = false;

function showLoginError(message, i18nKey) {
    if (i18nKey) loginError.setAttribute('data-i18n', i18nKey);
    else loginError.removeAttribute('data-i18n');
    loginError.textContent = message;
    loginError.classList.remove('hidden');
}

function clearLoginError() {
    loginError.textContent = _t('');
    loginError.classList.add('hidden');
}

function showRegisterError(message, i18nKey) {
    if (i18nKey) registerError.setAttribute('data-i18n', i18nKey);
    else registerError.removeAttribute('data-i18n');
    registerError.textContent = message;
    registerError.classList.remove('hidden');
}

function clearRegisterError() {
    registerError.textContent = _t('');
    registerError.classList.add('hidden');
}

function setLoginHelperMessage(message, i18nKey) {
    if (!loginHelper) return;
    if (i18nKey) loginHelper.setAttribute('data-i18n', i18nKey);
    else loginHelper.removeAttribute('data-i18n');
    loginHelper.textContent = message;
}

function setRegisterHelperMessage(message, i18nKey) {
    if (!registerHelper) return;
    if (i18nKey) registerHelper.setAttribute('data-i18n', i18nKey);
    else registerHelper.removeAttribute('data-i18n');
    registerHelper.textContent = message;
}

function showLoginForm() {
    clearLoginError();
    clearRegisterError();
    loginCardTitle.setAttribute('data-i18n', 'admin.login.title');
    loginCardTitle.textContent = _t('admin.login.title', null, 'Administrador');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    setLoginHelperMessage(
        _t('admin.login.helper', null, 'Inicia sesión o crea una cuenta de Editor.'),
        'admin.login.helper'
    );
}

function showRegisterForm(isAdminSetup) {
    clearLoginError();
    clearRegisterError();

    const titleKey = isAdminSetup ? 'admin.register.title_admin' : 'admin.register.title_editor';
    loginCardTitle.setAttribute('data-i18n', titleKey);
    loginCardTitle.textContent = _t(titleKey, null, isAdminSetup ? 'Crear Administrador' : 'Crear Cuenta');

    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');

    if (isAdminSetup) {
        registerSubmitButton.setAttribute('data-i18n', 'admin.register.btn_admin');
        registerSubmitButton.textContent = _t('admin.register.btn_admin', null, 'Crear Admin');
        registerBackButton.classList.add('hidden');
        setRegisterHelperMessage(
            _t('admin.register.helper_setup', null, 'Primer acceso: crea el usuario Administrador principal.'),
            'admin.register.helper_setup'
        );
    } else {
        registerSubmitButton.setAttribute('data-i18n', 'admin.register.btn_editor');
        registerSubmitButton.textContent = _t('admin.register.btn_editor', null, 'Crear cuenta');
        registerBackButton.classList.remove('hidden');
        setRegisterHelperMessage(
            _t('admin.register.helper_email', null, 'Te enviaremos un email con el enlace de confirmación.'),
            'admin.register.helper_email'
        );
    }
}

async function submitLogin() {
    const username = document.getElementById('admin-username').value.trim().toLowerCase();
    const password = document.getElementById('admin-password').value;

    clearLoginError();

    if (!username || !password) {
        showLoginError(
            _t('admin.login.error_empty', null, 'Usuario y contraseña son obligatorios'),
            'admin.login.error_empty'
        );
        return;
    }

    try {
        const res = await fetch('/api/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok && data.token) {
            startAdminSession(data.token, data.role || 'admin', data.username);
            showAdmin();
            return;
        }

        if (res.status === 429) {
            showLoginError(
                _t(
                    'admin.login.error_rate_limit_15m',
                    null,
                    'Has excedido el número de intentos permitidos. Intenta de nuevo en 15 minutos.'
                ),
                'admin.login.error_rate_limit_15m'
            );
            return;
        }

        showLoginError(
            data.error || _t('admin.login.error_credentials', null, 'Credenciales inválidas'),
            data.error ? null : 'admin.login.error_credentials'
        );
    } catch (_err) {
        showLoginError(_t('admin.common.error_connection', null, 'Error de conexión'), 'admin.common.error_connection');
    }
}

async function submitRegistration() {
    const username = document.getElementById('register-username').value.trim().toLowerCase();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    clearRegisterError();

    if (!username || !email || !password || !confirmPassword) {
        showRegisterError(
            _t('admin.register.error_empty', null, 'Todos los campos son obligatorios'),
            'admin.register.error_empty'
        );
        return;
    }

    if (password !== confirmPassword) {
        showRegisterError(
            _t('admin.register.error_password', null, 'Las contraseñas no coinciden'),
            'admin.register.error_password'
        );
        return;
    }

    try {
        const res = await fetch('/api/admin-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, confirmPassword })
        });
        const data = await res.json();

        if (res.status === 201 && data.token) {
            startAdminSession(data.token, data.role || 'admin', data.username);
            showAdmin();
            return;
        }

        if (res.status === 202) {
            setRegisterHelperMessage(
                data.message || _t('admin.register.success_pending', null, 'Revisa tu email para activar la cuenta.'),
                data.message ? null : 'admin.register.success_pending'
            );
            registerForm.reset();
            if (!setupRequired) {
                showLoginForm();
                setLoginHelperMessage(
                    _t('admin.login.pending', null, 'Cuenta pendiente de confirmación. Revisa tu correo electrónico.'),
                    'admin.login.pending'
                );
            }
            return;
        }

        if (res.status === 429) {
            showRegisterError(
                _t(
                    'admin.login.error_rate_limit_15m',
                    null,
                    'Has excedido el número de intentos permitidos. Intenta de nuevo en 15 minutos.'
                ),
                'admin.login.error_rate_limit_15m'
            );
            return;
        }

        showRegisterError(
            data.error || _t('admin.register.error_failed', null, 'No se pudo crear la cuenta'),
            data.error ? null : 'admin.register.error_failed'
        );
    } catch (_err) {
        showRegisterError(
            _t('admin.common.error_connection', null, 'Error de conexión'),
            'admin.common.error_connection'
        );
    }
}

async function confirmRegistrationTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('verify_token');
    if (!token) return;

    try {
        const res = await fetch(`/api/admin-register/confirm?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        showLoginForm();
        if (res.ok && data.success) {
            setLoginHelperMessage(
                _t('admin.register.success_confirmed', null, 'Cuenta confirmada. Ya puedes iniciar sesión.'),
                'admin.register.success_confirmed'
            );
        } else {
            showLoginError(
                data.error || _t('admin.register.error_confirmed', null, 'No se pudo confirmar la cuenta'),
                data.error ? null : 'admin.register.error_confirmed'
            );
        }
    } catch (_err) {
        showLoginForm();
        showLoginError(
            _t('admin.register.error_token', null, 'No se pudo validar el enlace de confirmación'),
            'admin.register.error_token'
        );
    } finally {
        params.delete('verify_token');
        const newQuery = params.toString();
        const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
        window.history.replaceState({}, '', newUrl);
    }
}

async function confirmEmailChangeTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('verify_email_token');
    if (!token) return;

    try {
        const res = await fetch(`/api/admin/account/change-email/confirm?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        showLoginForm();
        if (res.ok && data.success) {
            setLoginHelperMessage(
                _t('admin.account.email_updated', null, 'Correo actualizado correctamente.'),
                'admin.account.email_updated'
            );
        } else {
            showLoginError(
                data.error || _t('admin.account.email_error', null, 'No se pudo confirmar el cambio de correo'),
                data.error ? null : 'admin.account.email_error'
            );
        }
    } catch (_err) {
        showLoginForm();
        showLoginError(
            _t('admin.account.email_token_error', null, 'No se pudo validar el enlace de cambio de correo'),
            'admin.account.email_token_error'
        );
    } finally {
        params.delete('verify_email_token');
        const newQuery = params.toString();
        const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
        window.history.replaceState({}, '', newUrl);
    }
}

async function loadAuthStatus() {
    try {
        const res = await fetch('/api/admin-auth/status');
        if (!res.ok) return;

        const data = await res.json();
        if (!data.success) return;

        setupRequired = !!data.setupRequired;
        if (setupRequired) {
            showRegisterForm(true);
        } else {
            showLoginForm();
        }
    } catch (_err) {
        showLoginForm();
        setLoginHelperMessage('');
    }
}

loginForm.onsubmit = async function (e) {
    e.preventDefault();
    await _withBusySubmit(loginForm, submitLogin);
};

registerForm.onsubmit = async function (e) {
    e.preventDefault();
    await _withBusySubmit(registerForm, submitRegistration);
};

if (registerButton) {
    registerButton.addEventListener('click', () => showRegisterForm(false));
}

if (registerBackButton) {
    registerBackButton.addEventListener('click', () => showLoginForm());
}

// ===== DOMCONTENTLOADED =====

window.addEventListener('DOMContentLoaded', () => {
    if (isAdminSessionValid()) {
        showAdmin();
        return;
    }

    loadAuthStatus()
        .then(() => confirmRegistrationTokenFromUrl())
        .then(() => confirmEmailChangeTokenFromUrl())
        .then(() => checkPasswordResetTokenFromUrl())
        .catch(() =>
            confirmRegistrationTokenFromUrl()
                .then(() => confirmEmailChangeTokenFromUrl())
                .then(() => checkPasswordResetTokenFromUrl())
        );
});

// ===== RE-RENDER ON LANGUAGE CHANGE =====
// The main content area is populated with HTML built via _t()/_tHtml() at render time,
// so translated strings are baked in with no data-i18n keys. i18n-dom.js cannot
// retranslate them on its own; we must re-render the active view.
// Config and User sections are handled by nav-sections.js; only re-render here when
// the questions section is active to avoid overwriting other panels.

window.addEventListener('xiro:language-changed', () => {
    if (activeSectionTab === 'questions' && activeView && typeof mostrarVista === 'function') {
        mostrarVista(activeView);
    }
});

// ===== LOGOUT =====

function logout() {
    executeWithUnsavedChangesGuard(() => {
        mostrarModalConfirmacion(
            _t('admin.logout.title', null, '⚠️ Cerrar sesión'),
            _t('admin.logout.message', null, '¿Estás seguro de que quieres cerrar sesión?'),
            () => {
                // Limpiar la cookie HttpOnly en el servidor antes de recargar
                fetch('/api/admin-logout', { method: 'POST', credentials: 'include' })
                    .catch(() => {})
                    .finally(() => {
                        clearAdminSession();
                        location.reload();
                    });
            },
            null,
            _t('admin.logout.confirm', null, 'Cerrar sesión'),
            _t('admin.common.cancel', null, 'Cancelar')
        );
    });
}

// ===== IR A INICIO =====

function goToHome() {
    executeWithUnsavedChangesGuard(() => {
        window.location.href = '/index.html';
    });
}

// ===== CARGAR LISTAS (deprecated) =====

async function cargarListas() {
    // Ya no necesitamos cargar las listas en el sidebar
    // Las listas se cargan cuando el usuario hace clic en una categoría
}

setupAdminActionDelegation();
setupAdminInlineAttributeBridge();
