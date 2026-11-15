/**
 * @fileoverview Acciones del editor con gráficos (fase E3): crear un gráfico desde una tabla, el
 * gráfico de ejemplo de la barra, «Editar datos», ocultar la tabla y cambiar la tabla de un gráfico.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const SLIDE_W = 1920;
    const SLIDE_H = 1080;
    const MARGIN = 40;
    const GAP = 40;
    const MIN_W = 480;
    const MAX_W = 1280;

    const model = () => root.XiroSlideCanvas;

    /**
     * @param {number} v - Valor a clamping.
     * @param {number} min - Mínimo.
     * @param {number} max - Máximo.
     * @returns {number} Valor clamped.
     */
    function clamp(v, min, max) {
        return Math.min(max, Math.max(min, v));
    }

    /**
     * @param {number} availW - Ancho disponible.
     * @param {number} availH - Alto disponible.
     * @returns {number} Ancho del gráfico o 0 si no cabe.
     */
    function fit(availW, availH) {
        const w = Math.floor(Math.min(MAX_W, availW, availH * 16 / 9));
        return w >= MIN_W ? w : 0;
    }

    /**
     * @param {Object} table - Box de la tabla: {x, y, w, h, rotation}.
     * @param {number} w - Ancho del gráfico.
     * @returns {Object} Posición del gráfico al lado: { x, y, w, h, rotation, replace }.
     */
    function beside(table, w) {
        const h = Math.round(w * 9 / 16);
        return { x: table.x + table.w + GAP, y: clamp(Math.round(table.y + table.h / 2 - h / 2), MARGIN, SLIDE_H - MARGIN - h), w: w, h: h, rotation: 0, replace: false };
    }

    /**
     * @param {Object} table - Box de la tabla: {x, y, w, h, rotation}.
     * @param {number} w - Ancho del gráfico.
     * @returns {Object} Posición del gráfico abajo: { x, y, w, h, rotation, replace }.
     */
    function below(table, w) {
        const h = Math.round(w * 9 / 16);
        return { x: clamp(Math.round(table.x + table.w / 2 - w / 2), MARGIN, SLIDE_W - MARGIN - w), y: table.y + table.h + GAP, w: w, h: h, rotation: 0, replace: false };
    }

    /**
     * Dónde va el gráfico creado desde una tabla: al lado donde quepa más grande o, si no cabe, en su sitio.
     * @param {Object} table - Box de la tabla: {x, y, w, h, rotation}.
     * @returns {Object} Posición del gráfico: { x, y, w, h, rotation, replace }.
     */
    E.chartPlacement = function (table) {
        const x0 = table.x + table.w + GAP;
        const wr = fit(SLIDE_W - MARGIN - x0, SLIDE_H - 2 * MARGIN);

        const y0 = table.y + table.h + GAP;
        const wb = fit(SLIDE_W - 2 * MARGIN, SLIDE_H - MARGIN - y0);

        if (wr === 0 && wb === 0) {
            return { x: table.x, y: table.y, w: table.w, h: table.h, rotation: table.rotation || 0, replace: true };
        }

        return wr >= wb ? beside(table, wr) : below(table, wb);
    };

    /**
     * Crea un gráfico vinculado a la tabla, seleccionado y en un solo paso de deshacer; si ocupa su sitio, oculta la tabla.
     * @param {string} tableId - Id de la tabla.
     * @returns {Object|null} El elemento gráfico creado o null si no se pudo.
     */
    E.createChartFromTable = function (tableId) {
        const table = E.getElement(tableId);
        if (!table || table.type !== 'table') return null;

        const elements = E.state.canvas.elements;
        if (elements.length + 1 > model().MAX_ELEMENTS) {
            warnFull();
            return null;
        }

        const place = E.chartPlacement(table);
        const rows = table.props.rows;
        const seriesIn = rows.length >= rows[0].length ? 'columns' : 'rows';

        const chart = model().createElement('chart', {
            existingIds: idsOf(elements),
            x: place.x,
            y: place.y,
            w: place.w,
            h: place.h,
            rotation: place.rotation,
            props: { source: { tableId: tableId, seriesIn: seriesIn } }
        });

        if (!chart) return null;

        if (place.replace) {
            const index = elements.findIndex(el => el.id === tableId);
            if (index >= 0) {
                elements[index] = model().normalizeElement(Object.assign({}, table, { hidden: true }));
            }
        }

        elements.push(chart);
        E.select(chart.id);
        E.commit();
        return chart;
    };

    /**
     * Añade una tabla de ejemplo y su gráfico al lado (botón «Gráfico» de la barra).
     * @returns {Object|null} El elemento gráfico creado o null si no se pudo.
     */
    E.insertSampleChart = function () {
        const elements = E.state.canvas.elements;
        if (elements.length + 2 > model().MAX_ELEMENTS) {
            warnFull();
            return null;
        }

        const rows = [
            ['', E.t('chart.sample_series', { n: 1 }), E.t('chart.sample_series', { n: 2 })],
            [E.t('chart.sample_category', { n: 1 }), '12', '18'],
            [E.t('chart.sample_category', { n: 2 }), '15', '22'],
            [E.t('chart.sample_category', { n: 3 }), '9', '14'],
            [E.t('chart.sample_category', { n: 4 }), '20', '26']
        ];

        const table = model().createElement('table', {
            existingIds: idsOf(elements),
            x: 80,
            y: 340,
            w: 720,
            h: 400,
            props: { rows }
        });

        if (!table) return null;

        const chart = model().createElement('chart', {
            existingIds: idsOf(elements).concat(table.id),
            x: 880,
            y: 270,
            w: 960,
            h: 540,
            props: { source: { tableId: table.id, seriesIn: 'columns' } }
        });

        if (!chart) return null;

        elements.push(table);
        elements.push(chart);
        E.select(chart.id);
        E.commit();
        return chart;
    };

    /** Aviso de diapositiva llena (máximo de elementos del modelo). */
    function warnFull() {
        if (typeof root.mostrarModalError === 'function') root.mostrarModalError(E.th('chart.full'));
    }

    /**
     * @param {Object} chart - Elemento gráfico.
     * @returns {Object|null} La tabla vinculada o null.
     */
    E.chartTable = function (chart) {
        if (!chart || chart.type !== 'chart' || !chart.props || !chart.props.source || !chart.props.source.tableId) return null;
        const table = E.getElement(chart.props.source.tableId);
        return table && table.type === 'table' ? table : null;
    };

    /**
     * @param {string} chartId - Id del gráfico.
     * @returns {boolean} Si se pudo editar los datos.
     */
    E.editChartData = function (chartId) {
        const table = E.chartTable(E.getElement(chartId));
        if (!table) return false;
        E.select(table.id);
        if (E.tableCellEdit && E.tableCellEdit.openAt) E.tableCellEdit.openAt(0, 0);
        return true;
    };

    /**
     * @param {string} tableId - Id de la tabla.
     * @param {boolean} hidden - Si debe estar oculta.
     * @returns {boolean} Si se pudo cambiar el estado.
     */
    E.setTableHidden = function (tableId, hidden) {
        const table = E.getElement(tableId);
        if (!table || table.type !== 'table') return false;
        if (Boolean(table.hidden) === Boolean(hidden)) return false;
        E.updateElement(tableId, { hidden: !!hidden });
        return true;
    };

    /**
     * @param {string} chartId - Id del gráfico.
     * @param {string} tableId - Id de la tabla o cadena vacía.
     * @returns {boolean} Si se pudo vincular.
     */
    E.linkChartTo = function (chartId, tableId) {
        const chart = E.getElement(chartId);
        if (!chart || chart.type !== 'chart') return false;
        const table = tableId ? E.getElement(tableId) : null;
        if (tableId && (!table || table.type !== 'table')) return false;
        E.updateElement(chartId, { props: { source: { tableId: tableId, seriesIn: chart.props.source.seriesIn } } });
        return true;
    };

    /**
     * @param {string} tableId - Id de la tabla.
     * @returns {number} Número de gráficos que usan esa tabla.
     */
    E.feedsCharts = function (tableId) {
        const elements = E.state.canvas.elements;
        return elements.filter(el => el.type === 'chart' && el.props.source.tableId === tableId).length;
    };

    /**
     * @param {Array<Object>} list - Lista de elementos.
     * @returns {Array<string>} Ids de los elementos.
     */
    function idsOf(list) {
        return list.map(el => el.id);
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = E;
})();
