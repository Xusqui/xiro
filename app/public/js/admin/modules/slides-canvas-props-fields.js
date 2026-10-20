/**
 * @fileoverview Campos del panel de propiedades del editor de diapositivas libres.
 * Cada tipo de elemento declara sus campos (slides-canvas-props-text.js / -media.js) y aquí
 * se pintan y se leen con su tipo real (números, booleanos, colores o null), para que el
 * modelo (core/slide-canvas-model.js) no los descarte por llegar como texto.
 *
 * Etiquetas, opciones y noneLabel son claves admin.canvas.* que se traducen aquí al pintar.
 *
 * Descriptor: { key, label, kind: number|color|select|check|textarea|action, min, max,
 *               options: [[valor, etiqueta]], noneLabel (color que admite «sin color»),
 *               action (botón), icon, quiet (acción discreta), when(el) }
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    // Clases de admin-slide-canvas-panel.css
    const INPUT = 'xsce-input';
    const LABEL = 'xsce-label';

    function esc(value) {
        return root.XiroSlideCanvasRender.escapeText(value);
    }

    /** Texto traducido y escapado de una clave admin.canvas.* */
    function tx(key) {
        return XiroCanvasEditor.th(key);
    }

    /** input type=color solo admite #rrggbb: se quita el canal alfa al mostrarlo. */
    function colorValue(value, fallback) {
        return typeof value === 'string' && value.length >= 7 ? value.slice(0, 7) : fallback;
    }

    function fieldId(field) {
        return 'xsce-f-' + field.key;
    }

    /** Muestra de color con su código al lado (o «Sin …» cuando el campo admite no tener color). */
    function colorControl(field, value, attr) {
        const none = value === null;
        let html =
            '<div class="xsce-color' +
            (none ? ' is-none' : '') +
            '">' +
            '<input type="color" class="xsce-swatch" id="' +
            fieldId(field) +
            '" ' +
            attr +
            ' value="' +
            colorValue(value, '#000000') +
            '"' +
            (none ? ' disabled' : '') +
            '>' +
            '<span class="xsce-color-hex">' +
            (none ? tx(field.noneLabel) : colorValue(value, '#000000')) +
            '</span></div>';
        if (field.noneLabel) {
            html +=
                '<label class="xsce-check xsce-check--sub"><input type="checkbox" data-canvas-none="' +
                field.key +
                '"' +
                (none ? ' checked' : '') +
                '> ' +
                tx(field.noneLabel) +
                '</label>';
        }
        return html;
    }

    function control(field, value) {
        const attr = 'data-canvas-prop="' + field.key + '" data-kind="' + field.kind + '"';
        const id = ' id="' + fieldId(field) + '"';
        if (field.kind === 'number') {
            return (
                '<input type="number" class="' +
                INPUT +
                '"' +
                id +
                ' ' +
                attr +
                ' value="' +
                esc(value) +
                '" min="' +
                field.min +
                '" max="' +
                field.max +
                '" step="1">'
            );
        }
        if (field.kind === 'textarea') {
            return '<textarea class="' + INPUT + '"' + id + ' rows="4" ' + attr + '>' + esc(value) + '</textarea>';
        }
        if (field.kind === 'select') {
            return (
                '<select class="' +
                INPUT +
                '"' +
                id +
                ' ' +
                attr +
                '>' +
                field.options
                    .map(
                        o =>
                            '<option value="' +
                            esc(o[0]) +
                            '"' +
                            (o[0] === value ? ' selected' : '') +
                            '>' +
                            tx(o[1]) +
                            '</option>'
                    )
                    .join('') +
                '</select>'
            );
        }
        if (field.kind === 'check') {
            return (
                '<label class="xsce-check"><input type="checkbox" ' +
                attr +
                (value ? ' checked' : '') +
                '> ' +
                tx(field.label) +
                '</label>'
            );
        }
        if (field.kind === 'action') {
            const icon = field.icon ? '<i class="fas ' + field.icon + '" aria-hidden="true"></i>' : '';
            return (
                '<button type="button" class="xsce-action' +
                (field.quiet ? ' xsce-action--quiet' : '') +
                '" data-canvas-panel-action="' +
                field.action +
                '">' +
                icon +
                tx(field.label) +
                '</button>'
            );
        }
        return colorControl(field, value, attr);
    }

    /** HTML de una lista de campos para el elemento (o el fondo) dado. */
    function fieldsHtml(fields, values, el) {
        return fields
            .filter(f => !f.when || f.when(el))
            .map(f => {
                const label =
                    f.kind === 'check' || f.kind === 'action'
                        ? ''
                        : '<label class="' + LABEL + '" for="' + fieldId(f) + '">' + tx(f.label) + '</label>';
                return '<div class="xsce-field">' + label + control(f, values[f.key]) + '</div>';
            })
            .join('');
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
