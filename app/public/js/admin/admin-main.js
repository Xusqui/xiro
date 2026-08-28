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
    document.getElementById('login-overlay').remove();
    document.getElementById('admin-content').style.display = '';
    applyRolePermissions();
    cargarListas();
}

// ===== SISTEMA DE NAVEGACIÓN Y VISTAS =====

// Tinte de fondo por sección para el botón activo del sidebar. El tinte usa
// style.backgroundColor (no clases Tailwind con opacidad arbitraria, que
// requerirían una recompilación para existir en el CSS servido). Las vistas
// sin entrada aquí (p.ej. cargar-preguntas) caen al bg-slate-800 plano.
const SIDEBAR_ACTIVE_BORDER_CLASSES = [
    'border-purple-500',
    'border-green-500',
    'border-blue-500',
    'border-orange-500',
    'border-indigo-500',
    'border-emerald-500',
    'border-violet-500',
    'border-cyan-500',
    'border-yellow-500'
];
const SIDEBAR_SECTION_TINT = {
    bancos: 'rgba(168, 85, 247, 0.18)',
    juegos: 'rgba(34, 197, 94, 0.18)',
    personalizados: 'rgba(59, 130, 246, 0.18)',
    trivial: 'rgba(249, 115, 22, 0.18)',
    'ai-generator': 'rgba(99, 102, 241, 0.18)',
    remote: 'rgba(34, 197, 94, 0.18)',
    historial: 'rgba(16, 185, 129, 0.18)',
    'cargar-preguntas': 'rgba(139, 92, 246, 0.18)',
    'user-account': 'rgba(6, 182, 212, 0.18)',
    'user-manage-users': 'rgba(99, 102, 241, 0.18)',
    servidor: 'rgba(234, 179, 8, 0.18)'
};
const SIDEBAR_SECTION_BORDER = {
    bancos: 'border-purple-500',
    juegos: 'border-green-500',
    personalizados: 'border-blue-500',
    trivial: 'border-orange-500',
    'ai-generator': 'border-indigo-500',
    remote: 'border-green-500',
    historial: 'border-emerald-500',
    'cargar-preguntas': 'border-violet-500',
    'user-account': 'border-cyan-500',
    'user-manage-users': 'border-indigo-500',
    servidor: 'border-yellow-500'
};

// Marca `nav-${vista}` como botón activo del sidebar y limpia el resaltado
// del resto. Usada tanto por las vistas de grid (mostrarVista) como por
// pantallas ajenas a esa lista, como "Cargar Preguntas" y los paneles de
// la pestaña User.
function highlightSidebarNav(vista) {
    document.querySelectorAll(
        '#sidebar-nav-section .nav-button, #user-sidebar-section .nav-button, #config-sidebar-section .nav-button'
    ).forEach(btn => {
        btn.classList.remove('bg-slate-800', ...SIDEBAR_ACTIVE_BORDER_CLASSES);
        btn.style.backgroundColor = '';
    });

    const btnActivo = document.getElementById(`nav-${vista}`);
    if (btnActivo) {
        if (SIDEBAR_SECTION_TINT[vista]) {
            btnActivo.style.backgroundColor = SIDEBAR_SECTION_TINT[vista];
            btnActivo.classList.add(SIDEBAR_SECTION_BORDER[vista]);
        } else {
            btnActivo.classList.add('bg-slate-800');
        }
    }
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
        badge.className = `text-center mt-3 px-3 py-1.5 rounded-full text-xs font-bold ${role === 'admin' ? 'bg-purple-600' : 'bg-blue-600'}`;
        badge.innerHTML = role === 'admin'
            ? '<div class="text-2xl">🔑</div><div class="text-xs font-bold uppercase tracking-wider">ADMIN</div>'
            : '<div class="text-2xl">✏️</div><div class="text-xs font-bold uppercase tracking-wider">EDITOR</div>';
        logoDiv.appendChild(badge);
    }

    // Inicializar tabs de sección (Preguntas / Configuración)
    initSectionTabs();
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
    setLoginHelperMessage(_t('admin.login.helper', null, 'Inicia sesión o crea una cuenta de Editor.'), 'admin.login.helper');
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
        setRegisterHelperMessage(_t('admin.register.helper_setup', null, 'Primer acceso: crea el usuario Administrador principal.'), 'admin.register.helper_setup');
    } else {
        registerSubmitButton.setAttribute('data-i18n', 'admin.register.btn_editor');
        registerSubmitButton.textContent = _t('admin.register.btn_editor', null, 'Crear cuenta');
        registerBackButton.classList.remove('hidden');
        setRegisterHelperMessage(_t('admin.register.helper_email', null, 'Te enviaremos un email con el enlace de confirmación.'), 'admin.register.helper_email');
    }
}

