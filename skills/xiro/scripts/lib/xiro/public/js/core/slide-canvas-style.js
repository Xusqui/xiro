/**
 * @fileoverview Estilo de la diapositiva libre (fase B): opacidad y sombra de cualquier
 * elemento, borde y texto alternativo de las imágenes y degradado del fondo.
 *
 * normalize*: los campos solo se escriben cuando tienen valor (opacidad < 1, sombra, borde,
 * alt, degradado), así que los lienzos ya guardados no cambian al normalizarse.
 * *Css: el CSS que pinta el render en las seis pantallas y en el PDF. Los colores con canal
 * alfa salen como rgba(): webOS 3.5 (Chromium 38) no entiende #rrggbbaa.
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasStyle y module.exports.
 */
(function (root) {
    'use strict';

    const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
    const MAX_ALT = 300;
    // Sombras que ofrece el editor; la importación (fases H e I) puede traer cualquier otra
    const SHADOW_PRESETS = {
        soft: { x: 0, y: 12, blur: 32, color: '#00000080' },
        strong: { x: 12, y: 12, blur: 0, color: '#000000b3' },
        glow: { x: 0, y: 0, blur: 28, color: '#ffffffcc' }
    };

    function isColor(v) {
        return typeof v === 'string' && COLOR_RE.test(v);
    }

    function int(v, min, max) {
        return typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null;
    }

    /** Sombra válida { x, y, blur, color } o null. */
    function normalizeShadow(s) {
        if (!s || typeof s !== 'object' || !isColor(s.color)) return null;
        let x = int(s.x, -100, 100);
        let y = int(s.y, -100, 100);
        let blur = int(s.blur, 0, 100);
        if (x === null || y === null || blur === null) return null;
        return { x: x, y: y, blur: blur, color: s.color };
    }

    /**
     * Copia en `el` la opacidad y la sombra de `raw` cuando tienen valor.
     * @param {Object} raw - Elemento de entrada.
     * @param {Object} el - Elemento normalizado (se completa).
     */
    function normalizeElementStyle(raw, el) {
        let opacity = typeof raw.opacity === 'number' && isFinite(raw.opacity) ? Math.round(raw.opacity * 100) / 100 : 1;
        if (opacity < 1) el.opacity = Math.max(0.05, opacity);
        let shadow = normalizeShadow(raw.shadow);
        if (shadow) el.shadow = shadow;
    }

    /**
     * Copia en `out` el texto alternativo y el borde de la imagen cuando tienen valor.
     * @param {Object} p - Props de entrada.
     * @param {Object} out - Props normalizadas (se completan).
     */
    function normalizeImageExtras(p, out) {
        let alt = typeof p.alt === 'string' ? p.alt.replace(/\s+/g, ' ').trim().slice(0, MAX_ALT) : '';
        if (alt) out.alt = alt;
        let width = int(p.borderWidth, 0, 40);
        if (width) {
            out.borderWidth = width;
            out.borderColor = isColor(p.borderColor) ? p.borderColor : '#ffffff';
        }
    }

    /** Degradado del fondo { to, angle } (empieza en el color del fondo), o null. */
    function normalizeGradient(g) {
        if (!g || typeof g !== 'object' || !isColor(g.to)) return null;
        let angle = int(g.angle, 0, 359);
        return { to: g.to, angle: angle === null ? 180 : angle };
    }

    /** Color de CSS que entienden también los navegadores antiguos. */
    function cssColor(hex) {
        if (!isColor(hex)) return 'transparent';
        if (hex.length === 7) return hex;
        let n = function (i) {
            return parseInt(hex.slice(i, i + 2), 16);
        };
        return 'rgba(' + n(1) + ',' + n(3) + ',' + n(5) + ',' + Math.round((n(7) / 255) * 100) / 100 + ')';
    }

    /** CSS de opacidad y sombra del contenedor del elemento ('' si no tiene). */
    function elementCss(el) {
        let css = '';
        if (typeof el.opacity === 'number' && el.opacity < 1) css += 'opacity:' + el.opacity + ';';
        let s = normalizeShadow(el.shadow);
        if (s) {
            // drop-shadow sigue la silueta (figuras, glifos, PNG transparentes), no la caja
            let f = 'drop-shadow(' + s.x + 'px ' + s.y + 'px ' + s.blur + 'px ' + cssColor(s.color) + ')';
            css += '-webkit-filter:' + f + ';filter:' + f + ';';
        }
        return css;
    }

    /** CSS del borde de la imagen ('' si no tiene). */
    function imageBorderCss(p) {
        if (!p.borderWidth) return '';
        return 'box-sizing:border-box;border:' + p.borderWidth + 'px solid ' + cssColor(p.borderColor) + ';';
    }

    /**
     * Capas de background-image del fondo: imagen encima del degradado.
     * @param {Object} bg - Fondo normalizado.
     * @param {string} imageUrl - URL ya escapada, o ''.
     * @returns {string} Declaración CSS, o ''.
     */
    function backgroundCss(bg, imageUrl) {
        let layers = [];
        if (imageUrl) layers.push('url(&quot;' + imageUrl + '&quot;)');
        let g = normalizeGradient(bg.gradient);
        if (g) layers.push('linear-gradient(' + g.angle + 'deg,' + cssColor(bg.color) + ',' + cssColor(g.to) + ')');
        return layers.length ? 'background-image:' + layers.join(',') + ';' : '';
    }

    /** Nombre de la sombra predefinida que coincide, 'custom' si es otra, o 'none'. */
    function shadowPresetOf(shadow) {
        let s = normalizeShadow(shadow);
        if (!s) return 'none';
        for (let name in SHADOW_PRESETS) {
            let p = SHADOW_PRESETS[name];
            if (p.x === s.x && p.y === s.y && p.blur === s.blur && p.color === s.color) return name;
        }
        return 'custom';
    }

    const api = {
        MAX_ALT: MAX_ALT,
        SHADOW_PRESETS: SHADOW_PRESETS,
        normalizeShadow: normalizeShadow,
        normalizeElementStyle: normalizeElementStyle,
        normalizeImageExtras: normalizeImageExtras,
        normalizeGradient: normalizeGradient,
        cssColor: cssColor,
        elementCss: elementCss,
        imageBorderCss: imageBorderCss,
        backgroundCss: backgroundCss,
        shadowPresetOf: shadowPresetOf
    };

    root.XiroSlideCanvasStyle = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
