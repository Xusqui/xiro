/**
 * @fileoverview Gráficos de ejes de la diapositiva libre (fase E): columnas, barras, líneas y área,
 * también apilados, con rejilla, eje de valores, categorías y valores escritos. Las piezas comunes
 * (textos, leyenda) están en slide-canvas-chart-svg.js y los datos en slide-canvas-chart-data.js.
 *
 * Criterios (skill dataviz): rejilla fina y discreta, barras con el 72 % de la banda y un hueco
 * transparente entre barras y segmentos, líneas con punto en cada valor, área como veladura.
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasChartAxes y module.exports.
 */
(function (root) {
    'use strict';

    function dep(file, globalName) {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require(file)
            : root[globalName];
    }

    function data() {
        return dep('./slide-canvas-chart-data', 'XiroSlideCanvasChartData');
    }

    function svg() {
        return dep('./slide-canvas-chart-svg', 'XiroSlideCanvasChartSvg');
    }

    /** Caja del área de dibujo y escala del eje de valores (box.at pasa de valor a píxel). */
    function plotBox(g, d, legendH) {
        const horiz = g.kind === 'bar';
        const D = data();
        const per = svg().CHAR_W;
        const range = D.valueExtent(d, g.stacked);
        const scale = D.niceScale(range.min, range.max);
        const tick = Math.round(g.s * 0.8);
        const valLabels = scale.ticks.map(function (t) {
            return D.formatValue(t, true);
        });
        const catW = Math.min(D.longest(d.categories) * tick * per, g.w * 0.3);
        const box = {
            horiz: horiz,
            scale: scale,
            tick: tick,
            catW: catW,
            valLabels: valLabels,
            top: g.pad + (g.values ? g.s : tick * 0.6),
            bottom: g.h - g.pad - legendH - (legendH ? tick * 0.6 : 0) - tick * 1.6,
            left: g.pad + (horiz ? catW : D.longest(valLabels) * tick * per) + tick * 0.6,
            right: g.w - g.pad - (horiz && g.values ? g.s * 2.5 : 0)
        };
        box.at = function (v) {
            const t = (v - scale.min) / (scale.max - scale.min);
            return horiz ? box.left + t * (box.right - box.left) : box.bottom - t * (box.bottom - box.top);
        };
        return box;
    }

    /** Marcas del eje de valores, rejilla y línea del cero. */
    function grid(g, box) {
        const S = svg();
        const n = S.n;
        const hair = n(Math.max(1.5, g.s * 0.05));
        let lines = '';
        let labels = '';
        box.scale.ticks.forEach(function (t, i) {
            const p = box.at(t);
            if (t !== 0)
                lines += box.horiz
                    ? 'M' + n(p) + ' ' + n(box.top) + 'V' + n(box.bottom)
                    : 'M' + n(box.left) + ' ' + n(p) + 'H' + n(box.right);
            labels += box.horiz
                ? S.text(g, p, box.bottom + box.tick * 1.3, box.valLabels[i], {
                      size: box.tick,
                      anchor: 'middle',
                      opacity: 0.72
                  })
                : S.text(g, box.left - box.tick * 0.5, p + box.tick * 0.35, box.valLabels[i], {
                      size: box.tick,
                      anchor: 'end',
                      opacity: 0.72
                  });
        });
        const z = box.at(0);
        const axis = box.horiz
            ? 'M' + n(z) + ' ' + n(box.top) + 'V' + n(box.bottom)
            : 'M' + n(box.left) + ' ' + n(z) + 'H' + n(box.right);
        let out = '';
        if (g.grid && lines)
            out +=
                '<path class="xsc-chart-grid" d="' +
                lines +
                '" fill="none" stroke="' +
                g.color +
                '" stroke-opacity="0.16" stroke-width="' +
                hair +
                '"/>';
        return (
            out +
            '<path class="xsc-chart-axis" d="' +
            axis +
            '" fill="none" stroke="' +
            g.color +
            '" stroke-opacity="0.45" stroke-width="' +
            hair +
            '"/>' +
            labels
        );
    }

    function categoryLabels(g, box, categories) {
        const S = svg();
        const span = box.horiz ? box.bottom - box.top : box.right - box.left;
        const band = span / categories.length;
        let out = '';
        categories.forEach(function (c, i) {
            const mid = (box.horiz ? box.top : box.left) + band * (i + 0.5);
            out += box.horiz
                ? S.text(g, box.left - box.tick * 0.5, mid + box.tick * 0.35, S.fit(c, box.catW, box.tick), {
                      size: box.tick,
                      anchor: 'end',
                      opacity: 0.72
                  })
                : S.text(g, mid, box.bottom + box.tick * 1.3, S.fit(c, band * 0.95, box.tick), {
                      size: box.tick,
                      anchor: 'middle',
                      opacity: 0.72
                  });
        });
        return out;
    }

    /** Valor escrito junto a una barra (fuera del extremo) o dentro de un segmento apilado. */
    function barValue(g, box, r, v, color) {
        const S = svg();
        const t = box.tick;
        const label = data().formatValue(v, false);
        const o = { cls: 'xsc-chart-value', size: t, anchor: 'middle' };
        if (g.stacked) {
            const room = box.horiz ? r.w : r.h;
            if (room < t * 1.3 || (box.horiz && label.length * t * S.CHAR_W > r.w - t * 0.4)) return '';
            o.fill = S.inkOn(color);
            return S.text(g, r.x + r.w / 2, r.y + r.h / 2 + t * 0.35, label, o);
        }
        if (box.horiz) {
            o.anchor = v >= 0 ? 'start' : 'end';
            return S.text(g, v >= 0 ? r.x + r.w + t * 0.4 : r.x - t * 0.4, r.y + r.h / 2 + t * 0.35, label, o);
        }
        return S.text(g, r.x + r.w / 2, v >= 0 ? r.y - t * 0.4 : r.y + r.h + t * 1.1, label, o);
    }

    /** Rectángulo de la barra seg {i, j, from, v} (con apilado, el segmento sobre los anteriores). */
    function barRect(g, box, geo, seg) {
        const a = box.at(seg.from);
        const b = box.at(seg.from + seg.v);
        const lo = Math.min(a, b) + (g.stacked ? geo.gap / 2 : 0);
        const len = Math.abs(b - a) - (g.stacked ? geo.gap : 0);
        const along =
            geo.start +
            seg.i * geo.band +
            (geo.band - geo.group) / 2 +
            (g.stacked ? 0 : seg.j * geo.thick) +
            geo.gap / 2;
        const across = geo.thick - geo.gap;
        return box.horiz ? { x: lo, y: along, w: len, h: across } : { x: along, y: lo, w: across, h: len };
    }

    function bars(g, box, d) {
        const n = svg().n;
        const span = box.horiz ? box.bottom - box.top : box.right - box.left;
        const geo = {
            start: box.horiz ? box.top : box.left,
            band: span / d.categories.length,
            gap: Math.max(2, g.s * 0.08)
        };
        geo.group = geo.band * 0.72;
        geo.thick = g.stacked ? geo.group : geo.group / d.series.length;
        const rx = n(Math.min(g.s * 0.12, geo.thick / 3));
        let out = '';
        let labels = '';
        for (let i = 0; i < d.categories.length; i++) {
            const sums = { pos: 0, neg: 0 };
            for (let j = 0; j < d.series.length; j++) {
                const v = d.series[j].values[i];
                if (v === null) continue;
                const key = v >= 0 ? 'pos' : 'neg';
                const r = barRect(g, box, geo, { i: i, j: j, from: g.stacked ? sums[key] : 0, v: v });
                if (g.stacked) sums[key] += v;
                if (r.w <= 0 || r.h <= 0) continue;
                out +=
                    '<rect class="xsc-chart-bar" x="' +
                    n(r.x) +
                    '" y="' +
                    n(r.y) +
                    '" width="' +
                    n(r.w) +
                    '" height="' +
                    n(r.h) +
                    '" rx="' +
                    rx +
                    '" fill="' +
                    g.colors[j] +
                    '"/>';
                if (g.values) labels += barValue(g, box, r, v, g.colors[j]);
            }
        }
        return out + labels;
    }

    /** Una serie de líneas (cortada en los huecos) o de área (veladura acumulada sobre base). */
    function seriesPath(g, box, s, j, base) {
        const n = svg().n;
        const band = (box.right - box.left) / s.values.length;
        const r = n(Math.max(5, g.s * 0.2));
        const area = g.kind === 'area';
        const out = { line: '', top: '', bottom: '', dots: '', labels: '' };
        let pen = false;
        s.values.forEach(function (v, i) {
            const x = n(box.left + band * (i + 0.5));
            const lo = area && g.stacked ? base[i] : 0;
            const hi = area ? lo + (v === null ? 0 : v) : v;
            if (area) {
                out.top += (i ? 'L' : 'M') + x + ' ' + n(box.at(hi));
                out.bottom = 'L' + x + ' ' + n(box.at(lo)) + out.bottom;
                base[i] = g.stacked ? hi : 0;
            }
            if (v === null && !area) {
                pen = false;
                return;
            }
            const y = n(box.at(hi));
            out.line += (pen ? 'L' : 'M') + x + ' ' + y;
            pen = true;
            if (v === null) return;
            if (!area)
                out.dots +=
                    '<circle class="xsc-chart-dot" cx="' +
                    x +
                    '" cy="' +
                    y +
                    '" r="' +
                    r +
                    '" fill="' +
                    g.colors[j] +
                    '"/>';
            if (g.values)
                out.labels += svg().text(g, x, y - r - box.tick * 0.4, data().formatValue(v, false), {
                    cls: 'xsc-chart-value',
                    size: box.tick,
                    anchor: 'middle'
                });
        });
        return out;
    }

    function lines(g, box, d) {
        const sw = svg().n(Math.max(3, g.s * 0.1));
        const base = [];
        let out = '';
        let labels = '';
        for (let k = 0; k < d.categories.length; k++) base.push(0);
        d.series.forEach(function (s, j) {
            const p = seriesPath(g, box, s, j, base);
            const color = g.colors[j];
            if (g.kind === 'area')
                out +=
                    '<path class="xsc-chart-area" d="' +
                    p.top +
                    p.bottom +
                    'Z" fill="' +
                    color +
                    '" fill-opacity="0.22"/>';
            out +=
                '<path class="' +
                (g.kind === 'area' ? 'xsc-chart-edge' : 'xsc-chart-line') +
                '" d="' +
                p.line +
                '" fill="none" stroke="' +
                color +
                '" stroke-width="' +
                sw +
                '" stroke-linejoin="round" stroke-linecap="round"/>' +
                p.dots;
            labels += p.labels;
        });
        return out + labels;
    }

    /**
     * Gráfico de ejes (columnas, barras, líneas, área) sin la etiqueta <svg> que lo envuelve.
     * @param {Object} g - Contexto de dibujo.
     * @param {Object} d - Datos de chartData (con algún número).
     * @returns {string}
     */
    function cartesian(g, d) {
        const items = d.series.map(function (s, j) {
            return { name: s.name, color: g.colors[j] };
        });
        const leg = g.legend && d.series.length > 1 ? svg().legend(g, items) : { svg: '', height: 0 };
        const box = plotBox(g, d, leg.height);
        const marks = g.kind === 'line' || g.kind === 'area' ? lines(g, box, d) : bars(g, box, d);
        return grid(g, box) + categoryLabels(g, box, d.categories) + marks + leg.svg;
    }

    const api = { cartesian: cartesian };

    root.XiroSlideCanvasChartAxes = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
