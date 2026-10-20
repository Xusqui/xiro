/**
 * @fileoverview Modelo de la diapositiva libre (slide_type 'canvas') de los juegos
 * personalizados: un lienzo lógico de 1920x1080 con elementos posicionados.
 *
 * El orden del array `elements` es el orden de apilamiento (el índice 0 queda al fondo).
 * Lo comparten el servidor (validación, sanitizado), el editor del admin, el presentador,
 * el jugador, standalone, tv.html y el PDF.
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 * Expone window.XiroSlideCanvas y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    const WIDTH = 1920;
    const HEIGHT = 1080;
    const MIN_SIZE = 20;
    const MAX_URL = 2048;
    const MAX_TEXT = 2000;
    const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
    const ID_RE = /^el_[a-z0-9]{4,16}$/;
    // Familias de Google Fonts que carga css/slide-canvas.css en todas las pantallas
    const FONTS = {
        sans: '\'DM Sans\', system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif',
        serif: '\'Merriweather\', Georgia, \'Times New Roman\', serif',
        display: '\'Bebas Neue\', Impact, \'Arial Narrow\', sans-serif',
        mono: '\'JetBrains Mono\', ui-monospace, Menlo, Consolas, \'Courier New\', monospace',
        rounded: '\'Nunito\', \'Arial Rounded MT Bold\', Arial, sans-serif',
        condensed: '\'Oswald\', \'Arial Narrow\', Arial, sans-serif',
        elegant: '\'Playfair Display\', Georgia, serif',
        hand: '\'Caveat\', \'Comic Sans MS\', cursive'
    };
    const ELEMENT_TYPES = ['text', 'shape', 'image', 'video'];
    const SHAPES = ['rect', 'ellipse', 'line', 'arrow'];
    const DEFAULT_BACKGROUND = '#1e1b2e';
    // Tamaño por defecto de cada clase de elemento (las figuras según su forma)
    const DEFAULT_SIZE = {
        text: [1200, 200], rect: [480, 300], ellipse: [400, 400], line: [600, 40],
        arrow: [600, 40], image: [800, 450], video: [1280, 720]
    };

    function isColor(v) {
        return typeof v === 'string' && COLOR_RE.test(v);
    }

    /** URL de imagen permitida: /uploads/ (sin '..') o http(s), sin espacios ni comillas. */
    function isSafeMediaUrl(v) {
        if (typeof v !== 'string' || !v || v.length > MAX_URL || /[\s"'<>`]/.test(v)) return false;
        if (v.indexOf('/uploads/') === 0) return v.indexOf('..') < 0;
        return /^https?:\/\//i.test(v);
    }

    /** Entero acotado; si no es un número finito, el valor por defecto. */
    function num(v, min, max, fallback) {
        if (typeof v !== 'number' || !isFinite(v)) return fallback;
        return Math.min(max, Math.max(min, Math.round(v)));
    }

    function pick(v, allowed, fallback) {
        return allowed.indexOf(v) >= 0 ? v : fallback;
    }

    function bool(v, fallback) {
        return typeof v === 'boolean' ? v : fallback;
    }

    /** Color válido; null se conserva solo si el campo admite "sin color". */
    function color(v, fallback, allowNull) {
        if (allowNull && v === null) return null;
        return isColor(v) ? v : fallback;
    }

    function newId(existingIds) {
        const taken = existingIds || [];
        let id;
        do {
            id = 'el_';
            for (let i = 0; i < 8; i++) id += Math.floor(Math.random() * 36).toString(36);
        } while (taken.indexOf(id) >= 0);
        return id;
    }

    function textProps(p) {
        return {
            text: String(p.text === undefined || p.text === null ? '' : p.text).replace(/\r\n?/g, '\n').slice(0, MAX_TEXT),
            font: Object.prototype.hasOwnProperty.call(FONTS, p.font) ? p.font : 'sans',
            size: num(p.size, 8, 400, 64),
            bold: bool(p.bold, false),
            italic: bool(p.italic, false),
            color: color(p.color, '#ffffff', false),
            align: pick(p.align, ['left', 'center', 'right'], 'left'),
            valign: pick(p.valign, ['top', 'middle', 'bottom'], 'top'),
            fill: color(p.fill === undefined ? null : p.fill, null, true),
            fit: pick(p.fit, ['wrap', 'shrink'], 'shrink')
        };
    }

    function shapeProps(p) {
        const shape = pick(p.shape, SHAPES, 'rect');
        const closed = shape === 'rect' || shape === 'ellipse';
        return {
            shape: shape,
            fill: color(p.fill === undefined ? (closed ? '#7c3aed' : null) : p.fill, closed ? '#7c3aed' : null, true),
            stroke: color(p.stroke === undefined ? '#ffffff' : p.stroke, '#ffffff', true),
            strokeWidth: num(p.strokeWidth, 0, 60, closed ? 6 : 8),
            radius: num(p.radius, 0, 540, 0)
        };
    }

    function ratioOf(v) {
        return typeof v === 'number' && isFinite(v) && v >= 0.05 && v <= 20 ? v : null;
    }

    /** Props normalizadas por tipo, o null si falta el recurso obligatorio. */
    function propsFor(type, p) {
        if (type === 'text') return textProps(p);
        if (type === 'shape') return shapeProps(p);
        if (type === 'image') {
            if (!isSafeMediaUrl(p.src)) return null;
            return {
                src: p.src, ratio: ratioOf(p.ratio), lockRatio: bool(p.lockRatio, true),
                fit: pick(p.fit, ['contain', 'cover'], 'contain'), radius: num(p.radius, 0, 540, 0)
            };
        }
        if (typeof p.url !== 'string' || !p.url.trim() || p.url.length > MAX_URL) return null;
        return { url: p.url.trim(), autoplay: bool(p.autoplay, false) };
    }

    /** Elemento válido (coerciona y acota), o null si no se puede representar. */
    function normalizeElement(raw) {
        if (!raw || typeof raw !== 'object' || ELEMENT_TYPES.indexOf(raw.type) < 0) return null;
        const props = propsFor(raw.type, raw.props && typeof raw.props === 'object' ? raw.props : {});
        if (!props) return null;
        return {
            id: typeof raw.id === 'string' && ID_RE.test(raw.id) ? raw.id : newId(),
            type: raw.type,
            x: num(raw.x, -WIDTH, WIDTH * 2, 0),
            y: num(raw.y, -HEIGHT, HEIGHT * 2, 0),
            w: num(raw.w, MIN_SIZE, WIDTH * 2, MIN_SIZE),
            h: num(raw.h, MIN_SIZE, HEIGHT * 2, MIN_SIZE),
            rotation: num(raw.rotation, -180, 180, 0),
            props: props
        };
    }

    /** Elemento nuevo centrado con el tamaño por defecto de su clase. */
    function createElement(type, overrides) {
        const o = overrides || {};
        const props = {};
        const src = o.props || {};
        for (const key in src) {
            if (Object.prototype.hasOwnProperty.call(src, key)) props[key] = src[key];
        }
        const size = DEFAULT_SIZE[type === 'shape' ? pick(props.shape, SHAPES, 'rect') : type];
        if (!size) return null;
        const ratio = type === 'image' ? ratioOf(props.ratio) : null;
        const w = typeof o.w === 'number' ? o.w : size[0];
        const h = typeof o.h === 'number' ? o.h : (ratio ? Math.round(w / ratio) : size[1]);
        return normalizeElement({
            id: newId(o.existingIds),
            type: type,
            x: typeof o.x === 'number' ? o.x : Math.round((WIDTH - w) / 2),
            y: typeof o.y === 'number' ? o.y : Math.round((HEIGHT - h) / 2),
            w: w,
            h: h,
            rotation: o.rotation,
            props: props
        });
    }

    function createCanvas() {
        return { version: 1, background: { color: DEFAULT_BACKGROUND, image: null }, elements: [] };
    }

    /** Lienzo válido o null; descarta elementos inválidos y reasigna ids repetidos. */
    function normalizeCanvas(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const bg = raw.background && typeof raw.background === 'object' ? raw.background : {};
        const canvas = createCanvas();
        canvas.background.color = color(bg.color, DEFAULT_BACKGROUND, false);
        canvas.background.image = isSafeMediaUrl(bg.image) ? bg.image : null;
        const list = Array.isArray(raw.elements) ? raw.elements : [];
        const ids = [];
        for (let i = 0; i < list.length && canvas.elements.length < api.MAX_ELEMENTS; i++) {
            const el = normalizeElement(list[i]);
            if (!el) continue;
            if (ids.indexOf(el.id) >= 0) el.id = newId(ids);
            ids.push(el.id);
            canvas.elements.push(el);
        }
        return canvas;
    }

    function pushUnique(list, value) {
        if (list.indexOf(value) < 0) list.push(value);
    }

    /** Imágenes (incluido el fondo) y vídeos que usa el lienzo, sin repetir. */
    function collectMediaRefs(canvas) {
        const refs = { images: [], videos: [] };
        if (!canvas || typeof canvas !== 'object') return refs;
        if (canvas.background && isSafeMediaUrl(canvas.background.image)) pushUnique(refs.images, canvas.background.image);
        const list = Array.isArray(canvas.elements) ? canvas.elements : [];
        for (let i = 0; i < list.length; i++) {
            const el = list[i];
            const p = el && el.props ? el.props : {};
            if (el && el.type === 'image' && isSafeMediaUrl(p.src)) pushUnique(refs.images, p.src);
            if (el && el.type === 'video' && typeof p.url === 'string' && p.url) pushUnique(refs.videos, p.url);
        }
        return refs;
    }

    /** Conversión sin pérdida de las diapositivas antiguas (slide-canvas-legacy.js). */
    function fromLegacySlide(slide) {
        const legacy = typeof module !== 'undefined' && module.exports
            // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
            ? require('./slide-canvas-legacy')
            : root.XiroSlideCanvasLegacy;
        return legacy ? legacy.fromLegacySlide(slide) : null;
    }

    function isCanvasSlide(q) {
        return !!(q && q.slide_type === 'canvas');
    }

    const api = {
        WIDTH: WIDTH, HEIGHT: HEIGHT, VERSION: 1, MAX_ELEMENTS: 50, MAX_TEXT: MAX_TEXT,
        MAX_JSON_BYTES: 65536, MIN_SIZE: MIN_SIZE, MAX_URL: MAX_URL, TEXT_PADDING: 16,
        FONTS: FONTS, ELEMENT_TYPES: ELEMENT_TYPES, SHAPES: SHAPES, DEFAULT_BACKGROUND: DEFAULT_BACKGROUND,
        isColor: isColor, isSafeMediaUrl: isSafeMediaUrl, newId: newId,
        createCanvas: createCanvas, createElement: createElement, normalizeElement: normalizeElement,
        normalizeCanvas: normalizeCanvas, collectMediaRefs: collectMediaRefs,
        fromLegacySlide: fromLegacySlide, isCanvasSlide: isCanvasSlide
    };

    root.XiroSlideCanvas = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
