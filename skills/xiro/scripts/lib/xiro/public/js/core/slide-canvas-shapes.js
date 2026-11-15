/**
 * @fileoverview SVG de las figuras de la diapositiva libre: rectángulo, elipse, línea, flecha y
 * forma libre (trazado llevado a la caja del elemento con slide-canvas-path.js; overflow visible
 * para que el borde no se recorte en los bordes de la caja).
 * El trazo de rectángulo y elipse va hacia dentro (strokeWidth/2) para no recortarse; línea y
 * flecha cruzan la caja por su mitad, de izquierda a derecha (la punta, a la derecha).
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasShapes y module.exports.
 */
(function (root) {
    'use strict';

    // Local escape function for SVG content
    function escape(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function paths() {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require('./slide-canvas-path')
            : root.XiroSlideCanvasPath;
    }

    /**
     * Forma libre: el trazado escalado a la caja menos el grosor y desplazado medio grosor, así el
     * borde queda dentro como en rectángulo y elipse. Sin el módulo de trazados no se pinta.
     */
    function pathSvg(p, w, h, paint) {
        const fill = paint.fill;
        const stroke = paint.stroke;
        const strokeWidth = paint.strokeWidth;
        const P = paths();
        const inset = strokeWidth > 0 && stroke !== 'none' ? strokeWidth : 0;
        const d =
            P && p.d && p.viewBox ? P.scalePath(p.d, p.viewBox, Math.max(1, w - inset), Math.max(1, h - inset)) : '';
        if (!d) return '';
        return (
            '<path transform="translate(' +
            inset / 2 +
            ' ' +
            inset / 2 +
            ')" d="' +
            escape(d) +
            '" fill="' +
            escape(fill) +
            '" stroke="' +
            escape(stroke) +
            '" stroke-width="' +
            strokeWidth +
            '" stroke-linejoin="round"/>'
        );
    }

    // API to be exported
    const api = {
        shapeSvg: function (element) {
            let w = Math.max(0, element.w);
            let h = Math.max(0, element.h);
            let strokeWidth = element.props.strokeWidth || 0;
            let s = strokeWidth;
            let shapeType = element.props.shape || 'rect';
            let fill = element.props.fill;
            let stroke = element.props.stroke;

            if (fill === null) {
                fill = 'none';
            }

            if (stroke === null || strokeWidth <= 0) {
                stroke = 'none';
            }

            let svg =
                '<svg class="xsc-shape" width="100%" height="100%" viewBox="0 0 ' +
                w +
                ' ' +
                h +
                '" preserveAspectRatio="none"' +
                (shapeType === 'path' ? ' style="overflow:visible"' : '') +
                '>';

            if (shapeType === 'path') {
                svg += pathSvg(element.props, w, h, { fill: fill, stroke: stroke, strokeWidth: strokeWidth });
            } else if (shapeType === 'rect') {
                let radius = element.props.radius || 0;
                svg +=
                    '<rect x="' +
                    s / 2 +
                    '" y="' +
                    s / 2 +
                    '" width="' +
                    Math.max(0, w - s) +
                    '" height="' +
                    Math.max(0, h - s) +
                    '" rx="' +
                    radius +
                    '" fill="' +
                    escape(fill) +
                    '" stroke="' +
                    escape(stroke) +
                    '" stroke-width="' +
                    strokeWidth +
                    '"/>';
            } else if (shapeType === 'ellipse') {
                svg +=
                    '<ellipse cx="' +
                    w / 2 +
                    '" cy="' +
                    h / 2 +
                    '" rx="' +
                    Math.max(0, (w - s) / 2) +
                    '" ry="' +
                    Math.max(0, (h - s) / 2) +
                    '" fill="' +
                    escape(fill) +
                    '" stroke="' +
                    escape(stroke) +
                    '" stroke-width="' +
                    strokeWidth +
                    '"/>';
            } else if (shapeType === 'line') {
                svg +=
                    '<line x1="0" y1="' +
                    h / 2 +
                    '" x2="' +
                    w +
                    '" y2="' +
                    h / 2 +
                    '" stroke="' +
                    escape(stroke) +
                    '" stroke-width="' +
                    strokeWidth +
                    '" stroke-linecap="round"/>';
            } else if (shapeType === 'arrow') {
                let head = Math.min(w / 2, Math.max(strokeWidth * 3, 24));
                svg +=
                    '<line x1="0" y1="' +
                    h / 2 +
                    '" x2="' +
                    (w - head) +
                    '" y2="' +
                    h / 2 +
                    '" stroke="' +
                    escape(stroke) +
                    '" stroke-width="' +
                    strokeWidth +
                    '" stroke-linecap="round"/>';
                svg +=
                    '<polygon points="' +
                    (w - head) +
                    ',' +
                    (h / 2 - head * 0.6) +
                    ' ' +
                    w +
                    ',' +
                    h / 2 +
                    ' ' +
                    (w - head) +
                    ',' +
                    (h / 2 + head * 0.6) +
                    '" fill="' +
                    escape(stroke) +
                    '"/>';
            }

            svg += '</svg>';
            return svg;
        }
    };

    root.XiroSlideCanvasShapes = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
