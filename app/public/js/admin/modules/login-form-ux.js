/**
 * @fileoverview Comportamiento común de los formularios de acceso al panel:
 * envíos sin repeticiones y foco al cambiar de formulario.
 */

const _LOGIN_FORM_SWITCHERS = '#admin-register-btn, #admin-forgot-password-btn, #register-back-btn, #forgot-back-btn';

/**
 * Ejecuta el envío de un formulario e ignora los envíos repetidos mientras dura.
 * @param {HTMLFormElement} form - Formulario que se envía
 * @param {function(): Promise<void>} submit - Envío; gestiona sus propios errores
 * @returns {Promise<void>}
 */
async function _withBusySubmit(form, submit) {
    if (form.getAttribute('aria-busy') === 'true') return;
    form.setAttribute('aria-busy', 'true');
    try {
        await submit();
    } finally {
        form.removeAttribute('aria-busy');
    }
}

// El botón pulsado desaparece con su formulario: sin esto, el foco saltaría al inicio de la página.
// Va al título y no al primer campo para no abrir el teclado del móvil sin que se pida.
document.getElementById('login-overlay')?.addEventListener('click', event => {
    if (event.target.closest(_LOGIN_FORM_SWITCHERS)) document.getElementById('login-card-title').focus();
});
