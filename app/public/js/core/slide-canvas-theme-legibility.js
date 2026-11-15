/**
 * @fileoverview Legibilidad al cambiar de tema (fase F): cuando un tema cambia el fondo, los elementos que no
 * tienen `role` (los de antes, los de plantillas o los de la IA) conservan su aspecto, pero un texto blanco no
 * puede quedarse sobre un fondo claro. fixLegibility mide cada texto, tabla, gráfico y línea sin rol contra lo
 * que tiene detrás (su propio relleno, la forma que lo cubre o el fondo del tema) y, si no llega a 4.5:1 (3:1 en
 * líneas), le da el color del texto del tema, o el mejor de texto, apagado, negro y blanco si ese tampoco llega.
 * Lo que ya se lee no se toca. Expone window.XiroSlideCanvasThemeLegibility y module.exports.
 */
(function (root) {
    'use strict';

    const MIN_TEXT = 4.5;
    const MIN_LINE = 3;
    const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
    // Formas cerradas que cuentan como fondo de lo que tienen encima
    const BACKING_SHAPES = ['rect', 'ellipse', 'path'];

    /** Color #rrggbb sin el canal alfa, o null si no es un color. */
    function rgb(color) {
        return typeof color === 'string' && COLOR_RE.test(color) ? color.slice(0, 7) : null;
    }

    function channel(hex, from) {
        const c = parseInt(hex.slice(from, from + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    function luminance(hex) {
        return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
    }

    /**
     * Relación de contraste WCAG entre dos colores (el canal alfa se ignora), con 2 decimales.
     * @param {string} a - Color #rrggbb o #rrggbbaa
     * @param {string} b - Color #rrggbb o #rrggbbaa
     * @returns {number}
     */
    function contrast(a, b) {
        const la = luminance(rgb(a));
        const lb = luminance(rgb(b));
        return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
    }

    /** El peor contraste de un color contra todos los fondos dados. */
    function worst(color, backs) {
        return Math.min.apply(null, backs.map(function (back) { return contrast(color, back); }));
    }

    /** Color de texto del tema si se lee sobre todos los fondos; si no, el mejor de texto, apagado, negro y blanco. */
    function bestInk(backs, theme, min) {
        const p = theme.palette;
        if (worst(p.text, backs) >= min) return p.text;
        return [p.text, p.muted, '#000000', '#ffffff'].reduce(function (best, color) {
            return worst(color, backs) > worst(best, backs) ? color : best;
        });
    }

    /** Relleno de la forma más alta (la última del array) por debajo de `index` que contiene el centro del elemento. */
    function underlying(elements, index) {
        const el = elements[index];
        const cx = el.x + el.w / 2;
        const cy = el.y + el.h / 2;
        for (let j = index - 1; j >= 0; j--) {
            const e = elements[j];
            const fill = e.type === 'shape' && !e.hidden && BACKING_SHAPES.indexOf(e.props.shape) >= 0 ? rgb(e.props.fill) : null;
            if (fill && cx >= e.x && cx <= e.x + e.w && cy >= e.y && cy <= e.y + e.h) return fill;
        }
        return null;
    }

    /** Si `holder[key]` no se lee sobre los fondos dados, lo cambia por un color legible. */
    function fixInk(holder, key, backs, theme, min) {
        const color = rgb(holder[key]);
        if (color && worst(color, backs) < min) holder[key] = bestInk(backs, theme, min);
    }

    function fixText(el, back, theme) {
        const backs = [rgb(el.props.fill) || back];
        fixInk(el.props, 'color', backs, theme, MIN_TEXT);
        (el.props.runs || []).forEach(function (run) {
            fixInk(run, 'color', backs, theme, MIN_TEXT);
        });
    }

    function fixTable(el, back, theme) {
        const backs = [rgb(el.props.fill) || back];
        if (rgb(el.props.headerFill)) backs.push(rgb(el.props.headerFill));
        fixInk(el.props, 'color', backs, theme, MIN_TEXT);
    }

    /**
     * Ajusta los colores ilegibles de los elementos sin rol (modifica y devuelve el lienzo que recibe: llámalo con
     * una copia). Los elementos con rol, los bloqueados, las imágenes y las formas cerradas no se tocan.
     * @param {Object} canvas - Lienzo ya con el fondo del tema puesto.
     * @param {Object} theme - Tema aplicado.
     * @returns {Object} El mismo lienzo.
     */
    function fixLegibility(canvas, theme) {
        const slideBg = rgb(canvas.background && canvas.background.color) || theme.palette.bg;
        canvas.elements.forEach(function (el, i) {
            if (el.role || el.locked) return;
            const back = underlying(canvas.elements, i) || slideBg;
            if (el.type === 'text') fixText(el, back, theme);
            else if (el.type === 'table') fixTable(el, back, theme);
            else if (el.type === 'chart') fixInk(el.props, 'color', [back], theme, MIN_TEXT);
            else if (el.type === 'shape' && (el.props.shape === 'line' || el.props.shape === 'arrow')) fixInk(el.props, 'stroke', [back], theme, MIN_LINE);
        });
        return canvas;
    }

    const api = { contrast: contrast, fixLegibility: fixLegibility };

    root.XiroSlideCanvasThemeLegibility = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
