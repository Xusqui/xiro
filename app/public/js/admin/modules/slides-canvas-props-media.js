/**
 * @fileoverview Campos del panel de propiedades para figuras, imágenes y vídeos de la
 * diapositiva libre (slides-canvas-props-fields.js los pinta y los lee).
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};
    XiroCanvasEditor.propsByType = XiroCanvasEditor.propsByType || {};

    const isClosed = (el) => el.props.shape === 'rect' || el.props.shape === 'ellipse';

    XiroCanvasEditor.propsByType.shape = {
        title: 'Figura',
        fields: [
            { key: 'fill', label: 'Relleno', kind: 'color', noneLabel: 'Sin relleno', when: isClosed },
            { key: 'stroke', label: 'Contorno', kind: 'color', noneLabel: 'Sin contorno' },
            { key: 'strokeWidth', label: 'Grosor', kind: 'number', min: 0, max: 60 },
            { key: 'radius', label: 'Esquinas redondeadas', kind: 'number', min: 0, max: 540, when: (el) => el.props.shape === 'rect' }
        ]
    };

    XiroCanvasEditor.propsByType.image = {
        title: 'Imagen',
        fields: [
            { label: 'Cambiar imagen', kind: 'action', action: 'change-image' },
            { key: 'lockRatio', label: 'Mantener la proporción', kind: 'check' },
            { key: 'fit', label: 'Encaje', kind: 'select', options: [['contain', 'Completa (sin recortar)'], ['cover', 'Rellenar (recortando)']] },
            { key: 'radius', label: 'Esquinas redondeadas', kind: 'number', min: 0, max: 540 }
        ]
    };

    XiroCanvasEditor.propsByType.video = {
        title: 'Vídeo',
        fields: [
            { label: 'Cambiar vídeo', kind: 'action', action: 'change-video' },
            { key: 'autoplay', label: 'Reproducir al mostrar la diapositiva', kind: 'check' }
        ]
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.propsByType;
})();
