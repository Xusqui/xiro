/**
 * @fileoverview Gráfico de la diapositiva libre (fase E), siempre vinculado a una tabla del mismo
 * lienzo (props.source.tableId), que puede estar oculta. Los datos se leen de la tabla al pintar,
 * así que el gráfico se actualiza solo al editarla.
 *
 * normalizeChartProps corrige cualquier entrada; linkCharts vacía los vínculos que no apuntan a una
 * tabla del lienzo (se pinta «Sin datos»); chartSvg devuelve el SVG con todo el texto escapado.
 * Módulos: datos en slide-canvas-chart-data.js, piezas SVG comunes y sectores en -chart-svg.js, ejes
 * en -chart-axes.js. Paleta: la de referencia de la skill dataviz, validada (8 colores en orden fijo,
 * sin ciclos): tonos para fondo oscuro si el texto del gráfico es claro, y para fondo claro si es oscuro.
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasChart y module.exports.
 */
(function (root) {
    'use strict';

    const KINDS = ['column', 'bar', 'line', 'area', 'pie', 'doughnut'];
    const STACKABLE = ['column', 'bar', 'area'];
    const SERIES_IN = ['columns', 'rows'];
    const MAX_CATEGORIES = 24;
    const MAX_SERIES = 8;
    const MAX_ALT = 300;
    const ID_RE = /^el_[a-z0-9]{4,16}$/;
    const PALETTE = {
        dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
        light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
    };

    /** Módulo hermano: require en Node/Jest, global en el navegador (se busca al usarlo). */
    function dep(file, globalName) {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require(file)
            : root[globalName];
    }

    function model() {
        return dep('./slide-canvas-model', 'XiroSlideCanvas');
    }

    function data() {
        return dep('./slide-canvas-chart-data', 'XiroSlideCanvasChartData');
    }

    function svg() {
        return dep('./slide-canvas-chart-svg', 'XiroSlideCanvasChartSvg');
    }

    function axes() {
        return dep('./slide-canvas-chart-axes', 'XiroSlideCanvasChartAxes');
    }

    function num(v, min, max, fallback) {
        if (typeof v !== 'number' || !isFinite(v)) return fallback;
        return Math.min(max, Math.max(min, Math.round(v)));
    }

    function bool(v, fallback) {
        return typeof v === 'boolean' ? v : fallback;
    }

    /**
     * Props de gráfico normalizadas.
     * @param {Object} p - Props en bruto.
     * @returns {Object} { source: { tableId, seriesIn }, kind, stacked, seriesColors, legend, values,
     *   grid, font, size, color, alt }
     */
    function normalizeChartProps(p) {
        const raw = p && typeof p === 'object' ? p : {};
        const src = raw.source && typeof raw.source === 'object' ? raw.source : {};
        const m = model();
        const kind = KINDS.indexOf(raw.kind) >= 0 ? raw.kind : 'column';
        const colors = Array.isArray(raw.seriesColors) ? raw.seriesColors.slice(0, MAX_SERIES) : [];
        return {
            source: {
                tableId: typeof src.tableId === 'string' && ID_RE.test(src.tableId) ? src.tableId : '',
                seriesIn: SERIES_IN.indexOf(src.seriesIn) >= 0 ? src.seriesIn : 'columns'
            },
            kind: kind,
            stacked: STACKABLE.indexOf(kind) >= 0 && raw.stacked === true,
            seriesColors: colors.map(function (c) {
                return m.isColor(c) ? c : null;
            }),
            legend: bool(raw.legend, true),
            values: bool(raw.values, false),
            grid: bool(raw.grid, true),
            font: Object.prototype.hasOwnProperty.call(m.FONTS, raw.font) ? raw.font : 'sans',
            size: num(raw.size, 12, 120, 32),
            color: m.isColor(raw.color) ? raw.color : '#ffffff',
            alt: typeof raw.alt === 'string' ? raw.alt.replace(/\s+/g, ' ').trim().slice(0, MAX_ALT) : ''
        };
    }

    /** Vacía los vínculos que no apuntan a una tabla del mismo lienzo. Devuelve el lienzo. */
    function linkCharts(canvas) {
        const list = canvas && Array.isArray(canvas.elements) ? canvas.elements : [];
        const tables = {};
        for (let i = 0; i < list.length; i++) if (list[i].type === 'table') tables[list[i].id] = true;
        for (let j = 0; j < list.length; j++) {
            const src = list[j].type === 'chart' && list[j].props ? list[j].props.source : null;
            if (src && src.tableId && !tables[src.tableId]) src.tableId = '';
        }
        return canvas;
    }

    function readData(props, tableProps) {
        return data().chartData(props, tableProps, { categories: MAX_CATEGORIES, series: MAX_SERIES });
    }

    /** @returns {string} Descripción del gráfico a partir de los datos de su tabla (texto alternativo). */
    function describe(props, tableProps) {
        return data().describe(readData(props, tableProps));
    }

    function lightText(hex) {
        const c = parseInt(hex.slice(1, 7), 16);
        return (0.2126 * (c >> 16) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255 > 0.5;
    }

    /**
     * Colores de las 8 posiciones: los elegidos y, donde no hay, los de la paleta.
     * @param {Object} p - Props normalizadas.
     * @returns {Array<string>} Los 8 colores con los que se pintan las series.
     */
    function colorsFor(p) {
        const palette = PALETTE[lightText(p.color) ? 'dark' : 'light'];
        return palette.map(function (c, i) {
            return p.seriesColors[i] || c;
        });
    }

    function context(el, escape) {
        const p = el.props;
        const m = model();
        return {
            w: el.w,
            h: el.h,
            s: p.size,
            pad: Math.round(p.size * 0.5),
            color: p.color,
            family: escape(m.FONTS[p.font] || m.FONTS.sans),
            esc: escape,
            kind: p.kind,
            stacked: p.stacked,
            values: p.values,
            grid: p.grid,
            legend: p.legend,
            colors: colorsFor(p)
        };
    }

    /**
     * SVG del gráfico (ocupa toda la caja del elemento).
     * @param {Object} el - Elemento chart normalizado (w, h, props).
     * @param {Object|null} tableProps - Props normalizadas de la tabla vinculada, o null.
     * @param {Function} escape - Escapado de texto HTML (XiroSlideCanvasRender.escapeText).
     * @param {Object} [labels] - Textos de la pantalla: { chartNoData }.
     * @returns {string}
     */
    function chartSvg(el, tableProps, escape, labels) {
        const g = context(el, escape);
        const d = readData(el.props, tableProps);
        const round = g.kind === 'pie' || g.kind === 'doughnut';
        const items = round ? data().pieSlices(d, g.colors, g.color, MAX_SERIES) : null;
        if (round ? !items.length : !data().hasValues(d)) return svg().empty(g, (labels && labels.chartNoData) || '');
        const body = round ? svg().pie(g, items) : axes().cartesian(g, d);
        return svg().open(g, el.props.alt || data().describe(d)) + body + '</svg>';
    }

    const api = {
        KINDS: KINDS,
        STACKABLE: STACKABLE,
        SERIES_IN: SERIES_IN,
        MAX_CATEGORIES: MAX_CATEGORIES,
        MAX_SERIES: MAX_SERIES,
        MAX_ALT: MAX_ALT,
        PALETTE: PALETTE,
        normalizeChartProps: normalizeChartProps,
        parseNumber: function (text) {
            return data().parseNumber(text);
        },
        chartData: readData,
        describe: describe,
        linkCharts: linkCharts,
        chartSvg: chartSvg,
        seriesColors: colorsFor
    };

    root.XiroSlideCanvasChart = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
