/**
 * @fileoverview Campos del panel de propiedades para los cuadros de texto de la
 * diapositiva libre (slides-canvas-props-fields.js los pinta y los lee). Solo lo del cuadro
 * (texto plano, alineación vertical, relleno y ajuste): la letra y el párrafo están en la barra
 * de formato (slides-canvas-textbar.js). Etiquetas, títulos y opciones son claves admin.canvas.*
 * (slides-canvas-i18n.js); se traducen al pintar.
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
            // Con formato por tramos o por párrafos el texto se edita en el lienzo: aquí se perdería el formato
            { key: 'text', label: 'field.text', kind: 'textarea', when: el => !el.props.runs && !el.props.paras },
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
