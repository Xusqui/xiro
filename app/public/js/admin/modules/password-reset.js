/**
 * @fileoverview Recuperación de contraseña del panel admin (olvidé mi contraseña /
 * establecer nueva contraseña desde el enlace del email).
 */

const forgotPasswordBtn = document.getElementById('admin-forgot-password-btn');
const forgotForm = document.getElementById('admin-forgot-password-form');
const forgotBackBtn = document.getElementById('forgot-back-btn');
const forgotError = document.getElementById('forgot-error');
const forgotHelper = document.getElementById('forgot-helper');

const resetForm = document.getElementById('admin-reset-password-form');
const resetError = document.getElementById('reset-error');
const resetHelper = document.getElementById('reset-helper');

let pendingResetToken = null;

function _showAuthForm(formToShow) {
    [document.getElementById('admin-login-form'), forgotForm, resetForm, document.getElementById('admin-register-form')]
        .forEach((form) => {
            if (form) form.classList.toggle('hidden', form !== formToShow);
        });
}

function _setForgotError(message, i18nKey) {
    if (i18nKey) forgotError.setAttribute('data-i18n', i18nKey);
    else forgotError.removeAttribute('data-i18n');
    forgotError.textContent = message;
    forgotError.classList.remove('hidden');
}

function _clearForgotError() {
    forgotError.textContent = '';
    forgotError.classList.add('hidden');
}

function _setForgotHelper(message, i18nKey) {
    if (i18nKey) forgotHelper.setAttribute('data-i18n', i18nKey);
    else forgotHelper.removeAttribute('data-i18n');
    forgotHelper.textContent = message;
}

function _setResetError(message, i18nKey) {
    if (i18nKey) resetError.setAttribute('data-i18n', i18nKey);
    else resetError.removeAttribute('data-i18n');
    resetError.textContent = message;
    resetError.classList.remove('hidden');
}

function _clearResetError() {
    resetError.textContent = '';
    resetError.classList.add('hidden');
}

function _setResetHelper(message, i18nKey) {
    if (i18nKey) resetHelper.setAttribute('data-i18n', i18nKey);
    else resetHelper.removeAttribute('data-i18n');
    resetHelper.textContent = message;
}

function _backToLogin() {
    forgotForm.classList.add('hidden');
    resetForm.classList.add('hidden');
    showLoginForm();
}

function showForgotPasswordForm() {
    _clearForgotError();
    const title = document.getElementById('login-card-title');
    title.setAttribute('data-i18n', 'admin.forgot.title');
    title.textContent = _t('admin.forgot.title', null, 'Recuperar contraseña');
    _setForgotHelper(_t('admin.forgot.helper', null, 'Te enviaremos un enlace para restablecer tu contraseña.'), 'admin.forgot.helper');
    _showAuthForm(forgotForm);
}

function showResetPasswordForm() {
    _clearResetError();
    const title = document.getElementById('login-card-title');
    title.setAttribute('data-i18n', 'admin.reset.title');
    title.textContent = _t('admin.reset.title', null, 'Establecer nueva contraseña');
    _setResetHelper('', null);
    _showAuthForm(resetForm);
}

async function submitForgotPasswordRequest() {
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();

    _clearForgotError();

    if (!email) {
        _setForgotError(_t('admin.forgot.error_empty', null, 'El correo es obligatorio'), 'admin.forgot.error_empty');
        return;
    }

    try {
        const res = await fetch('/api/admin-password-reset/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.status === 429) {
            _setForgotError(_t('admin.login.error_rate_limit_15m', null, 'Has excedido el número de intentos permitidos. Intenta de nuevo en 15 minutos.'), 'admin.login.error_rate_limit_15m');
            return;
        }

        forgotForm.reset();
        _setForgotHelper(data.message || _t('admin.forgot.success', null, 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.'), data.message ? null : 'admin.forgot.success');
    } catch (_err) {
        _setForgotError(_t('admin.common.error_connection', null, 'Error de conexión'), 'admin.common.error_connection');
    }
}

async function submitPasswordReset() {
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmNewPassword = document.getElementById('reset-confirm-password').value;

    _clearResetError();

    if (!newPassword || !confirmNewPassword) {
        _setResetError(_t('admin.register.error_empty', null, 'Todos los campos son obligatorios'), 'admin.register.error_empty');
        return;
    }

    if (newPassword !== confirmNewPassword) {
        _setResetError(_t('admin.reset.error_mismatch', null, 'Las contraseñas no coinciden'), 'admin.reset.error_mismatch');
        return;
    }

    try {
        const res = await fetch('/api/admin-password-reset/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: pendingResetToken, newPassword, confirmNewPassword })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            pendingResetToken = null;
            _backToLogin();
            setLoginHelperMessage(data.message || _t('admin.reset.success', null, 'Contraseña actualizada. Ya puedes iniciar sesión.'), data.message ? null : 'admin.reset.success');
            return;
        }

        if (res.status === 400) {
            _setResetError(_t('admin.reset.error_token', null, 'El enlace de restablecimiento no es válido o ha expirado'), 'admin.reset.error_token');
            return;
        }

        _setResetError(data.error || _t('admin.reset.error_failed', null, 'No se pudo restablecer la contraseña'), data.error ? null : 'admin.reset.error_failed');
    } catch (_err) {
        _setResetError(_t('admin.common.error_connection', null, 'Error de conexión'), 'admin.common.error_connection');
    }
}

async function checkPasswordResetTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (!token) return;

    pendingResetToken = token;
    showResetPasswordForm();

    params.delete('reset_token');
    const newQuery = params.toString();
    const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
    window.history.replaceState({}, '', newUrl);
}

if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', () => showForgotPasswordForm());
}

if (forgotBackBtn) {
    forgotBackBtn.addEventListener('click', () => _backToLogin());
}

forgotForm.onsubmit = async function (e) {
    e.preventDefault();
    await submitForgotPasswordRequest();
};

resetForm.onsubmit = async function (e) {
    e.preventDefault();
    await submitPasswordReset();
};
