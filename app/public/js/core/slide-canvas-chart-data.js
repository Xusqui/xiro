/**
 * @fileoverview Datos de los gráficos de la diapositiva libre (fase E): lectura de números de las
 * celdas, series desde la tabla vinculada, escala del eje de valores, sectores y descripción para
 * el texto alternativo. Lo usan slide-canvas-chart.js y los módulos de dibujo.
 *
 * Números: coma o punto decimal; un único separador seguido de exactamente 3 cifras (1.234, 1,234)
 * es de miles. Se quitan espacios y los símbolos € $ £ %. Lo demás es un hueco (null).
 * ES5 a propósito (webOS 3.5). Expone window.XiroSlideCanvasChartData y module.exports.
 */
(function (root) {
    'use strict';

    const NUMBER_RE = /^-?\d+(?:[.,]\d+)*$/;
    const GROUPED_RE = /^-?[1-9]\d{0,2}(?:([.,])\d{3})(?:\1\d{3})*$/;

    /** Texto de celda como número, o null si no lo es. */
    function parseNumber(text) {
        if (typeof text !== 'string') return null;
        let s = text.replace(/[\s\u00a0€$£%]/g, '').replace(/\u2212/g, '-');
        if (!NUMBER_RE.test(s)) return null;
        const dot = s.lastIndexOf('.');
        const comma = s.lastIndexOf(',');
        if (GROUPED_RE.test(s)) s = s.replace(/[.,]/g, '');
        else if (dot >= 0 && comma >= 0) s = s.replace(dot > comma ? /,/g : /\./g, '').replace(',', '.');
        else if ((s.match(/[.,]/g) || []).length > 1) return null;
        else s = s.replace(',', '.');
        const n = parseFloat(s);
        return isFinite(n) ? n : null;
    }

    /** Celda (r, c) de la tabla según la orientación: con 'rows' se lee traspuesta. */
    function cellAt(rows, r, c, byRows) {
        const row = rows[byRows ? c : r];
        const value = row ? row[byRows ? r : c] : '';
        return typeof value === 'string' ? value : '';
    }

    /**
     * Categorías y series del gráfico, leídas de la tabla.
     * @param {Object} props - Props normalizadas del gráfico (source.seriesIn).
     * @param {Object|null} tableProps - Props normalizadas de la tabla vinculada.
     * @param {Object} limits - { categories, series }: cuántas se leen como máximo.
     * @returns {{categories: string[], series: Array<{name: string, values: Array<number|null>}>,
     *   dropped: {categories: number, series: number}}}
     */
    function chartData(props, tableProps, limits) {
        const out = { categories: [], series: [], dropped: { categories: 0, series: 0 } };
        const rows = tableProps && tableProps.rows;
        if (!rows || rows.length < 2 || rows[0].length < 2) return out;
        const byRows = props.source.seriesIn === 'rows';
        const catCount = (byRows ? rows[0].length : rows.length) - 1;
        const serCount = (byRows ? rows.length : rows[0].length) - 1;
        const cats = Math.min(catCount, limits.categories);
        const sers = Math.min(serCount, limits.series);
        out.dropped = { categories: catCount - cats, series: serCount - sers };
        for (let i = 1; i <= cats; i++) out.categories.push(cellAt(rows, i, 0, byRows));
        for (let j = 1; j <= sers; j++) {
            const values = [];
            for (let k = 1; k <= cats; k++) values.push(parseNumber(cellAt(rows, k, j, byRows)));
            out.series.push({ name: cellAt(rows, 0, j, byRows), values: values });
        }
        return out;
    }

    /** ¿Hay algún número en las series? */
    function hasValues(d) {
        for (let i = 0; i < d.series.length; i++) {
            for (let j = 0; j < d.series[i].values.length; j++) if (d.series[i].values[j] !== null) return true;
        }
        return false;
    }

    /** Mínimo y máximo de los valores (con apilado, de las sumas por categoría). */
    function valueExtent(d, stacked) {
        let min = 0;
        let max = 0;
        for (let i = 0; i < d.categories.length; i++) {
            let pos = 0;
            let neg = 0;
            for (let j = 0; j < d.series.length; j++) {
                const v = d.series[j].values[i];
                if (v === null) continue;
                if (stacked) {
                    if (v >= 0) pos += v;
                    else neg += v;
                } else {
                    pos = Math.max(pos, v);
                    neg = Math.min(neg, v);
                }
            }
            max = Math.max(max, pos);
            min = Math.min(min, neg);
        }
        return { min: min, max: max };
    }

    /** Paso «redondo» (1, 2, 2,5, 5 × 10^n) para unas 5 marcas entre min y max. */
    function niceStep(span) {
        const raw = span / 5;
        const mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
        const steps = [1, 2, 2.5, 5, 10];
        for (let i = 0; i < steps.length; i++) if (steps[i] * mag >= raw) return steps[i] * mag;
        return 10 * mag;
    }

    /**
     * Escala del eje de valores, siempre con el cero dentro.
     * @param {number} min - Valor mínimo de los datos.
     * @param {number} max - Valor máximo de los datos.
     * @returns {{min: number, max: number, ticks: number[]}}
     */
    function niceScale(min, max) {
        let lo = Math.min(0, min);
        let hi = Math.max(0, max);
        if (lo === hi) hi = lo + 1;
        const step = niceStep(hi - lo);
        lo = Math.floor(lo / step) * step;
        hi = Math.ceil(hi / step) * step;
        const ticks = [];
        for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
        return { min: lo, max: hi, ticks: ticks };
    }

    /** Número para escribir: hasta 2 decimales; 10.000 o más, abreviado (12K, 3,4M) en los ejes. */
    function formatValue(n, compact) {
        const abs = Math.abs(n);
        if (compact && abs >= 1e6) return Math.round(n / 1e5) / 10 + 'M';
        if (compact && abs >= 1e4) return Math.round(n / 100) / 10 + 'K';
        return String(Math.round(n * 100) / 100);
    }

    /** Longitud del texto más largo de la lista. */
    function longest(list) {
        let len = 0;
        for (let i = 0; i < list.length; i++) len = Math.max(len, list[i].length);
        return len;
    }

    /**
     * Sectores con valor positivo de la primera serie. El color sigue a la categoría (su posición en
     * la tabla); desde la categoría número maxColored, todo se junta en un «…» atenuado.
     * @returns {Array<{name: string, value: number, color: string, opacity?: number}>}
     */
    function pieSlices(d, colors, restColor, maxColored) {
        const out = [];
        const s0 = d.series[0];
        let rest = 0;
        d.categories.forEach(function (c, i) {
            const v = s0 ? s0.values[i] : null;
            if (v === null || v <= 0) return;
            if (i < maxColored) out.push({ name: c, value: v, color: colors[i] });
            else rest += v;
        });
        if (rest) out.push({ name: '…', value: rest, color: restColor, opacity: 0.35 });
        return out;
    }

    /** Descripción a partir de los datos («Serie: categoría valor, …; …»), para el texto alternativo. */
    function describe(d) {
        return d.series
            .map(function (s) {
                const parts = [];
                s.values.forEach(function (v, i) {
                    if (v !== null) parts.push(d.categories[i] + ' ' + formatValue(v, false));
                });
                return s.name + ': ' + parts.join(', ');
            })
            .join('; ');
    }

    const api = {
        parseNumber: parseNumber,
        chartData: chartData,
        hasValues: hasValues,
        valueExtent: valueExtent,
        niceScale: niceScale,
        formatValue: formatValue,
        longest: longest,
        pieSlices: pieSlices,
        describe: describe
    };

    root.XiroSlideCanvasChartData = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
