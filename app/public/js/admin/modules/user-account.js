/**
 * @fileoverview Panel de cuenta de usuario (User tab)
 */

let activeUserPanelView = 'account';
let currentUserProfile = null;
const adminUsersById = new Map();

function _updateUserSidebarButtons() {
    const manageUsersButton = document.getElementById('nav-user-manage-users');
    if (manageUsersButton) {
        manageUsersButton.style.display = isAdmin() ? '' : 'none';
    }

    if (typeof highlightSidebarNav === 'function') {
        highlightSidebarNav(`user-${activeUserPanelView}`);
    }
}

function initUserSidebarNavigation() {
    if (!isAdmin() && activeUserPanelView === 'manage-users') {
        activeUserPanelView = 'account';
    }
    _updateUserSidebarButtons();
}

function switchUserPanelView(view = 'account') {
    const requestedView = view === 'manage-users' ? 'manage-users' : 'account';
    activeUserPanelView = isAdmin() ? requestedView : 'account';
    _updateUserSidebarButtons();
    renderUserPanel();
}

function _setUserPanelMessage(message, isError = false) {
    const box = document.getElementById('user-account-message');
    if (!box) return;

    box.textContent = _t(message || '');
    box.classList.remove('hidden', 'text-emerald-600', 'text-rose-600');
    box.classList.add(isError ? 'text-rose-600' : 'text-emerald-600');

    if (!message) {
        box.classList.add('hidden');
    }
}

function _setUserEmailMessage(message, isError = false) {
    const box = document.getElementById('user-email-message');
    if (!box) return;

    box.textContent = _t(message || '');
    box.classList.remove('hidden', 'text-emerald-600', 'text-rose-600');
    box.classList.add(isError ? 'text-rose-600' : 'text-emerald-600');

    if (!message) {
        box.classList.add('hidden');
    }
}

function _setUserEmailSubmitPending(isPending) {
    const button = document.getElementById('user-email-submit-btn');
    if (!button) return;

    if (isPending) {
        if (!button.dataset.defaultLabel) {
            button.dataset.defaultLabel = button.textContent.trim();
        }

        button.disabled = true;
        button.textContent = _t('admin.user.email_pending', null, 'Solicitando...');
        button.classList.remove('bg-slate-900', 'hover:bg-slate-800');
        button.classList.add('bg-slate-400', 'cursor-not-allowed');
        button.setAttribute('aria-busy', 'true');
        return;
    }

    button.disabled = false;
    button.textContent = button.dataset.defaultLabel || _t('admin.user.btn_email_change', null, 'Solicitar cambio de correo');
    button.classList.remove('bg-slate-400', 'cursor-not-allowed');
    button.classList.add('bg-slate-900', 'hover:bg-slate-800');
    button.removeAttribute('aria-busy');
}

function _setUserManagementMessage(message, isError = false) {
    const box = document.getElementById('user-management-message');
    if (!box) return;

    box.textContent = _t(message || '');
    box.classList.remove('hidden', 'text-emerald-600', 'text-rose-600');
    box.classList.add(isError ? 'text-rose-600' : 'text-emerald-600');

    if (!message) {
        box.classList.add('hidden');
    }
}

function _setUserDeleteMessage(message, isError = false) {
    const box = document.getElementById('user-delete-message');
    if (!box) return;

    box.textContent = _t(message || '');
    box.classList.remove('hidden', 'text-emerald-600', 'text-rose-600');
    box.classList.add(isError ? 'text-rose-600' : 'text-emerald-600');

    if (!message) {
        box.classList.add('hidden');
    }
}

function _setUserDeleteSubmitPending(isPending) {
    const button = document.getElementById('user-delete-submit-btn');
    if (!button) return;

    if (isPending) {
        if (!button.dataset.defaultLabel) {
            button.dataset.defaultLabel = button.textContent.trim();
        }

        button.disabled = true;
        button.textContent = _t('admin.user.delete_pending', null, 'Solicitando...');
        button.classList.remove('bg-red-600', 'hover:bg-red-700');
        button.classList.add('bg-slate-400', 'cursor-not-allowed');
        button.setAttribute('aria-busy', 'true');
        return;
    }

    button.disabled = false;
    button.textContent = button.dataset.defaultLabel || _t('admin.user.btn_delete_account', null, 'Solicitar eliminación');
    button.classList.remove('bg-slate-400', 'cursor-not-allowed');
    button.classList.add('bg-red-600', 'hover:bg-red-700');
    button.removeAttribute('aria-busy');
}

