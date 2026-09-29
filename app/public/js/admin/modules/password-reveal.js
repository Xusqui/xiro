/**
 * @fileoverview Iris camaleónica: alterna la visibilidad de los inputs de
 * contraseña del login/registro/reset del panel admin. En vez del clásico
 * icono de ojo tachado, el botón dibuja un anillo con pupila en ranura que
 * se dilata y muda a coral al revelar, evocando la muda de color de la
 * mascota camaleón.
 */

(function () {
    'use strict';

    function applyLabel(button, key, fallback) {
        button.dataset.i18nAriaLabel = key;
        const api = window.XiroI18n;
        button.setAttribute('aria-label', api ? api.t(key, null, fallback) : fallback);
    }

    function toggle(button) {
        const input = document.getElementById(button.dataset.revealTarget);
        if (!input) return;

        const revealed = input.type === 'password';
        input.type = revealed ? 'text' : 'password';
        button.classList.toggle('is-revealed', revealed);
        button.setAttribute('aria-pressed', String(revealed));
        applyLabel(
            button,
            revealed ? 'admin.login.password_hide' : 'admin.login.password_show',
            revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'
        );

        const wrap = button.closest('.xiro-input-wrap');
        if (revealed && wrap) {
            wrap.classList.remove('xiro-reveal-pulse');
            void wrap.offsetWidth; // reflow: permite re-disparar la animación en clics consecutivos
            wrap.classList.add('xiro-reveal-pulse');
        }

        input.focus({ preventScroll: true });
    }

    document.querySelectorAll('.xiro-reveal-toggle').forEach((button) => {
        button.addEventListener('click', () => toggle(button));
    });
})();
