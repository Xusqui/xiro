/**
 * @fileoverview Catálogo de formas predefinidas de la diapositiva libre. Cada forma es un
 * trazado (shape 'path') en un viewBox de 100x100, no un tipo nuevo: añadir una forma cuesta
 * una línea de datos, y la importación de .pptx y .key (fases H e I) reutiliza el mismo tipo.
 * El nombre es una clave admin.canvas.preset.* del editor.
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasPathPresets y module.exports.
 */
(function (root) {
    'use strict';

    const PRESETS = [
        ['triangle', 'M50 0 L100 100 L0 100 Z'],
        ['right_triangle', 'M0 0 L100 100 L0 100 Z'],
        ['diamond', 'M50 0 L100 50 L50 100 L0 50 Z'],
        ['parallelogram', 'M25 0 L100 0 L75 100 L0 100 Z'],
        ['trapezoid', 'M20 0 L80 0 L100 100 L0 100 Z'],
        ['pentagon', 'M50 0 L100 38 L81 100 L19 100 L0 38 Z'],
        ['hexagon', 'M25 0 L75 0 L100 50 L75 100 L25 100 L0 50 Z'],
        ['octagon', 'M30 0 L70 0 L100 30 L100 70 L70 100 L30 100 L0 70 L0 30 Z'],
        [
            'star',
            'M50 0 L61.8 34.5 L97.6 34.5 L68.8 55.9 L79.4 90.5 L50 69.1 L20.6 90.5 L31.2 55.9 L2.4 34.5 L38.2 34.5 Z'
        ],
        ['plus', 'M35 0 L65 0 L65 35 L100 35 L100 65 L65 65 L65 100 L35 100 L35 65 L0 65 L0 35 L35 35 Z'],
        ['chevron', 'M0 0 L75 0 L100 50 L75 100 L0 100 L25 50 Z'],
        ['block_arrow', 'M0 30 L60 30 L60 0 L100 50 L60 100 L60 70 L0 70 Z'],
        ['curved_arrow', 'M10 100 C10 50 40 25 70 25 L70 0 L100 37.5 L70 75 L70 50 C50 50 35 70 35 100 Z'],
        [
            'heart',
            'M50 95 C20 72 0 55 0 31 C0 14 13 2 29 2 C39 2 46 8 50 16 C54 8 61 2 71 2 C87 2 100 14 100 31 C100 55 80 72 50 95 Z'
        ],
        [
            'speech',
            'M10 0 L90 0 C95.5 0 100 4.5 100 10 L100 62 C100 67.5 95.5 72 90 72 L45 72 L22 98 L27 72 L10 72 C4.5 72 0 67.5 0 62 L0 10 C0 4.5 4.5 0 10 0 Z'
        ],
        [
            'cloud',
            'M25 88 C11 88 0 77 0 64 C0 52 9 42 21 41 C22 24 35 12 51 12 C64 12 75 20 79 32 C91 33 100 44 100 58 C100 75 88 88 72 88 Z'
        ]
    ];

    const api = {
        VIEWBOX: [100, 100],
        /** @returns {Array<{name:string,d:string}>} Las formas en el orden del menú. */
        list: function () {
            return PRESETS.map(function (p) {
                return { name: p[0], d: p[1] };
            });
        },
        /** @returns {string|null} Trazado de la forma, o null si no existe. */
        get: function (name) {
            for (let i = 0; i < PRESETS.length; i++) if (PRESETS[i][0] === name) return PRESETS[i][1];
            return null;
        }
    };

    root.XiroSlideCanvasPathPresets = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