async function _fetchCurrentUserProfile() {
    const response = await fetchWithAuth('/api/admin/account/me');
    const data = await response.json();

    if (!response.ok || !data.success || !data.user) {
        throw new Error(data.error || 'No se pudo cargar la cuenta');
    }

    currentUserProfile = data.user;
    return currentUserProfile;
}

function _ensureCurrentUserProfile() {
    if (currentUserProfile?.id) {
        return currentUserProfile;
    }

    return _fetchCurrentUserProfile();
}

function _formatUserRole(role) {
    return role === 'admin' ? _t('admin.user.role.admin', null, 'Admin') : _t('admin.user.role.editor', null, 'Editor');
}

function _formatUserDate(dateLike) {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

async function _loadUserAccountData() {
    const usernameEl = document.getElementById('user-account-username');
    const emailEl = document.getElementById('user-account-email');
    const roleEl = document.getElementById('user-account-role');

    if (!usernameEl || !emailEl || !roleEl) return;

    usernameEl.textContent = _t('admin.common.loading', null, 'Cargando...');
    emailEl.textContent = _t('admin.common.loading', null, 'Cargando...');
    roleEl.textContent = _t('admin.common.loading', null, 'Cargando...');

    try {
        const user = await _fetchCurrentUserProfile();

        usernameEl.textContent = _t(user.username || '-');
        emailEl.textContent = _t(user.email || '-');
        roleEl.textContent = _t(user.role || '-');
    } catch (_error) {
        currentUserProfile = null;
        usernameEl.textContent = _t('-');
        emailEl.textContent = _t('-');
        roleEl.textContent = _t('-');
        _setUserPanelMessage(_t('admin.user.error_load_account', null, 'No se pudo cargar la información de la cuenta.'), true);
    }
}

function _renderAdminUsersRows(users, currentUserId) {
    const tableBody = document.getElementById('admin-users-table-body');
    if (!tableBody) return;

    adminUsersById.clear();
    users.forEach(user => adminUsersById.set(user.id, user));

    if (!users.length) {
        tableBody.innerHTML = _tHtml(`
            <tr>
                <td colspan="6" class="px-4 py-6 text-center text-slate-500">${_t('admin.user.no_users', null, 'No hay usuarios registrados.')}</td>
            </tr>
        `);
        return;
    }

    tableBody.innerHTML = users.map(user => {
        const isSelf = user.id === currentUserId;
        const roleBadgeClass = user.role === 'admin'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-blue-100 text-blue-700';
        const statusBadgeClass = user.isActive
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-200 text-slate-700';
        const deleteButtonClass = isSelf
            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
            : 'bg-rose-600 hover:bg-rose-700 text-white';

        const roleCellContent = isSelf
            ? `<span class="px-2 py-1 rounded-full text-xs font-bold uppercase ${roleBadgeClass}">${escapeHtml(_formatUserRole(user.role))}</span>`
            : `
                <select data-change-role-user="${user.id}" class="bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1 font-semibold uppercase">
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>ADMIN</option>
                    <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>EDITOR</option>
                </select>
            `;

        return `
            <tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 font-semibold text-slate-900">${escapeHtml(user.username || '-')}</td>
                <td class="px-4 py-3 text-slate-700">${escapeHtml(user.email || '-')}</td>
                <td class="px-4 py-3">
                    ${roleCellContent}
                </td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded-full text-xs font-bold ${statusBadgeClass}">
                        ${user.isActive ? _t('admin.user.status_active', null, 'Activo') : _t('admin.user.status_inactive', null, 'Inactivo')}
                    </span>
                </td>
                <td class="px-4 py-3 text-slate-600">${escapeHtml(_formatUserDate(user.createdAt))}</td>
                <td class="px-4 py-3 text-right">
                    <button type="button" data-delete-admin-user="${user.id}" ${isSelf ? 'disabled' : ''}
                        class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${deleteButtonClass}">
                        ${isSelf ? _t('admin.user.own_account', null, 'Tu cuenta') : _t('admin.common.delete', null, 'Eliminar')}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.querySelectorAll('[data-delete-admin-user]').forEach(button => {
        button.addEventListener('click', _handleDeleteAdminUserClick);
    });

    tableBody.querySelectorAll('[data-change-role-user]').forEach(select => {
        select.addEventListener('change', _handleChangeUserRole);
    });
}

function _handleChangeUserRole(event) {
    const select = event.currentTarget;
    if (!select) return;

    const userId = Number.parseInt(select.getAttribute('data-change-role-user'), 10);
    const newRole = select.value;
    const user = adminUsersById.get(userId);

    if (!Number.isInteger(userId) || !user) return;

    const title = _t('admin.user.change_role_title', null, 'Cambiar rol');
    const message = _t('admin.user.change_role_confirm', { username: user.username, role: newRole }, `¿Seguro que quieres cambiar el rol de "{username}" a {role}?`).replace('{username}', user.username).replace('{role}', newRole.toUpperCase());

    const onConfirmRoleChange = async () => {
        try {
            const response = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || _t('admin.user.error_change_role', null, 'No se pudo cambiar el rol'));
            }

            _setUserManagementMessage(data.message || _t('admin.user.role_changed', null, 'Rol cambiado correctamente.'));
            await _loadAdminUsers();
        } catch (error) {
            _setUserManagementMessage(error.message || _t('admin.user.error_change_role', null, 'No se pudo cambiar el rol.'), true);
            select.value = user.role; // Restaurar visualmente si hay error
        }
    };

    if (typeof mostrarModalConfirmacion === 'function') {
        mostrarModalConfirmacion(
            title,
            message,
            onConfirmRoleChange,
            () => { select.value = user.role; },
            _t('admin.common.confirm', null, 'Confirmar'),
            _t('admin.common.cancel', null, 'Cancelar')
        );
        return;
    }

    if (window.confirm(message)) {
        onConfirmRoleChange();
    } else {
        select.value = user.role;
    }
}

async function _loadAdminUsers() {
    const tableBody = document.getElementById('admin-users-table-body');
    if (!tableBody) return;

    _setUserManagementMessage('');
    tableBody.innerHTML = _tHtml(`
        <tr>
            <td colspan="6" class="px-4 py-6 text-center text-slate-500">${_t('admin.user.loading_users', null, 'Cargando usuarios...')}</td>
        </tr>
    `);

    try {
        const currentUser = await _ensureCurrentUserProfile();
        const response = await fetchWithAuth('/api/admin/users');
        const data = await response.json();

        if (!response.ok || !data.success || !Array.isArray(data.users)) {
            throw new Error(data.error || _t('admin.user.error_load_users', null, 'No se pudo cargar la lista de usuarios'));
        }

        _renderAdminUsersRows(data.users, currentUser.id);
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-rose-600">${_t('admin.user.error_load_users', null, 'No se pudo cargar la lista de usuarios.')}</td></tr>`;
        _setUserManagementMessage(error.message || _t('admin.user.error_load_users', null, 'No se pudo cargar la lista de usuarios.'), true);
    }
}

async function _deleteAdminUser(user) {
    try {
        const response = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(user.id)}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'No se pudo eliminar el usuario');
        }

        _setUserManagementMessage(data.message || 'Usuario eliminado correctamente.');
        await _loadAdminUsers();
    } catch (error) {
        _setUserManagementMessage(error.message || 'No se pudo eliminar el usuario.', true);
    }
}

