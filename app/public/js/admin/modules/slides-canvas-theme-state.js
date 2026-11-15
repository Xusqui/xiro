/**
 * @fileoverview Tema del juego personalizado en el editor (fase F4b): el tema actual, que llega del servidor
 * (custom_games.slide_theme) y vuelve en `slide_theme` al guardar; aplicarlo a las diapositivas libres con una
 * instantánea para «Deshacer» a nivel de juego (un solo nivel); y dar el valor para detectar cambios sin
 * guardar. No dibuja nada: el diálogo «Tema» es de la fase F4c. Usa core/slide-canvas-theme.js y
 * core/slide-canvas-theme-game.js (E.gameTheme).
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    let current = null;
    let history = null;

    const themes = () => root.XiroSlideCanvasTheme;
    const games = () => root.XiroSlideCanvasThemeGame;
    const copy = theme => (theme ? JSON.parse(JSON.stringify(theme)) : null);

    function undoStore() {
        if (!history) history = games().createThemeUndo();
        return history;
    }

    /**
     * Toma el tema del juego que llega del servidor (null si no tiene o no es válido) y olvida lo que hubiera
     * para deshacer.
     * @param {Object|null|undefined} raw - custom_games.slide_theme
     */
    function load(raw) {
        current = themes().normalizeTheme(raw);
        undoStore().clear();
    }

    /**
     * Aplica un tema a las diapositivas del juego. Guarda la instantánea de antes solo si algo cambia
     * (alguna diapositiva o el propio tema).
     * @param {Array} slides - Diapositivas del juego (currentCustomGameQuestions).
     * @param {Object} raw - Tema a aplicar (de serie o propio).
     * @returns {{slides: Array, changed: number}|null} null si el tema no es válido (no se cambia nada).
     */
    function apply(slides, raw) {
        const theme = themes().normalizeTheme(raw);
        if (!theme) return null;
        const out = games().applyThemeToGame(slides, theme, current);
        const sameTheme = JSON.stringify(current) === JSON.stringify(theme);
        if (out.changed > 0 || !sameTheme) undoStore().save({ slides: slides, theme: current });
        current = theme;
        return out;
    }

    /**
     * Restaura las diapositivas y el tema de antes de la última aplicación.
     * @returns {{slides: Array, theme: Object|null}|null} null si no hay nada que deshacer.
     */
    function undo() {
        const state = undoStore().take();
        if (!state) return null;
        current = state.theme;
        return state;
    }

    E.gameTheme = {
        load: load,
        current: () => copy(current),
        apply: apply,
        undo: undo,
        canUndo: () => undoStore().has(),
        forSave: () => copy(current)
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.gameTheme;
})();
