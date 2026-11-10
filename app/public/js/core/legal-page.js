/**
 * @fileoverview Páginas legales: completa los datos del titular de esta instalación
 * (/api/legal-info). Sin ellos la página sigue legible con su texto estático.
 * El correo se muestra como enlace mailto: es la vía de todas las solicitudes.
 */
(function () {
    'use strict';

    // El valor viene del panel de admin pero acaba en un href: sin espacios ni
    // caracteres que abran parámetros (?, &) o rompan el atributo.
    const EMAIL_PATTERN = /^[^\s@<>"'?&]+@[^\s@<>"'?&]+\.[^\s@<>"'?&]+$/;

    function fillText(element, value) {
        element.textContent = value;
    }

    function fillEmail(element, address) {
        if (!EMAIL_PATTERN.test(address)) {
            fillText(element, address);
            return;
        }
        const link = document.createElement('a');
        link.href = `mailto:${address}`;
        link.className = 'text-plum-700 underline underline-offset-2';
        link.textContent = address;
        element.replaceChildren(link);
    }

    function applyField(field, value) {
        const fill = field === 'email' ? fillEmail : fillText;
        document.querySelectorAll(`[data-legal-field="${field}"]`).forEach(element => {
            fill(element, String(value));
        });
        document.querySelectorAll(`[data-legal-optional="${field}"]`).forEach(element => {
            element.hidden = false;
        });
    }

    function applyLegalInfo(info) {
        Object.keys(info)
            .filter(field => info[field])
            .forEach(field => applyField(field, info[field]));
    }

    fetch('/api/legal-info')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(applyLegalInfo)
        .catch(error => console.warn('Legal details unavailable', error.message));
})();
