/**
 * @fileoverview Campos del panel de propiedades para los cuadros de texto de la
 * diapositiva libre (slides-canvas-props-fields.js los pinta y los lee). Etiquetas, títulos y
 * opciones son claves admin.canvas.* (slides-canvas-i18n.js); se traducen al pintar.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};
    XiroCanvasEditor.propsByType = XiroCanvasEditor.propsByType || {};

    /** Fuentes que ofrece el editor (claves de XiroSlideCanvas.FONTS); también las usa la barra de formato. */
    XiroCanvasEditor.FONT_OPTIONS = ['sans', 'rounded', 'condensed', 'display', 'serif', 'elegant', 'hand', 'mono']
        .map((font) => [font, 'font.' + font]);

    XiroCanvasEditor.propsByType.text = {
        title: 'type.text',
        fields: [
            { key: 'text', label: 'field.text', kind: 'textarea' },
            { key: 'font', label: 'field.font', kind: 'select', options: XiroCanvasEditor.FONT_OPTIONS },
            { key: 'size', label: 'field.size', kind: 'number', min: 8, max: 400 },
            { key: 'bold', label: 'field.bold', kind: 'check' },
            { key: 'italic', label: 'field.italic', kind: 'check' },
            { key: 'color', label: 'field.color', kind: 'color' },
            { key: 'align', label: 'field.align', kind: 'select', options: [['left', 'align.left'], ['center', 'align.center'], ['right', 'align.right']] },
            { key: 'valign', label: 'field.valign', kind: 'select', options: [['top', 'valign.top'], ['middle', 'valign.middle'], ['bottom', 'valign.bottom']] },
            { key: 'fill', label: 'field.box_fill', kind: 'color', noneLabel: 'none.box_fill' },
            { key: 'fit', label: 'field.fit', kind: 'select', options: [['shrink', 'fit.shrink'], ['wrap', 'fit.wrap']] }
        ]
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.propsByType.text;
})();