function _handleDeleteAdminUserClick(event) {
    const button = event.currentTarget;
    if (!button) return;

    const userId = Number.parseInt(button.getAttribute('data-delete-admin-user'), 10);
    if (!Number.isInteger(userId)) return;

    const user = adminUsersById.get(userId);
    if (!user) return;

    const title = _t('admin.user.delete_title', null, 'Eliminar usuario');
    const message = _t('admin.user.delete_confirm_msg', { username: user.username }, `¿Seguro que quieres eliminar a "{username}"? Esta acción no se puede deshacer.`).replace('{username}', user.username);

    const onConfirmDelete = () => {
        _deleteAdminUser(user);
    };

    if (typeof mostrarModalConfirmacion === 'function') {
        mostrarModalConfirmacion(
            title,
            message,
            onConfirmDelete,
            null,
            _t('admin.common.delete', null, 'Eliminar'),
            _t('admin.common.cancel', null, 'Cancelar')
        );
        return;
    }

    if (window.confirm(message)) {
        onConfirmDelete();
    }
}

async function _handleUserPasswordChange(event) {
    event.preventDefault();
    _setUserPanelMessage('');

    const currentPassword = document.getElementById('user-current-password')?.value || '';
    const newPassword = document.getElementById('user-new-password')?.value || '';
    const confirmNewPassword = document.getElementById('user-confirm-password')?.value || '';

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        _setUserPanelMessage(_t('admin.user.validation.all_fields', null, 'Debes completar todos los campos.'), true);
        return;
    }

    if (newPassword !== confirmNewPassword) {
        _setUserPanelMessage(_t('admin.user.validation.password_mismatch', null, 'La confirmación no coincide con la nueva contraseña.'), true);
        return;
    }

    try {
        const response = await fetchWithAuth('/api/admin/account/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPassword,
                newPassword,
                confirmNewPassword
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || _t('admin.user.error.password', null, 'No se pudo cambiar la contraseña'));
        }

        const form = document.getElementById('user-password-form');
        if (form) form.reset();

        _setUserPanelMessage(data.message || _t('admin.user.success.password', null, 'Contraseña actualizada correctamente.'));
    } catch (error) {
        _setUserPanelMessage(error.message || _t('admin.user.error.password', null, 'No se pudo cambiar la contraseña.'), true);
    }
}

