/**
 * @fileoverview Campos de estilo (fase B) del panel de propiedades: opacidad y sombra de
 * cualquier elemento y degradado del fondo. Los campos muestran valores de editor (opacidad
 * en %, sombra como predefinida) y aquí se traducen al modelo (core/slide-canvas-style.js).
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const style = () => root.XiroSlideCanvasStyle;

    // Iconos de la sombra: una caja con su sombra según la predefinida
    const shadowIcon = (dx, dy, glow) =>
        '<svg viewBox="0 0 16 16" aria-hidden="true">' +
        (glow ? '<rect x="2" y="2" width="12" height="12" rx="3" stroke-dasharray="2 2"/>' : '') +
        (dx || dy
            ? '<rect x="' + (3 + dx) + '" y="' + (3 + dy) + '" width="9" height="9" rx="1.5" stroke-opacity="0.45"/>'
            : '') +
        '<rect x="3" y="3" width="9" height="9" rx="1.5"/></svg>';

    const ELEMENT_FIELDS = [
        { key: 'opacity', label: 'field.opacity', kind: 'number', min: 5, max: 100 },
        {
            key: 'shadow',
            label: 'field.shadow',
            kind: 'segment',
            options: [
                ['none', 'shadow.none', '<i class="fas fa-ban" aria-hidden="true"></i>'],
                ['soft', 'shadow.soft', shadowIcon(0, 2, false)],
                ['strong', 'shadow.strong', shadowIcon(2, 2, false)],
                ['glow', 'shadow.glow', shadowIcon(0, 0, true)]
            ]
        },
        // Ajustes de la sombra (solo con sombra): separación y dirección como en PowerPoint
        { key: 'shadowDistance', label: 'field.shadow_distance', kind: 'number', min: 0, max: 100, when: hasShadow },
        { key: 'shadowAngle', label: 'field.shadow_angle', kind: 'number', min: 0, max: 359, when: hasShadow },
        { key: 'shadowBlur', label: 'field.shadow_blur', kind: 'number', min: 0, max: 100, when: hasShadow },
        { key: 'shadowColor', label: 'field.shadow_color', kind: 'color', when: hasShadow },
        { key: 'shadowOpacity', label: 'field.shadow_opacity', kind: 'number', min: 0, max: 100, when: hasShadow }
    ];
    const SHADOW_KEYS = ['shadowDistance', 'shadowAngle', 'shadowBlur', 'shadowColor', 'shadowOpacity'];
    const RGB_RE = /^#[0-9a-fA-F]{6}$/;

    function hasShadow(el) {
        return !!el.shadow;
    }

    // + 0: Math.round(-0,4) da -0 y la sombra se compararía distinta de la misma con 0
    function round(n) {
        return Math.round(n) + 0;
    }

    /** Ajustes que muestra el panel para una sombra { x, y, blur, color #rrggbb[aa] }. */
    function shadowValues(shadow) {
        if (!shadow) return {};
        const alpha = shadow.color.length === 9 ? parseInt(shadow.color.slice(7), 16) : 255;
        const angle = round((Math.atan2(shadow.y, shadow.x) * 180) / Math.PI);
        return {
            shadowDistance: round(Math.hypot(shadow.x, shadow.y)),
            shadowAngle: (angle + 360) % 360,
            shadowBlur: shadow.blur,
            shadowColor: shadow.color.slice(0, 7),
            shadowOpacity: round(alpha / 2.55)
        };
    }

    /** Dos cifras hexadecimales del canal alfa para una opacidad en % (0–100). */
    function alphaHex(percent) {
        return ('0' + round((Math.min(100, Math.max(0, percent)) * 255) / 100).toString(16)).slice(-2);
    }

    /**
     * Sombra con un ajuste cambiado. Separación y dirección recalculan x e y; el resto no las toca
     * (así un cambio de color no mueve la sombra por redondeo).
     * @returns {Object|null} Sombra nueva, o null si el valor no es válido.
     */
    function shadowPatch(shadow, key, value) {
        const next = { x: shadow.x, y: shadow.y, blur: shadow.blur, color: shadow.color };
        const current = shadowValues(shadow);
        if (key === 'shadowDistance' || key === 'shadowAngle') {
            const distance = key === 'shadowDistance' ? value : current.shadowDistance;
            const rad = ((key === 'shadowAngle' ? value : current.shadowAngle) * Math.PI) / 180;
            next.x = round(distance * Math.cos(rad));
            next.y = round(distance * Math.sin(rad));
        } else if (key === 'shadowBlur') next.blur = value;
        // El color conserva el canal alfa tal cual (pasarlo por % lo redondearía)
        else if (key === 'shadowColor' && RGB_RE.test(value)) next.color = value + (shadow.color.slice(7, 9) || 'ff');
        else if (key === 'shadowOpacity') next.color = current.shadowColor + alphaHex(value);
        else return null;
        return next;
    }

    const BACKGROUND_FIELDS = [
        { key: 'gradientTo', label: 'field.gradient_to', kind: 'color', noneLabel: 'none.gradient' },
        {
            key: 'gradientAngle',
            label: 'field.gradient_angle',
            kind: 'number',
            min: 0,
            max: 359,
            when: bg => !!bg.gradient
        }
    ];

    /**
     * Valores que muestran los campos de estilo de un elemento.
     * @param {Object} el - Elemento del lienzo.
     * @returns {{opacity:number, shadow:string}}
     */
    function elementValues(el) {
        const opacity = typeof el.opacity === 'number' ? el.opacity : 1;
        return Object.assign(
            { opacity: Math.round(opacity * 100), shadow: style().shadowPresetOf(el.shadow) },
            shadowValues(el.shadow)
        );
    }

    /**
     * Parche de updateElement para un campo de estilo, o null si el campo no es de estilo.
     * @param {string} key - data-canvas-prop del control.
     * @param {*} value - Valor leído del control.
     * @param {Object} [el] - Elemento actual (para los ajustes de su sombra).
     * @returns {Object|null}
     */
    function elementPatch(key, value, el) {
        if (key === 'opacity') return { opacity: Math.min(100, Math.max(5, value)) / 100 };
        if (key === 'shadow') return { shadow: style().SHADOW_PRESETS[value] || null };
        if (SHADOW_KEYS.indexOf(key) < 0 || !el || !el.shadow) return null;
        const shadow = shadowPatch(el.shadow, key, value);
        // Valor no válido (color mal escrito): no cambia nada, pero tampoco llega a las props
        return { shadow: shadow || el.shadow };
    }

    /** Valores del fondo para los campos (color y su degradado). */
    function backgroundValues(bg) {
        const g = bg.gradient;
        return Object.assign({}, bg, { gradientTo: g ? g.to : null, gradientAngle: g ? g.angle : 180 });
    }

    /**
     * Parche de setBackground para un campo del fondo, o null si no es del fondo.
     * @param {string} key - data-canvas-prop del control.
     * @param {*} value - Valor leído (null: sin degradado).
     * @param {Object} bg - Fondo actual.
     * @returns {Object|null}
     */
    function backgroundPatch(key, value, bg) {
        const angle = bg.gradient ? bg.gradient.angle : 180;
        if (key === 'color') return { color: value };
        if (key === 'gradientTo') return { gradient: value ? { to: value, angle } : null };
        if (key === 'gradientAngle' && bg.gradient) return { gradient: { to: bg.gradient.to, angle: value } };
        return null;
    }

    E.propsStyle = {
        ELEMENT_FIELDS,
        BACKGROUND_FIELDS,
        elementValues,
        elementPatch,
        backgroundValues,
        backgroundPatch
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.propsStyle;
})();
