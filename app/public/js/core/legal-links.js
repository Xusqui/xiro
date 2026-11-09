/**
 * @fileoverview Enlaces a los textos legales en los contenedores [data-legal-links].
 * Llevan data-i18n, así que i18n-dom los traduce al cargar y al cambiar de idioma.
 */
(function () {
    'use strict';

    const LINKS = [
        ['common.legal.notice', 'Aviso legal', 'aviso-legal.html'],
        ['common.legal.privacy', 'Privacidad', 'privacidad.html'],
        ['common.legal.cookies', 'Cookies', 'cookies.html'],
        ['common.legal.terms', 'Términos', 'terminos.html'],
        ['common.legal.refunds', 'Reembolsos', 'reembolsos.html'],
        ['common.legal.accessibility', 'Accesibilidad', 'accesibilidad.html']
    ];

    function createLink([key, label, file]) {
        const link = document.createElement('a');
        link.href = `/legal/${file}`;
        link.className = 'underline underline-offset-2';
        link.setAttribute('data-i18n', key);
        link.textContent = label;
        return link;
    }

    function fillContainer(container) {
        LINKS.forEach((entry, index) => {
            if (index > 0) container.append(' · ');
            container.append(createLink(entry));
        });
    }

    document.querySelectorAll('[data-legal-links]').forEach(fillContainer);
})();
