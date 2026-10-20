/**
 * @fileoverview Campos del panel de propiedades para figuras, imágenes y vídeos de la
 * diapositiva libre (slides-canvas-props-fields.js los pinta y los lee). Etiquetas, títulos y
 * opciones son claves admin.canvas.* (slides-canvas-i18n.js); se traducen al pintar.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});
    XiroCanvasEditor.propsByType = XiroCanvasEditor.propsByType || {};

    const isClosed = el => el.props.shape === 'rect' || el.props.shape === 'ellipse';

    XiroCanvasEditor.propsByType.shape = {
        title: 'type.shape',
        fields: [
            { key: 'fill', label: 'field.fill', kind: 'color', noneLabel: 'none.fill', when: isClosed },
            { key: 'stroke', label: 'field.stroke', kind: 'color', noneLabel: 'none.stroke' },
            { key: 'strokeWidth', label: 'field.stroke_width', kind: 'number', min: 0, max: 60 },
            {
                key: 'radius',
                label: 'field.radius',
                kind: 'number',
                min: 0,
                max: 540,
                when: el => el.props.shape === 'rect'
            }
        ]
    };

    XiroCanvasEditor.propsByType.image = {
        title: 'type.image',
        fields: [
            { label: 'field.change_image', kind: 'action', action: 'change-image', icon: 'fa-image' },
            { key: 'lockRatio', label: 'field.lock_ratio', kind: 'check' },
            {
                key: 'fit',
                label: 'field.image_fit',
                kind: 'select',
                options: [
                    ['contain', 'image_fit.contain'],
                    ['cover', 'image_fit.cover']
                ]
            },
            { key: 'radius', label: 'field.radius', kind: 'number', min: 0, max: 540 }
        ]
    };

    XiroCanvasEditor.propsByType.video = {
        title: 'type.video',
        fields: [
            { label: 'field.change_video', kind: 'action', action: 'change-video', icon: 'fa-film' },
            { key: 'autoplay', label: 'field.autoplay', kind: 'check' }
        ]
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.propsByType;
})();
