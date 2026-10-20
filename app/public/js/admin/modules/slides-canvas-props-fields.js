/**
 * @fileoverview Campos del panel de propiedades del editor de diapositivas libres.
 * Cada tipo de elemento declara sus campos (slides-canvas-props-text.js / -media.js) y aquí
 * se pintan y se leen con su tipo real (números, booleanos, colores o null), para que el
 * modelo (core/slide-canvas-model.js) no los descarte por llegar como texto.
 *
 * Descriptor: { key, label, kind: number|color|select|check|textarea|action, min, max,
 *               options: [[valor, etiqueta]], noneLabel (color que admite «sin color»),
 *               action (botón), when(el) }
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};

    const INPUT = 'w-full p-2 border-2 border-slate-200 rounded-lg text-sm focus:border-plum-500 outline-none';
    const LABEL = 'block text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-widest';

    function esc(value) {
        return root.XiroSlideCanvasRender.escapeText(value);
    }

    /** input type=color solo admite #rrggbb: se quita el canal alfa al mostrarlo. */
    function colorValue(value, fallback) {
        return typeof value === 'string' && value.length >= 7 ? value.slice(0, 7) : fallback;
    }

    function control(field, value) {
        const attr = 'data-canvas-prop="' + field.key + '" data-kind="' + field.kind + '"';
        if (field.kind === 'number') {
            return '<input type="number" class="' + INPUT + '" ' + attr + ' value="' + esc(value) + '" min="' + field.min + '" max="' + field.max + '" step="1">';
        }
        if (field.kind === 'textarea') {
            return '<textarea class="' + INPUT + '" rows="4" ' + attr + '>' + esc(value) + '</textarea>';
        }
        if (field.kind === 'select') {
            return '<select class="' + INPUT + '" ' + attr + '>' + field.options.map((o) => (
                '<option value="' + esc(o[0]) + '"' + (o[0] === value ? ' selected' : '') + '>' + esc(o[1]) + '</option>'
            )).join('') + '</select>';
        }
        if (field.kind === 'check') {
            return '<label class="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" ' + attr + (value ? ' checked' : '') + '> ' + esc(field.label) + '</label>';
        }
        if (field.kind === 'action') {
            return '<button type="button" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-bold transition" data-canvas-panel-action="' + field.action + '">' + esc(field.label) + '</button>';
        }
        let html = '<input type="color" class="w-full h-9 p-0 border-2 border-slate-200 rounded-lg" ' + attr + ' value="' + colorValue(value, '#000000') + '"' + (value === null ? ' disabled' : '') + '>';
        if (field.noneLabel) {
            html += '<label class="flex items-center gap-2 text-xs text-slate-500 mt-1"><input type="checkbox" data-canvas-none="' + field.key + '"' + (value === null ? ' checked' : '') + '> ' + esc(field.noneLabel) + '</label>';
        }
        return html;
    }

    /** HTML de una lista de campos para el elemento (o el fondo) dado. */
    function fieldsHtml(fields, values, el) {
        return fields.filter((f) => !f.when || f.when(el)).map((f) => {
            const label = f.kind === 'check' || f.kind === 'action' ? '' : '<label class="' + LABEL + '">' + esc(f.label) + '</label>';
            return '<div class="mb-3">' + label + control(f, values[f.key]) + '</div>';
        }).join('');
    }

    /** Valor con su tipo real a partir del control que ha cambiado (null si no es válido). */
    function readValue(input) {
        const kind = input.getAttribute('data-kind');
        if (kind === 'number') {
            const n = parseInt(input.value, 10);
            return Number.isFinite(n) ? n : null;
        }
        if (kind === 'check') return input.checked;
        return input.value;
    }

    XiroCanvasEditor.propsFields = { fieldsHtml, readValue, INPUT, LABEL };
    XiroCanvasEditor.propsByType = XiroCanvasEditor.propsByType || {};

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.propsFields;
})();
