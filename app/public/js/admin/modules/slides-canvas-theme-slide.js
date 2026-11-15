/**
 * @fileoverview Tema dentro de la propia diapositiva (fase F4d): aplica un tema SOLO al lienzo abierto, como un
 * único paso del historial del editor (botón de deshacer y Ctrl+Z), sin tocar el tema del juego ni las demás
 * diapositivas. Da la sección «Tema» del panel de propiedades (encima de «Fondo», sin selección) y abre el
 * diálogo en modo diapositiva (slides-canvas-theme-dialog.js). El aviso de lo aplicado solo vale para el lienzo
 * que sigue abierto. Textos: claves admin.canvas.theme.*
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    // Tema aplicado en esta sesión y lienzo al que se aplicó: solo vale mientras ese lienzo siga abierto
    let applied = null;

    const themes = () => root.XiroSlideCanvasTheme;
    const esc = text => root.XiroSlideCanvasRender.escapeText(text);

    /**
     * Aplica un tema al lienzo abierto (un solo paso del historial; nada si no cambia).
     * @param {Object} raw - Tema de serie o propio.
     * @returns {{changed: boolean}|null} null si el tema no es válido.
     */
    function apply(raw) {
        const theme = themes().normalizeTheme(raw);
        if (!theme) return null;
        const canvas = E.state.canvas;
        const next = themes().applyTheme(canvas, theme, E.gameTheme.current());
        if (JSON.stringify(next) === JSON.stringify(canvas)) return { changed: false };
        canvas.background = next.background;
        canvas.elements = next.elements;
        applied = { canvas: canvas, theme: theme };
        E.commit();
        return { changed: true };
    }

    /**
     * Sección «Tema» del panel. Dice de qué tema habla: el aplicado a esta diapositiva (mientras siga abierta) o
     * el del juego. Con sus muestras, «Cambiar tema…» y el aviso de lo aplicado.
     */
    function sectionHtml() {
        const own = applied && applied.canvas === E.state.canvas ? applied.theme : null;
        const theme = own || E.gameTheme.current();
        const name = theme ? E.themeDialog.nameOf(theme) : E.t('theme.card_none');
        const status = own ? E.t('theme.applied_slide') : '';
        return (
            '<section class="xsce-section xsce-theme-slide"><h5>' + E.th('theme.section') + '</h5>' +
            '<p class="xsce-theme-kicker">' + esc(E.t(own ? 'theme.slide_label' : 'theme.game_current')) + '</p>' +
            '<p class="xsce-theme-name">' + esc(name) + '</p>' +
            (theme ? E.themeDialog.swatchesHtml(theme) : '') +
            '<div class="xsce-field"><button type="button" class="xsce-action" data-canvas-panel-action="theme-open">' +
            '<i class="fas fa-palette" aria-hidden="true"></i>' + E.th('theme.change_here') + '</button></div>' +
            '<p class="xsce-theme-status" role="status">' + esc(status) + '</p></section>'
        );
    }

    /** Tras aplicar, el panel se repinta y el botón es otro: el foco vuelve al nuevo. */
    function refocus() {
        const button = document.querySelector('[data-canvas-panel-action="theme-open"]');
        if (button) button.focus();
    }

    /** Abre el diálogo en modo diapositiva. */
    function open() {
        E.themeDialog.open({
            scope: 'slide',
            canvas: E.state.canvas,
            slides: [],
            onApply: theme => {
                apply(theme);
                refocus();
            }
        });
    }

    E.themeSlide = { apply: apply, sectionHtml: sectionHtml, open: open };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.themeSlide;
})();