async function _handleUserEmailChangeRequest(event) {
    event.preventDefault();

    const submitButton = document.getElementById('user-email-submit-btn');
    if (submitButton?.disabled) return;

    _setUserEmailMessage('');

    const currentPassword = document.getElementById('user-email-current-password')?.value || '';
    const newEmail = document.getElementById('user-new-email')?.value.trim().toLowerCase() || '';
    const confirmNewEmail = document.getElementById('user-confirm-new-email')?.value.trim().toLowerCase() || '';

    if (!currentPassword || !newEmail || !confirmNewEmail) {
        _setUserEmailMessage(_t('admin.user.validation.all_fields_email', null, 'Debes completar todos los campos para cambiar el correo.'), true);
        return;
    }

    if (newEmail !== confirmNewEmail) {
        _setUserEmailMessage(_t('admin.user.validation.email_mismatch', null, 'La confirmación no coincide con el nuevo correo.'), true);
        return;
    }

    _setUserEmailSubmitPending(true);

    try {
        const response = await fetchWithAuth('/api/admin/account/change-email/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPassword,
                newEmail,
                confirmNewEmail
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || _t('admin.user.error.email_request', null, 'No se pudo solicitar el cambio de correo'));
        }

        const form = document.getElementById('user-email-form');
        if (form) form.reset();

        _setUserEmailMessage(data.message || _t('admin.user.success.email_request', null, 'Revisa el nuevo correo para confirmar el cambio.'));
    } catch (error) {
        _setUserEmailMessage(error.message || _t('admin.user.error.email_request', null, 'No se pudo solicitar el cambio de correo.'), true);
    } finally {
        _setUserEmailSubmitPending(false);
    }
}

function _handleUserDeletionRequest(event) {
    event.preventDefault();

    const submitButton = document.getElementById('user-delete-submit-btn');
    if (submitButton?.disabled) return;

    _setUserDeleteMessage('');

    const currentPassword = document.getElementById('user-delete-password')?.value || '';

    if (!currentPassword) {
        _setUserDeleteMessage(_t('admin.user.validation.password_required', null, 'La contraseña es obligatoria para eliminar la cuenta.'), true);
        return;
    }

    const title = _t('admin.user.delete_request_title', null, 'Confirmar solicitud de eliminación');
    const message = _t('admin.user.delete_request_msg', null, '¿Seguro que quieres eliminar tu cuenta? Recibirás un correo electrónico para confirmar esta acción.');

    const onConfirmRequest = async () => {
        _setUserDeleteSubmitPending(true);

        try {
            const response = await fetchWithAuth('/api/admin/account/delete/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || _t('admin.user.error.delete_request', null, 'No se pudo solicitar la eliminación de la cuenta'));
            }

            const form = document.getElementById('user-delete-form');
            if (form) form.reset();

            _setUserDeleteMessage(data.message || _t('admin.user.success.delete_request', null, 'Revisa tu correo electrónico para confirmar la eliminación de la cuenta.'));
        } catch (error) {
            _setUserDeleteMessage(error.message || _t('admin.user.error.delete_request', null, 'No se pudo solicitar la eliminación de la cuenta.'), true);
        } finally {
            _setUserDeleteSubmitPending(false);
        }
    };

    if (typeof mostrarModalConfirmacion === 'function') {
        mostrarModalConfirmacion(
            title,
            message,
            onConfirmRequest,
            null,
            _t('admin.user.btn_delete_account', null, 'Solicitar eliminación'),
            _t('admin.common.cancel', null, 'Cancelar')
        );
    } else {
        if (window.confirm(message)) {
            onConfirmRequest();
        }
    }
}

