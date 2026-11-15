/**
 * @fileoverview Temas de la diapositiva libre (fase F): catálogo de serie, validación de un tema,
 * aviso de contraste y reescritura de colores y fuentes en los elementos con `role`.
 *
 * Un tema es { id, name, palette: { bg, text, muted, accents[6] }, fonts: { title, body }, gradient? }.
 * applyTheme no guarda referencias: reescribe valores resueltos (los seis renderizadores no cambian) y
 * no toca los elementos sin `role` ni los bloqueados. Los colores de serie de un gráfico que el usuario
 * eligió a mano se conservan: solo se sustituyen los automáticos (null) y los acentos del tema anterior.
 * Expone window.XiroSlideCanvasTheme y module.exports.
 */
(function (root) {
    'use strict';

    const ROLES = ['title', 'subtitle', 'body', 'caption', 'accent', 'image', 'table', 'chart'];
    const ROLE_TYPES = {
        title: ['text'],
        subtitle: ['text'],
        body: ['text'],
        caption: ['text'],
        accent: ['shape'],
        image: ['image'],
        table: ['table'],
        chart: ['chart']
    };
    const LAYOUTS = ['cover', 'title-content', 'two-columns', 'image-text', 'section', 'blank'];
    const ACCENTS = 6;
    const MAX_NAME = 40;
    const ID_RE = /^[a-z0-9_-]{2,40}$/;
    const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
    const MIN_TEXT_CONTRAST = 4.5;
    const MIN_ACCENT_CONTRAST = 3;

    // Catálogo de serie en su propio fichero (slide-canvas-theme-catalog.js), cargado antes que este
    const THEMES = (typeof module !== 'undefined' && module.exports
        ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
          require('./slide-canvas-theme-catalog')
        : root.XiroSlideCanvasThemeCatalog
    ).THEMES;

    /** Módulo hermano: require en Node/Jest, global en el navegador (se busca al usarlo). */
    function model() {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require('./slide-canvas-model')
            : root.XiroSlideCanvas;
    }

    function isObj(v) {
        return !!v && typeof v === 'object' && !Array.isArray(v);
    }

    function isColor(v) {
        return typeof v === 'string' && COLOR_RE.test(v);
    }

    function fontKey(v) {
        return typeof v === 'string' && Object.prototype.hasOwnProperty.call(model().FONTS, v) ? v : 'sans';
    }

    /** Rol válido para el tipo del elemento, o null. */
    function normalizeRole(role, type) {
        if (typeof role !== 'string' || !Object.prototype.hasOwnProperty.call(ROLE_TYPES, role)) return null;
        return ROLE_TYPES[role].indexOf(type) >= 0 ? role : null;
    }

    /** Patrón maestro válido, o null. */
    function normalizeLayout(layout) {
        return typeof layout === 'string' && LAYOUTS.indexOf(layout) >= 0 ? layout : null;
    }

    function normalizePalette(raw) {
        if (!isObj(raw) || !isColor(raw.bg) || !isColor(raw.text) || !isColor(raw.muted)) return null;
        const accents = Array.isArray(raw.accents) ? raw.accents : [];
        if (accents.length !== ACCENTS || !accents.every(isColor)) return null;
        return { bg: raw.bg, text: raw.text, muted: raw.muted, accents: accents.slice() };
    }

    function normalizeGradient(raw) {
        if (!isObj(raw) || !isColor(raw.to) || typeof raw.angle !== 'number' || !isFinite(raw.angle)) return null;
        return { to: raw.to, angle: Math.min(359, Math.max(0, Math.round(raw.angle))) };
    }

    /**
     * Tema válido (colores #rrggbb, 6 acentos, fuentes del lienzo) o null si no se puede aprovechar.
     * @param {Object} raw - Tema de entrada.
     * @returns {Object|null}
     */
    function normalizeTheme(raw) {
        if (!isObj(raw) || typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return null;
        const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_NAME) : '';
        const palette = normalizePalette(raw.palette);
        if (!name || !palette) return null;
        const fonts = isObj(raw.fonts) ? raw.fonts : {};
        const out = { id: raw.id, name: name, palette: palette, fonts: { title: fontKey(fonts.title), body: fontKey(fonts.body) } };
        const gradient = normalizeGradient(raw.gradient);
        if (gradient) out.gradient = gradient;
        return out;
    }

    /** Tema del catálogo por id; el primero si no existe. */
    function getTheme(id) {
        for (let i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
        return THEMES[0];
    }

    /** Módulo hermano de legibilidad: require en Node/Jest, global en el navegador (se carga antes que este). */
    function legibility() {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require('./slide-canvas-theme-legibility')
            : root.XiroSlideCanvasThemeLegibility;
    }

    /** Relación de contraste WCAG entre dos colores, con 2 decimales. */
    function contrast(a, b) {
        return legibility().contrast(a, b);
    }

    /**
     * Avisos de contraste de un tema: el texto y el apagado deben dar 4.5:1 sobre el fondo y cada acento 3:1.
     * @param {Object} t - Tema.
     * @returns {Array<{code: string, ratio: number, index?: number}>}
     */
    function contrastWarnings(t) {
        const p = t.palette;
        const out = [];
        const textRatio = contrast(p.text, p.bg);
        if (textRatio < MIN_TEXT_CONTRAST) out.push({ code: 'text', ratio: textRatio });
        const mutedRatio = contrast(p.muted, p.bg);
        if (mutedRatio < MIN_TEXT_CONTRAST) out.push({ code: 'muted', ratio: mutedRatio });
        p.accents.forEach(function (accent, i) {
            const ratio = contrast(accent, p.bg);
            if (ratio < MIN_ACCENT_CONTRAST) out.push({ code: 'accent', index: i, ratio: ratio });
        });
        return out;
    }

    function backgroundOf(current, t) {
        const out = { color: t.palette.bg, image: current && current.image ? current.image : null };
        if (t.gradient) out.gradient = { to: t.gradient.to, angle: t.gradient.angle };
        return out;
    }

    /** Colores de serie: se renuevan los automáticos y los acentos del tema anterior; el resto se conserva. */
    function chartColors(current, t, prev) {
        const old = Array.isArray(current) ? current : [];
        const prevAccents = prev ? prev.palette.accents : [];
        return t.palette.accents
            .map(function (accent, i) {
                return old[i] && old[i] !== prevAccents[i] ? old[i] : accent;
            })
            .concat(old.slice(ACCENTS));
    }

    function restyleText(props, font, color) {
        props.font = font;
        props.color = color;
    }

    /** Copia del elemento con los valores del tema según su rol. */
    function restyle(el, t, prev) {
        const p = t.palette;
        const props = JSON.parse(JSON.stringify(el.props));
        if (el.role === 'title') restyleText(props, t.fonts.title, p.text);
        else if (el.role === 'subtitle' || el.role === 'caption') restyleText(props, t.fonts.body, p.muted);
        else if (el.role === 'body') restyleText(props, t.fonts.body, p.text);
        else if (el.role === 'accent') props[props.shape === 'line' || props.shape === 'arrow' ? 'stroke' : 'fill'] = p.accents[0];
        else if (el.role === 'table') {
            restyleText(props, t.fonts.body, p.text);
            props.headerFill = p.accents[0];
            props.borderColor = p.muted;
        } else if (el.role === 'chart') {
            restyleText(props, t.fonts.body, p.text);
            props.seriesColors = chartColors(props.seriesColors, t, prev);
        }
        const out = JSON.parse(JSON.stringify(el));
        out.props = props;
        return out;
    }

    /**
     * Lienzo con el tema aplicado (copia; no modifica el original).
     * @param {Object} canvas - Lienzo normalizado.
     * @param {Object} t - Tema a aplicar.
     * @param {Object} [prev] - Tema anterior del juego, para distinguir los colores de serie elegidos a mano.
     * @returns {Object}
     */
    function applyTheme(canvas, t, prev) {
        const out = JSON.parse(JSON.stringify(canvas));
        out.background = backgroundOf(out.background, t);
        out.elements = out.elements.map(function (el) {
            return el.role && !el.locked ? restyle(el, t, prev) : el;
        });
        // Lo que no tiene rol conserva su aspecto, pero no puede quedar ilegible sobre el fondo nuevo
        return legibility().fixLegibility(out, t);
    }

    const api = {
        ROLES: ROLES,
        ROLE_TYPES: ROLE_TYPES,
        LAYOUTS: LAYOUTS,
        THEMES: THEMES,
        getTheme: getTheme,
        normalizeTheme: normalizeTheme,
        normalizeRole: normalizeRole,
        normalizeLayout: normalizeLayout,
        contrast: contrast,
        contrastWarnings: contrastWarnings,
        applyTheme: applyTheme
    };

    root.XiroSlideCanvasTheme = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
