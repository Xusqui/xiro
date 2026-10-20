/**
 * @fileoverview Pie de diapositiva (slide_footer) de las diapositivas especiales
 * de los juegos personalizados: Actividad, Info, Texto, Imagen y Texto+Imagen.
 *
 * El pie es texto plano escrito en el editor: se escapa SIEMPRE antes de pintarlo
 * (nunca se interpreta como HTML) y los saltos de línea se respetan con CSS
 * (white-space: pre-line en .slide-footer, css/slide-footer.css).
 *
 * Lo comparten el presentador, el jugador, standalone y tv.html.
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 * Expone window.XiroSlideFooter y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    const MAX_LENGTH = 300;
    const VARIANTS = ['presenter', 'player', 'tv', 'standalone'];
    const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;', '`': '&#96;' };

    function escapeText(value) {
        return String(value).replace(/[&<>"'`]/g, function (ch) {
            return HTML_ESCAPES[ch];
        });
    }

    /** Texto del pie recortado, o '' si no hay (null, no texto o solo espacios). */
    function footerText(slide) {
        const raw = slide && typeof slide.slide_footer === 'string' ? slide.slide_footer : '';
        const trimmed = raw.replace(/\r\n?/g, '\n').trim();
        return trimmed.length > MAX_LENGTH ? trimmed.slice(0, MAX_LENGTH) : trimmed;
    }

    /**
     * HTML del pie, listo para insertar, o '' si la diapositiva no lleva pie.
     * @param {Object} slide - Diapositiva con slide_footer
     * @param {string} [variant] - presenter | player | tv | standalone
     * @returns {string}
     */
    function footerHtml(slide, variant) {
        const text = footerText(slide);
        if (!text) return '';
        const safeVariant = VARIANTS.indexOf(variant) >= 0 ? variant : 'presenter';
        return (
            '<div class="slide-footer slide-footer--' +
            safeVariant +
            '" data-i18n-skip="true" role="note">' +
            '<span class="slide-footer-text">' +
            escapeText(text) +
            '</span></div>'
        );
    }

    const api = {
        MAX_LENGTH: MAX_LENGTH,
        escapeText: escapeText,
        footerText: footerText,
        footerHtml: footerHtml
    };

    root.XiroSlideFooter = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