function _renderAccountView(editorArea) {
    editorArea.innerHTML = _tHtml(`
        <div class="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
            <div>
                <h2 class="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <i class="fas fa-user-cog text-slate-700"></i>
                    ${_t('admin.user.panel_title', null, 'Usuario')}
                </h2>
                <p class="text-slate-500 mt-1">${_t('admin.user.panel_desc', null, 'Gestiona tu cuenta y actualiza tu contraseña.')}</p>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
                <h3 class="text-lg font-bold text-slate-800 mb-4">${_t('admin.user.data_section', null, 'Datos de la cuenta')}</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p class="text-slate-500">${_t('admin.user.username_label', null, 'Usuario')}</p>
                        <p id="user-account-username" class="font-bold text-slate-900">-</p>
                    </div>
                    <div>
                        <p class="text-slate-500">${_t('admin.user.email_label', null, 'Correo')}</p>
                        <p id="user-account-email" class="font-bold text-slate-900">-</p>
                    </div>
                    <div>
                        <p class="text-slate-500">${_t('admin.user.role_label', null, 'Rol')}</p>
                        <p id="user-account-role" class="font-bold text-slate-900 uppercase">-</p>
                    </div>
                </div>
            </div>

            <div id="user-license-card"></div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
                <h3 class="text-lg font-bold text-slate-800 mb-4">${_t('admin.user.password_section', null, 'Cambiar contraseña')}</h3>
                <form id="user-password-form" class="space-y-4">
                    <input id="user-current-password" type="password" autocomplete="current-password"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                        placeholder="${_t('admin.user.ph_current_password', null, 'Contraseña actual')}" required>
                    <input id="user-new-password" type="password" autocomplete="new-password"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                        placeholder="${_t('admin.user.ph_new_password', null, 'Nueva contraseña')}" required>
                    <input id="user-confirm-password" type="password" autocomplete="new-password"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                        placeholder="${_t('admin.user.ph_confirm_password', null, 'Confirmar nueva contraseña')}" required>
                    <button type="submit"
                        class="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-lg transition">
                        ${_t('admin.user.btn_save_password', null, 'Guardar contraseña')}
                    </button>
                </form>
                <p id="user-account-message" class="hidden mt-4 text-sm font-semibold"></p>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
                <h3 class="text-lg font-bold text-slate-800 mb-4">${_t('admin.user.email_section', null, 'Cambiar correo electrónico')}</h3>
                <form id="user-email-form" class="space-y-4">
                    <input id="user-email-current-password" type="password" autocomplete="current-password"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                        placeholder="${_t('admin.user.ph_current_password', null, 'Contraseña actual')}" required>
                    <input id="user-new-email" type="email" autocomplete="email"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                        placeholder="${_t('admin.user.ph_new_email', null, 'Nuevo correo')}" required>
                    <input id="user-confirm-new-email" type="email" autocomplete="email"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                        placeholder="${_t('admin.user.ph_confirm_email', null, 'Confirmar nuevo correo')}" required>
                    <button id="user-email-submit-btn" type="submit"
                        class="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-lg transition">
                        ${_t('admin.user.btn_email_change', null, 'Solicitar cambio de correo')}
                    </button>
                    <p class="text-xs text-slate-500">${_t('admin.user.email_note', null, 'El correo actual no cambia hasta confirmar el enlace enviado al nuevo correo.')}</p>
                    <p id="user-email-message" class="hidden text-sm font-semibold"></p>
                </form>
            </div>

            <div class="bg-red-50 rounded-2xl shadow-sm border border-red-200 p-5 md:p-6 mt-6">
                <h3 class="text-lg font-bold text-red-800 mb-4"><i class="fas fa-exclamation-triangle mr-2"></i>${_t('admin.user.delete_section', null, 'Zona de peligro: Eliminar cuenta')}</h3>
                <p class="text-sm text-red-700 mb-4">${_t('admin.user.delete_warning', null, 'Una vez eliminada la cuenta, no hay vuelta atrás. Se perderán todos tus datos y juegos.')}</p>
                <form id="user-delete-form" class="space-y-4">
                    <input id="user-delete-password" type="password" autocomplete="current-password"
                        class="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        placeholder="${_t('admin.user.ph_current_password', null, 'Contraseña actual')}" required>
                    <button id="user-delete-submit-btn" type="submit"
                        class="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg transition">
                        ${_t('admin.user.btn_delete_account', null, 'Solicitar eliminación')}
                    </button>
                    <p class="text-xs text-red-600">${_t('admin.user.delete_note', null, 'Recibirás un correo electrónico de confirmación con un enlace de un solo uso.')}</p>
                    <p id="user-delete-message" class="hidden text-sm font-semibold"></p>
                </form>
            </div>
        </div>
    `);

    const passwordForm = document.getElementById('user-password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', _handleUserPasswordChange);
    }

    const emailForm = document.getElementById('user-email-form');
    if (emailForm) {
        emailForm.addEventListener('submit', _handleUserEmailChangeRequest);
    }

    const deleteForm = document.getElementById('user-delete-form');
    if (deleteForm) {
        deleteForm.addEventListener('submit', _handleUserDeletionRequest);
    }

    _loadUserAccountData();

    if (typeof renderUserLicenseCard === 'function') {
        renderUserLicenseCard();
    }
}

