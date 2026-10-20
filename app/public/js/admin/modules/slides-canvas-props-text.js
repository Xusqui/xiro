/**
 * @fileoverview Campos del panel de propiedades para los cuadros de texto de la
 * diapositiva libre (slides-canvas-props-fields.js los pinta y los lee).
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};
    XiroCanvasEditor.propsByType = XiroCanvasEditor.propsByType || {};

    /** Fuentes que ofrece el editor (claves de XiroSlideCanvas.FONTS); también las usa la barra de formato. */
    XiroCanvasEditor.FONT_OPTIONS = [
        ['sans', 'DM Sans'], ['rounded', 'Nunito (redondeada)'], ['condensed', 'Oswald (estrecha)'],
        ['display', 'Bebas Neue (titular)'], ['serif', 'Merriweather (serif)'], ['elegant', 'Playfair Display (elegante)'],
        ['hand', 'Caveat (a mano)'], ['mono', 'JetBrains Mono (monoespaciada)']
    ];

    XiroCanvasEditor.propsByType.text = {
        title: 'Texto',
        fields: [
            { key: 'text', label: 'Texto', kind: 'textarea' },
            { key: 'font', label: 'Fuente', kind: 'select', options: XiroCanvasEditor.FONT_OPTIONS },
            { key: 'size', label: 'Tamaño', kind: 'number', min: 8, max: 400 },
            { key: 'bold', label: 'Negrita', kind: 'check' },
            { key: 'italic', label: 'Cursiva', kind: 'check' },
            { key: 'color', label: 'Color del texto', kind: 'color' },
            { key: 'align', label: 'Alineación', kind: 'select', options: [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']] },
            { key: 'valign', label: 'Alineación vertical', kind: 'select', options: [['top', 'Arriba'], ['middle', 'Centro'], ['bottom', 'Abajo']] },
            { key: 'fill', label: 'Fondo del cuadro', kind: 'color', noneLabel: 'Sin fondo' },
            { key: 'fit', label: 'Si no cabe', kind: 'select', options: [['shrink', 'Reducir la letra'], ['wrap', 'Mantener el tamaño']] }
        ]
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.propsByType.text;
})();