async function submitLogin() {
    const username = document.getElementById('admin-username').value.trim().toLowerCase();
    const password = document.getElementById('admin-password').value;

    clearLoginError();

    if (!username || !password) {
        showLoginError(_t('admin.login.error_empty', null, 'Usuario y contraseña son obligatorios'), 'admin.login.error_empty');
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
            showLoginError(_t('admin.login.error_rate_limit_15m', null, 'Has excedido el número de intentos permitidos. Intenta de nuevo en 15 minutos.'), 'admin.login.error_rate_limit_15m');
            return;
        }

        showLoginError(data.error || _t('admin.login.error_credentials', null, 'Credenciales inválidas'), data.error ? null : 'admin.login.error_credentials');
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
        showRegisterError(_t('admin.register.error_empty', null, 'Todos los campos son obligatorios'), 'admin.register.error_empty');
        return;
    }

    if (password !== confirmPassword) {
        showRegisterError(_t('admin.register.error_password', null, 'Las contraseñas no coinciden'), 'admin.register.error_password');
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
            setRegisterHelperMessage(data.message || _t('admin.register.success_pending', null, 'Revisa tu email para activar la cuenta.'), data.message ? null : 'admin.register.success_pending');
            registerForm.reset();
            if (!setupRequired) {
                showLoginForm();
                setLoginHelperMessage(_t('admin.login.pending', null, 'Cuenta pendiente de confirmación. Revisa tu correo electrónico.'), 'admin.login.pending');
            }
            return;
        }

        if (res.status === 429) {
            showRegisterError(_t('admin.login.error_rate_limit_15m', null, 'Has excedido el número de intentos permitidos. Intenta de nuevo en 15 minutos.'), 'admin.login.error_rate_limit_15m');
            return;
        }

        showRegisterError(data.error || _t('admin.register.error_failed', null, 'No se pudo crear la cuenta'), data.error ? null : 'admin.register.error_failed');
    } catch (_err) {
        showRegisterError(_t('admin.common.error_connection', null, 'Error de conexión'), 'admin.common.error_connection');
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
            setLoginHelperMessage(_t('admin.register.success_confirmed', null, 'Cuenta confirmada. Ya puedes iniciar sesión.'), 'admin.register.success_confirmed');
        } else {
            showLoginError(data.error || _t('admin.register.error_confirmed', null, 'No se pudo confirmar la cuenta'), data.error ? null : 'admin.register.error_confirmed');
        }
    } catch (_err) {
        showLoginForm();
        showLoginError(_t('admin.register.error_token', null, 'No se pudo validar el enlace de confirmación'), 'admin.register.error_token');
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
            setLoginHelperMessage(_t('admin.account.email_updated', null, 'Correo actualizado correctamente.'), 'admin.account.email_updated');
        } else {
            showLoginError(data.error || _t('admin.account.email_error', null, 'No se pudo confirmar el cambio de correo'), data.error ? null : 'admin.account.email_error');
        }
    } catch (_err) {
        showLoginForm();
        showLoginError(_t('admin.account.email_token_error', null, 'No se pudo validar el enlace de cambio de correo'), 'admin.account.email_token_error');
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
    await submitLogin();
};