function _renderManageUsersView(editorArea) {
    editorArea.innerHTML = _tHtml(`
        <div class="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
            <div>
                <h2 class="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <i class="fas fa-users-cog text-indigo-600"></i>
                    ${_t('admin.user.manage.title', null, 'Gestionar usuarios')}
                </h2>
                <p class="text-slate-500 mt-1">${_t('admin.user.manage_panel_desc', null, 'Panel exclusivo de administración para revisar y eliminar cuentas.')}</p>
            </div>

            <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                ${_t('admin.user.manage_warning', null, 'El borrado de usuarios es permanente y no se puede deshacer.')}
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 class="text-lg font-bold text-slate-800">${_t('admin.user.manage_list_title', null, 'Usuarios del panel')}</h3>
                    <button id="btn-refresh-admin-users" type="button"
                        class="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg transition">
                        ${_t('admin.common.refresh', null, 'Actualizar')}
                    </button>
                </div>

                <div class="overflow-x-auto border border-slate-200 rounded-xl">
                    <table class="min-w-full text-sm">
                        <thead class="bg-slate-50 text-slate-600 uppercase text-xs">
                            <tr>
                                <th class="px-4 py-3 text-left">${_t('admin.user.col_username', null, 'Usuario')}</th>
                                <th class="px-4 py-3 text-left">${_t('admin.user.col_email', null, 'Correo')}</th>
                                <th class="px-4 py-3 text-left">${_t('admin.user.col_role', null, 'Rol')}</th>
                                <th class="px-4 py-3 text-left">${_t('admin.user.col_status', null, 'Estado')}</th>
                                <th class="px-4 py-3 text-left">${_t('admin.user.col_created', null, 'Alta')}</th>
                                <th class="px-4 py-3 text-right">${_t('admin.user.col_actions', null, 'Acciones')}</th>
                            </tr>
                        </thead>
                        <tbody id="admin-users-table-body" class="bg-white"></tbody>
                    </table>
                </div>
                <p id="user-management-message" class="hidden mt-4 text-sm font-semibold"></p>
            </div>
        </div>
    `);

    const refreshButton = document.getElementById('btn-refresh-admin-users');
    if (refreshButton) {
        refreshButton.addEventListener('click', _loadAdminUsers);
    }

    _loadAdminUsers();
}

function renderUserPanel() {
    const editorArea = document.getElementById('editorArea');
    if (!editorArea) return;

    if (activeUserPanelView === 'manage-users' && isAdmin()) {
        _renderManageUsersView(editorArea);
        return;
    }

    activeUserPanelView = 'account';
    _updateUserSidebarButtons();
    _renderAccountView(editorArea);
}
