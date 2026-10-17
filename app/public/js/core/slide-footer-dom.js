/**
 * @fileoverview Inserta el pie de diapositiva (slide_footer) en el DOM.
 * El HTML lo genera core/slide-footer.js (window.XiroSlideFooter), que escapa el texto.
 */

/**
 * Añade el pie al final del contenedor, si la diapositiva lo lleva.
 * @param {Element|null} container - Contenedor ya pintado (lobby-main, body…)
 * @param {Object} slide - Diapositiva con slide_footer
 * @param {string} variant - presenter | player | standalone
 */
export function appendSlideFooter(container, slide, variant) {
    const lib = typeof window !== 'undefined' ? window.XiroSlideFooter : null;
    if (!container || !lib) return;
    const html = lib.footerHtml(slide, variant);
    if (html) container.insertAdjacentHTML('beforeend', html);
}

/** Texto del pie que se está mostrando (para repintar la diapositiva sin perderlo). */
export function currentSlideFooterText() {
    const el = document.querySelector('.slide-footer-text');
    return el ? el.textContent : null;
}
