/**
 * @fileoverview Campos del panel de propiedades para los cuadros de texto de la
 * diapositiva libre (slides-canvas-props-fields.js los pinta y los lee). Etiquetas, títulos y
 * opciones son claves admin.canvas.* (slides-canvas-i18n.js); se traducen al pintar.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});
    XiroCanvasEditor.propsByType = XiroCanvasEditor.propsByType || {};

    /** Fuentes que ofrece el editor (claves de XiroSlideCanvas.FONTS); también las usa la barra de formato. */
    XiroCanvasEditor.FONT_OPTIONS = ['sans', 'rounded', 'condensed', 'display', 'serif', 'elegant', 'hand', 'mono'].map(
        font => [font, 'font.' + font]
    );

    // Iconos de los botones de alineación (el panel los pinta en lugar de un desplegable)
    function FA(name) {
        return '<i class="fas ' + name + '" aria-hidden="true"></i>';
    }

    /** Línea de referencia en y y una caja de 7 px en boxY: alineación vertical, trazo sin relleno. */
    function VALIGN_ICON(lineY, boxY) {
        return (
            '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 ' +
            lineY +
            'h12"/><rect x="4.5" y="' +
            boxY +
            '" width="7" height="7" rx="1.2"/></svg>'
        );
    }

    XiroCanvasEditor.propsByType.text = {
        title: 'type.text',
        fields: [
            { key: 'text', label: 'field.text', kind: 'textarea' },
            { key: 'font', label: 'field.font', kind: 'select', options: XiroCanvasEditor.FONT_OPTIONS },
            { key: 'size', label: 'field.size', kind: 'number', min: 8, max: 400 },
            { key: 'bold', label: 'field.bold', kind: 'check' },
            { key: 'italic', label: 'field.italic', kind: 'check' },
            { key: 'color', label: 'field.color', kind: 'color' },
            {
                key: 'align',
                label: 'field.align',
                kind: 'segment',
                options: [
                    ['left', 'align.left', FA('fa-align-left')],
                    ['center', 'align.center', FA('fa-align-center')],
                    ['right', 'align.right', FA('fa-align-right')]
                ]
            },
            {
                key: 'valign',
                label: 'field.valign',
                kind: 'segment',
                options: [
                    ['top', 'valign.top', VALIGN_ICON(2, 4)],
                    ['middle', 'valign.middle', VALIGN_ICON(8, 4.5)],
                    ['bottom', 'valign.bottom', VALIGN_ICON(14, 5)]
                ]
            },
            { key: 'fill', label: 'field.box_fill', kind: 'color', noneLabel: 'none.box_fill' },
            {
                key: 'fit',
                label: 'field.fit',
                kind: 'select',
                options: [
                    ['shrink', 'fit.shrink'],
                    ['wrap', 'fit.wrap']
                ]
            }
        ]
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.propsByType.text;
})();