registerForm.onsubmit = async function (e) {
    e.preventDefault();
    await submitRegistration();
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
        .catch(() => confirmRegistrationTokenFromUrl().then(() => confirmEmailChangeTokenFromUrl()).then(() => checkPasswordResetTokenFromUrl()));
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
                    .catch(() => { })
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

function parseNullableId(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function setupAdminActionDelegation() {
    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-admin-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.adminAction;
        const section = actionElement.dataset.section;
        const view = actionElement.dataset.view;
        const panel = actionElement.dataset.panel;
        const sessionId = actionElement.dataset.sessionId;
        const bankId = parseNullableId(actionElement.dataset.bankId);
        const gameId = parseNullableId(actionElement.dataset.gameId);
        const ownerUserId = parseNullableId(actionElement.dataset.ownerUserId);
        const resourceLabel = actionElement.dataset.resourceLabel;

        if (action === 'go-home') {
            event.preventDefault();
        }

        switch (action) {
            case 'go-home':
                if (typeof goToHome === 'function') goToHome();
                break;
            case 'switch-section-tab':
                if (section && typeof switchSectionTab === 'function') switchSectionTab(section);
                break;
            case 'show-view':
                if (view && typeof mostrarVista === 'function') mostrarVista(view);
                break;
            case 'show-config-panel':
                if (typeof renderConfigPanel === 'function') renderConfigPanel();
                if (typeof highlightSidebarNav === 'function') highlightSidebarNav('servidor');
                break;
            case 'show-upload-view':
                if (typeof mostrarCargarPreguntas === 'function') mostrarCargarPreguntas();
                break;
            case 'edit-bank':
                if (bankId !== null && typeof cargarEditorBanco === 'function') cargarEditorBanco(bankId);
                break;
            case 'delete-bank':
                if (bankId !== null && typeof borrarBanco === 'function') borrarBanco(bankId, event, ownerUserId);
                break;
            case 'edit-game':
                if (gameId !== null && typeof cargarEditorJuego === 'function') cargarEditorJuego(gameId);
                break;
            case 'delete-game':
                if (gameId !== null && typeof borrarJuego === 'function') borrarJuego(gameId, event, ownerUserId);
                break;
            case 'edit-custom-game':
                if (gameId !== null && typeof cargarEditorJuegoPersonalizado === 'function') {
                    cargarEditorJuegoPersonalizado(gameId);
                }
                break;
            case 'delete-custom-game':
                event.stopPropagation();
                if (gameId !== null && typeof borrarJuegoPersonalizado === 'function') {
                    borrarJuegoPersonalizado(gameId, ownerUserId);
                }
                break;
            case 'ownership-denied':
                if (resourceLabel && typeof showOwnershipDeniedModal === 'function') {
                    showOwnershipDeniedModal(resourceLabel);
                }
                break;
            case 'history-back':
                if (typeof window !== 'undefined' && window.history) window.history.back();
                break;
            case 'load-bank-from-json':
                if (typeof cargarBancoDesdeJSON === 'function') cargarBancoDesdeJSON();
                break;
            case 'reload-remote-sessions':
                if (typeof recargarSesionesActivas === 'function') recargarSesionesActivas();
                break;
            case 'terminate-remote-session':
                if (sessionId && typeof terminarSesionAdmin === 'function') terminarSesionAdmin(sessionId);
                break;
            case 'switch-user-panel':
                if (panel && typeof switchUserPanelView === 'function') switchUserPanelView(panel);
                break;
            case 'groq-save-config':
                if (typeof saveGroqApiKey === 'function') saveGroqApiKey();
                break;
            case 'groq-delete-key':
                if (typeof deleteGroqApiKey === 'function') deleteGroqApiKey();
                break;
            case 'clear-uploads':
                if (typeof limpiarArchivosHuerfanos === 'function') limpiarArchivosHuerfanos();
                break;
            case 'clear-cache':
                if (typeof limpiarCache === 'function') limpiarCache();
                break;
            case 'delete-logs':
                if (typeof borrarLogs === 'function') borrarLogs();
                break;
            case 'panic-restart':
                if (typeof panicRestart === 'function') panicRestart();
                break;
            case 'logout':
                if (typeof logout === 'function') logout();
                break;
            default:
                break;
        }
    });
}

let _adminInlineBridgeReady = false;

