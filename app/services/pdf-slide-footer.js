/**
 * @fileoverview Pie de diapositiva (slide_footer) en el PDF del juego personalizado.
 * Normaliza y escapa con el mismo núcleo que los clientes (public/js/core/slide-footer.js).
 */

const SlideFooter = require('../public/js/core/slide-footer.js');

/**
 * HTML del pie al fondo de la página (.page es position: relative), o '' si no hay.
 * @param {Object} slide - Diapositiva con slide_footer
 * @returns {string}
 */
function generateSlideFooterHTML(slide) {
    const text = SlideFooter.footerText(slide);
    if (!text) return '';
    return `<div style="position: absolute; left: 0; right: 0; bottom: 36px; text-align: center;">
        <span style="display: inline-block; max-width: 72%; padding: 8px 22px; border-radius: 12px; background: rgba(0,0,0,0.35); color: rgba(255,255,255,0.92); font-size: 20px; font-weight: 600; line-height: 1.35; white-space: pre-line; overflow-wrap: break-word;">${SlideFooter.escapeText(text)}</span>
    </div>`;
}

module.exports = { generateSlideFooterHTML };
