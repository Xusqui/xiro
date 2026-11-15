/**
 * @fileoverview Patrones maestros de la diapositiva libre (fase F): seis diseños, cada uno con sus huecos por
 * `role`. createLayoutCanvas crea la diapositiva con el tema; applyLayout recoloca por rol los elementos que ya
 * hay (en orden, sin crear ni borrar) y no toca los que no tienen rol ni los bloqueados. La imagen no tiene
 * marcador posible (un elemento image exige un src real): su hueco queda libre.
 * Expone window.XiroSlideCanvasLayouts y module.exports.
 */
(function (root) {
    'use strict';

    // Coordenadas del lienzo lógico de 1920x1080; size, align y valign solo para los huecos de texto
    const SLOTS = {
        cover: [
            { role: 'title', x: 160, y: 340, w: 1600, h: 240, size: 120, align: 'center', valign: 'bottom' },
            { role: 'subtitle', x: 160, y: 600, w: 1600, h: 140, size: 48, align: 'center', valign: 'top' }
        ],
        'title-content': [
            { role: 'title', x: 80, y: 48, w: 1760, h: 140, size: 72, align: 'left', valign: 'middle' },
            { role: 'body', x: 80, y: 220, w: 1760, h: 780, size: 44, align: 'left', valign: 'top' }
        ],
        'two-columns': [
            { role: 'title', x: 80, y: 48, w: 1760, h: 140, size: 72, align: 'left', valign: 'middle' },
            { role: 'body', x: 80, y: 220, w: 860, h: 780, size: 44, align: 'left', valign: 'top' },
            { role: 'body', x: 980, y: 220, w: 860, h: 780, size: 44, align: 'left', valign: 'top' }
        ],
        'image-text': [
            { role: 'title', x: 80, y: 48, w: 1760, h: 140, size: 72, align: 'left', valign: 'middle' },
            { role: 'image', x: 80, y: 220, w: 860, h: 780 },
            { role: 'body', x: 980, y: 220, w: 860, h: 780, size: 44, align: 'left', valign: 'top' }
        ],
        section: [
            { role: 'title', x: 160, y: 380, w: 1600, h: 200, size: 104, align: 'center', valign: 'bottom' },
            { role: 'subtitle', x: 160, y: 600, w: 1600, h: 120, size: 44, align: 'center', valign: 'top' }
        ],
        blank: []
    };
    // Una tabla y un gráfico ocupan el hueco de cuerpo
    const CONTENT_ROLES = ['body', 'table', 'chart'];
    const SAMPLE_TEXTS = { title: 'Título', subtitle: 'Subtítulo', body: 'Texto' };

    /** Módulo hermano: require en Node/Jest, global en el navegador (se busca al usarlo). */
    function dep(file, globalName) {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require(file)
            : root[globalName];
    }

    function slotRole(role) {
        return CONTENT_ROLES.indexOf(role) >= 0 ? 'body' : role;
    }

    /** Caja más grande con la proporción de la imagen que cabe en el hueco, centrada en él. */
    function fitImage(slot, props) {
        const ratio = props && typeof props.ratio === 'number' && props.ratio > 0 ? props.ratio : slot.w / slot.h;
        const wide = ratio >= slot.w / slot.h;
        const w = wide ? slot.w : Math.round(slot.h * ratio);
        const h = wide ? Math.round(slot.w / ratio) : slot.h;
        return { x: slot.x + Math.round((slot.w - w) / 2), y: slot.y + Math.round((slot.h - h) / 2), w: w, h: h };
    }

    function place(el, slot) {
        const box = el.type === 'image' ? fitImage(slot, el.props) : slot;
        el.x = box.x;
        el.y = box.y;
        el.w = box.w;
        el.h = box.h;
        if (el.type === 'text' && slot.size) {
            el.props.size = slot.size;
            el.props.align = slot.align;
            el.props.valign = slot.valign;
        }
    }

    /**
     * Lienzo con el patrón aplicado (copia; no modifica el original). Con un nombre desconocido
     * devuelve una copia sin cambios.
     * @param {Object} canvas - Lienzo normalizado.
     * @param {string} name - Patrón de LAYOUTS.
     * @returns {Object}
     */
    function applyLayout(canvas, name) {
        const out = JSON.parse(JSON.stringify(canvas));
        const slots = SLOTS[name];
        if (!slots) return out;
        out.layout = name;
        const used = {};
        out.elements.forEach(function (el) {
            if (!el.role || el.locked) return;
            const role = slotRole(el.role);
            const matching = slots.filter(function (slot) {
                return slot.role === role;
            });
            const n = used[role] || 0;
            if (n >= matching.length) return;
            used[role] = n + 1;
            place(el, matching[n]);
        });
        return out;
    }

    function slotElement(slot, texts, ids) {
        const text = typeof texts[slot.role] === 'string' && texts[slot.role] ? texts[slot.role] : SAMPLE_TEXTS[slot.role];
        const el = dep('./slide-canvas-model', 'XiroSlideCanvas').createElement('text', {
            x: slot.x,
            y: slot.y,
            w: slot.w,
            h: slot.h,
            existingIds: ids,
            props: { text: text, size: slot.size, align: slot.align, valign: slot.valign }
        });
        el.role = slot.role;
        ids.push(el.id);
        return el;
    }

    /**
     * Diapositiva nueva con el patrón y el tema: un texto de ejemplo por hueco de texto.
     * @param {string} name - Patrón de LAYOUTS.
     * @param {Object} theme - Tema (slide-canvas-theme.js).
     * @param {Object} [texts] - Textos de ejemplo por rol (title, subtitle, body), si no los por defecto.
     * @returns {Object|null} Lienzo, o null si el patrón no existe.
     */
    function createLayoutCanvas(name, theme, texts) {
        const slots = SLOTS[name];
        if (!slots) return null;
        const ids = [];
        const elements = slots
            .filter(function (slot) {
                return slot.role !== 'image';
            })
            .map(function (slot) {
                return slotElement(slot, texts || {}, ids);
            });
        const canvas = { version: 1, layout: name, background: { color: theme.palette.bg, image: null }, elements: elements };
        return dep('./slide-canvas-theme', 'XiroSlideCanvasTheme').applyTheme(canvas, theme);
    }

    const api = {
        SLOTS: SLOTS,
        applyLayout: applyLayout,
        createLayoutCanvas: createLayoutCanvas
    };

    root.XiroSlideCanvasLayouts = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