function _splitAdminInlineTopLevel(source, delimiter) {
    const chunks = [];
    let current = '';
    let depth = 0;
    let quote = null;
    let escaped = false;

    for (const char of source) {
        if (quote) {
            current += char;
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '\'' || char === '"') {
            quote = char;
            current += char;
            continue;
        }

        if (char === '(' || char === '[' || char === '{') {
            depth += 1;
            current += char;
            continue;
        }

        if (char === ')' || char === ']' || char === '}') {
            depth = Math.max(0, depth - 1);
            current += char;
            continue;
        }

        if (char === delimiter && depth === 0) {
            chunks.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        chunks.push(current.trim());
    }

    return chunks;
}

function _parseAdminInlineString(raw) {
    const quote = raw[0];
    if ((quote !== '\'' && quote !== '"') || raw[raw.length - 1] !== quote) {
        return null;
    }

    let result = '';
    for (let idx = 1; idx < raw.length - 1; idx += 1) {
        const char = raw[idx];
        if (char !== '\\') {
            result += char;
            continue;
        }

        idx += 1;
        if (idx >= raw.length - 1) break;
        const next = raw[idx];
        if (next === 'n') result += '\n';
        else if (next === 't') result += '\t';
        else if (next === 'r') result += '\r';
        else result += next;
    }

    return result;
}

function _evalAdminInlineValue(expression, element) {
    const normalized = expression.replace(/\s+/g, ' ').trim();
    const inputValue = element?.value ?? '';

    if (normalized === 'this.value') return inputValue;
    if (normalized === 'this.value - 1') return Number(inputValue) - 1;
    if (normalized === 'parseInt(this.value)') return parseInt(inputValue, 10);
    if (normalized === 'parseInt(this.value) || null') {
        const parsed = parseInt(inputValue, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }
    if (normalized === 'parseInt(this.value) || 0') {
        const parsed = parseInt(inputValue, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (normalized === 'parseInt(this.value) || 30') {
        const parsed = parseInt(inputValue, 10);
        return Number.isNaN(parsed) ? 30 : parsed;
    }
    if (normalized === 'Number(this.value) || 25') {
        const parsed = Number(inputValue);
        return Number.isFinite(parsed) && parsed !== 0 ? parsed : 25;
    }
    if (normalized === 'this.value === \'\' ? null : (Number(this.value) || null)') {
        if (inputValue === '') return null;
        const parsed = Number(inputValue);
        return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
    }
    if (normalized === 'Math.max(5, Math.min(120, parseInt(this.value) || 30))') {
        const parsed = parseInt(inputValue, 10);
        const fallback = Number.isNaN(parsed) ? 30 : parsed;
        return Math.max(5, Math.min(120, fallback));
    }
    if (normalized === 'Math.max(1, parseInt(this.value) || 0)') {
        const parsed = parseInt(inputValue, 10);
        const fallback = Number.isNaN(parsed) ? 0 : parsed;
        return Math.max(1, fallback);
    }
    if (normalized === 'Math.max(1, Math.min(100, parseInt(this.value) || 10))') {
        const parsed = parseInt(inputValue, 10);
        const fallback = Number.isNaN(parsed) ? 10 : parsed;
        return Math.max(1, Math.min(100, fallback));
    }
    if (normalized === 'Math.max(0, Math.min(100, parseInt(this.value) || 10))') {
        const parsed = parseInt(inputValue, 10);
        const fallback = Number.isNaN(parsed) ? 10 : parsed;
        return Math.max(0, Math.min(100, fallback));
    }
    if (normalized === 'Math.max(0, Math.min(100, parseInt(this.value) || 20))') {
        const parsed = parseInt(inputValue, 10);
        const fallback = Number.isNaN(parsed) ? 20 : parsed;
        return Math.max(0, Math.min(100, fallback));
    }

    if (normalized.startsWith('this.value.replace(') && normalized.endsWith('.toUpperCase()')) {
        return String(inputValue)
            .replace(/[^A-Za-zÁáÉéÍíÓóÚúÜüÑñ]/g, '')
            .toUpperCase();
    }

    if (normalized === 'null') return null;
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);

    const parsedString = _parseAdminInlineString(normalized);
    if (parsedString !== null) return parsedString;

    return undefined;
}

function _runAdminInlineAssignment(statement, element) {
    const optionAssignment = statement.match(/^([A-Za-z_$][\w$]*)\[(\d+)\]\.options\[(\d+)\]\.([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);
    if (optionAssignment) {
        const [, rootName, rootIdxRaw, optionIdxRaw, property, expression] = optionAssignment;
        const rootCollection = globalThis[rootName];
        const rootIdx = Number(rootIdxRaw);
        const optionIdx = Number(optionIdxRaw);

        if (!Array.isArray(rootCollection) || !rootCollection[rootIdx]?.options?.[optionIdx]) {
            return false;
        }

        const value = _evalAdminInlineValue(expression, element);
        if (typeof value === 'undefined') {
            return false;
        }

        rootCollection[rootIdx].options[optionIdx][property] = value;
        return true;
    }

    const rootAssignment = statement.match(/^([A-Za-z_$][\w$]*)\[(\d+)\]\.([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);
    if (!rootAssignment) {
        return false;
    }

    const [, rootName, rootIdxRaw, property, expression] = rootAssignment;
    const rootCollection = globalThis[rootName];
    const rootIdx = Number(rootIdxRaw);

    if (!Array.isArray(rootCollection) || !rootCollection[rootIdx]) {
        return false;
    }

    const value = _evalAdminInlineValue(expression, element);
    if (typeof value === 'undefined') {
        return false;
    }

    rootCollection[rootIdx][property] = value;
    return true;
}

function _evalAdminInlineArg(token, event, element) {
    const normalized = token.trim();

    if (normalized === 'event') return event;
    if (normalized === 'this') return element;

    const value = _evalAdminInlineValue(normalized, element);
    return typeof value === 'undefined' ? undefined : value;
}

function _runAdminInlineCall(statement, event, element) {
    const removeMatch = statement.match(/^document\.getElementById\((['"])(.+?)\1\)\.remove\(\)$/);
    if (removeMatch) {
        const modal = document.getElementById(removeMatch[2]);
        if (modal && typeof modal.remove === 'function') {
            modal.remove();
        }
        return true;
    }

    if (statement === 'navigateWithUnsavedChangesGuard(() => renderVistaTrivial())') {
        if (typeof navigateWithUnsavedChangesGuard === 'function' && typeof renderVistaTrivial === 'function') {
            navigateWithUnsavedChangesGuard(() => renderVistaTrivial());
        }
        return true;
    }

    const callMatch = statement.match(/^([\p{L}_$][\p{L}\p{N}_$]*)\((.*)\)$/su);
    if (!callMatch) {
        return false;
    }

    const [, functionName, argSource] = callMatch;
    const handler = globalThis[functionName];
    if (typeof handler !== 'function') {
        return false;
    }

    const args = argSource.trim()
        ? _splitAdminInlineTopLevel(argSource, ',').map((token) => _evalAdminInlineArg(token, event, element))
        : [];

    handler(...args);
    return true;
}

function _runDelegatedInlineExpression(code, event, element) {
    if (!code) return;
    try {
        const statements = _splitAdminInlineTopLevel(code, ';');
        for (const statement of statements) {
            if (!statement) continue;
            if (_runAdminInlineAssignment(statement, element)) continue;
            if (_runAdminInlineCall(statement, event, element)) continue;
            console.warn('[admin-inline-bridge] Expresión no soportada por bridge seguro:', statement);
        }
    } catch (error) {
        console.error('[admin-inline-bridge] Error ejecutando expresion delegada:', error, code);
    }
}

function setupAdminInlineAttributeBridge() {
    if (_adminInlineBridgeReady) return;
    _adminInlineBridgeReady = true;

    document.addEventListener('click', (event) => {
        const element = event.target.closest('[data-admin-click]');
        if (!element) return;
        _runDelegatedInlineExpression(element.getAttribute('data-admin-click'), event, element);
    });

    document.addEventListener('change', (event) => {
        const element = event.target.closest('[data-admin-change]');
        if (!element) return;
        _runDelegatedInlineExpression(element.getAttribute('data-admin-change'), event, element);
    });

    document.addEventListener('input', (event) => {
        const element = event.target.closest('[data-admin-input]');
        if (!element) return;
        _runDelegatedInlineExpression(element.getAttribute('data-admin-input'), event, element);
    });
}

setupAdminActionDelegation();
setupAdminInlineAttributeBridge();
