/**
 * @fileoverview Piezas SVG comunes de los gráficos de la diapositiva libre (fase E): etiqueta <svg>
 * accesible, textos, leyenda, sectores y anillo, y el recuadro «Sin datos». Los ejes (columnas,
 * barras, líneas, área) están en slide-canvas-chart-axes.js. Todos reciben el contexto g que prepara
 * slide-canvas-chart.js: { w, h, s, pad, color, family, esc, kind, stacked, values, grid, legend, colors }.
 *
 * Criterios (skill dataviz): textos en el color del texto, nunca en el de la serie; huecos
 * transparentes entre sectores, que dejan ver el fondo de la diapositiva sea cual sea.
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasChartSvg y module.exports.
 */
(function (root) {
    'use strict';

    const CHAR_W = 0.56;

    function data() {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require('./slide-canvas-chart-data')
            : root.XiroSlideCanvasChartData;
    }

    function n(v) {
        return Math.round(v * 10) / 10;
    }

    /** Texto recortado con «…» para que quepa en maxW (anchura media estimada de la letra). */
    function fit(str, maxW, size) {
        const per = size * CHAR_W;
        if (str.length * per <= maxW) return str;
        return str.slice(0, Math.max(1, Math.floor(maxW / per) - 1)) + '…';
    }

    /** <text> en el color del texto del gráfico (o en o.fill dentro de un relleno de color). */
    function text(g, x, y, str, o) {
        return (
            '<text' +
            (o.cls ? ' class="' + o.cls + '"' : '') +
            ' x="' +
            n(x) +
            '" y="' +
            n(y) +
            '" fill="' +
            (o.fill || g.color) +
            '"' +
            (o.opacity ? ' fill-opacity="' + o.opacity + '"' : '') +
            ' font-family="' +
            g.family +
            '" font-size="' +
            n(o.size || g.s) +
            '" text-anchor="' +
            (o.anchor || 'start') +
            '">' +
            g.esc(str) +
            '</text>'
        );
    }

    /** Blanco o casi negro según el relleno, para un texto dentro de un segmento de color. */
    function inkOn(hex) {
        const c = parseInt(hex.slice(1, 7), 16);
        const lum = (0.2126 * (c >> 16) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
        return lum > 0.6 ? '#0b0b0b' : '#ffffff';
    }

    function open(g, label, extra) {
        return (
            '<svg class="xsc-chart' +
            (extra || '') +
            '" viewBox="0 0 ' +
            g.w +
            ' ' +
            g.h +
            '" width="100%" height="100%" role="img" aria-label="' +
            g.esc(label) +
            '"><title>' +
            g.esc(label) +
            '</title>'
        );
    }

    /**
     * Leyenda al pie, en filas que se parten si no caben.
     * @param {Object} g - Contexto de dibujo.
     * @param {Array<{name: string, color: string, opacity?: number}>} items
     * @returns {{svg: string, height: number}}
     */
    function legend(g, items) {
        if (!items.length) return { svg: '', height: 0 };
        const size = Math.round(g.s * 0.8);
        const sw = Math.round(size * 0.75);
        const lineH = size * 1.6;
        const maxW = g.w - 2 * g.pad;
        let x = 0;
        let row = 0;
        const placed = [];
        items.forEach(function (it) {
            const label = fit(it.name, maxW - sw * 2, size);
            const width = sw + size * 0.4 + label.length * size * CHAR_W;
            if (x > 0 && x + width > maxW) {
                row++;
                x = 0;
            }
            placed.push({ it: it, label: label, x: g.pad + x, row: row });
            x += width + size * 1.2;
        });
        const top = g.h - g.pad - (row + 1) * lineH;
        let out = '<g class="xsc-chart-legend">';
        placed.forEach(function (p) {
            const y = top + p.row * lineH + lineH / 2;
            out +=
                '<rect x="' +
                n(p.x) +
                '" y="' +
                n(y - sw / 2) +
                '" width="' +
                sw +
                '" height="' +
                sw +
                '" rx="' +
                n(sw / 4) +
                '" fill="' +
                p.it.color +
                '"' +
                (p.it.opacity ? ' fill-opacity="' + p.it.opacity + '"' : '') +
                '/>';
            out += text(g, p.x + sw + size * 0.4, y + size * 0.35, p.label, { size: size });
        });
        return { svg: out + '</g>', height: (row + 1) * lineH };
    }

    function point(cx, cy, r, a) {
        return n(cx + r * Math.cos(a)) + ' ' + n(cy + r * Math.sin(a));
    }

    function arc(geo, a0, a1) {
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const r = geo.r;
        const d =
            'M' +
            point(geo.cx, geo.cy, r, a0) +
            'A' +
            r +
            ' ' +
            r +
            ' 0 ' +
            large +
            ' 1 ' +
            point(geo.cx, geo.cy, r, a1);
        if (!geo.ri) return d + 'L' + point(geo.cx, geo.cy, 0, 0) + 'Z';
        const ri = geo.ri;
        return (
            d +
            'L' +
            point(geo.cx, geo.cy, ri, a1) +
            'A' +
            ri +
            ' ' +
            ri +
            ' 0 ' +
            large +
            ' 0 ' +
            point(geo.cx, geo.cy, ri, a0) +
            'Z'
        );
    }

    /** Valor escrito fuera del sector, en el color del texto. */
    function sliceValue(g, geo, mid, value) {
        const cos = Math.cos(mid);
        const anchor = cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle';
        const at = point(geo.cx, geo.cy, geo.r * 1.1, mid).split(' ');
        const size = Math.round(g.s * 0.8);
        return text(g, +at[0], +at[1] + size * 0.35, data().formatValue(value, false), {
            cls: 'xsc-chart-value',
            size: size,
            anchor: anchor
        });
    }

    /**
     * Sectores o anillo con la leyenda de las categorías y, si se pide, el valor fuera de cada sector.
     * @param {Object} g - Contexto de dibujo.
     * @param {Array<{name: string, value: number, color: string, opacity?: number}>} items - De pieSlices.
     * @returns {string}
     */
    function pie(g, items) {
        const leg = g.legend ? legend(g, items) : { svg: '', height: 0 };
        const plotH = g.h - 2 * g.pad - leg.height - (leg.height ? g.s * 0.5 : 0);
        const r = Math.max(1, Math.round((Math.min(g.w - 2 * g.pad, plotH) / 2) * (g.values ? 0.78 : 0.95)));
        const geo = { cx: g.w / 2, cy: g.pad + plotH / 2, r: r, ri: g.kind === 'doughnut' ? Math.round(r * 0.6) : 0 };
        let total = 0;
        items.forEach(function (it) {
            total += it.value;
        });
        let a = -Math.PI / 2;
        let out = '';
        items.forEach(function (it) {
            const sweep = (it.value / total) * 2 * Math.PI;
            // Hueco transparente entre sectores: unos 0,12 × letra en el borde
            const pad = items.length > 1 ? Math.min(Math.max(2, g.s * 0.12) / r, sweep / 4) : 0;
            const end = items.length > 1 ? a + sweep - pad / 2 : a + 2 * Math.PI - 0.0002;
            out +=
                '<path class="xsc-chart-slice" d="' +
                arc(geo, a + pad / 2, end) +
                '" fill="' +
                it.color +
                '"' +
                (it.opacity ? ' fill-opacity="' + it.opacity + '"' : '') +
                '/>';
            if (g.values) out += sliceValue(g, geo, a + sweep / 2, it.value);
            a += sweep;
        });
        return out + leg.svg;
    }

    /** Recuadro discontinuo, con el rótulo de la pantalla si lo hay: sin tabla o sin ningún número. */
    function empty(g, label) {
        let out = open(g, label, ' xsc-chart--empty');
        out +=
            '<rect x="' +
            g.pad +
            '" y="' +
            g.pad +
            '" width="' +
            Math.max(0, g.w - 2 * g.pad) +
            '" height="' +
            Math.max(0, g.h - 2 * g.pad) +
            '" rx="' +
            g.pad +
            '" fill="none" stroke="' +
            g.color +
            '" stroke-opacity="0.35" stroke-width="' +
            Math.max(2, Math.round(g.s * 0.08)) +
            '" stroke-dasharray="' +
            Math.round(g.s * 0.4) +
            ' ' +
            Math.round(g.s * 0.3) +
            '"/>';
        if (label) out += text(g, g.w / 2, g.h / 2 + g.s * 0.35, label, { anchor: 'middle', opacity: 0.72 });
        return out + '</svg>';
    }

    const api = {
        CHAR_W: CHAR_W,
        n: n,
        fit: fit,
        text: text,
        inkOn: inkOn,
        open: open,
        legend: legend,
        pie: pie,
        empty: empty
    };

    root.XiroSlideCanvasChartSvg = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
