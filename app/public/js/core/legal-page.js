/**
 * @fileoverview Páginas legales: completa los datos del titular de esta instalación
 * (/api/legal-info). Sin ellos la página sigue legible con su texto estático.
 */
(function () {
    'use strict';

    function applyField(field, value) {
        document.querySelectorAll(`[data-legal-field="${field}"]`).forEach(element => {
            element.textContent = value;
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
