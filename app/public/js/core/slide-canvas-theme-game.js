/**
 * @fileoverview Tema a nivel de juego (fase F4a): «Aplicar a todo el juego» y «Deshacer». applyThemeToGame
 * reescribe el lienzo de cada diapositiva libre con el tema; las preguntas y las demás diapositivas no se tocan.
 * createThemeUndo guarda una sola instantánea (diapositivas y tema) para restaurarla; el historial de cada
 * diapositiva no llega a este alcance.
 * Expone window.XiroSlideCanvasThemeGame y module.exports.
 */
(function (root) {
    'use strict';

    /** Módulo hermano: require en Node/Jest, global en el navegador (se busca al usarlo). */
    function themes() {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require('./slide-canvas-theme')
            : root.XiroSlideCanvasTheme;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    /**
     * Aplica el tema a las diapositivas libres del juego (copia; no modifica las originales).
     * @param {Array} slides - Diapositivas del juego (slide_type, slide_canvas…).
     * @param {Object} theme - Tema a aplicar.
     * @param {Object} [prevTheme] - Tema anterior del juego, para conservar los colores de serie elegidos a mano.
     * @returns {{slides: Array, changed: number}} Diapositivas nuevas y cuántas libres han cambiado.
     */
    function applyThemeToGame(slides, theme, prevTheme) {
        let changed = 0;
        const out = slides.map(function (slide) {
            if (!slide || slide.slide_type !== 'canvas' || !slide.slide_canvas) return slide;
            const next = themes().applyTheme(slide.slide_canvas, theme, prevTheme);
            if (JSON.stringify(next) === JSON.stringify(slide.slide_canvas)) return slide;
            changed++;
            return Object.assign({}, slide, { slide_canvas: next });
        });
        return { slides: out, changed: changed };
    }

    /**
     * Instantánea única para «Deshacer»: guarda y devuelve copias, así que lo que se cambie después no la altera.
     * @returns {{save: Function, take: Function, has: Function, clear: Function}}
     */
    function createThemeUndo() {
        let saved = null;
        return {
            save: function (state) {
                saved = { slides: clone(state.slides), theme: state.theme ? clone(state.theme) : null };
            },
            take: function () {
                const out = saved;
                saved = null;
                return out ? clone(out) : null;
            },
            has: function () {
                return saved !== null;
            },
            clear: function () {
                saved = null;
            }
        };
    }

    const api = { applyThemeToGame: applyThemeToGame, createThemeUndo: createThemeUndo };

    root.XiroSlideCanvasThemeGame = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
