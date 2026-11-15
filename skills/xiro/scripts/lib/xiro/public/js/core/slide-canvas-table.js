/**
 * @fileoverview Tabla de la diapositiva libre (fase D): celdas de texto plano con cabecera,
 * relleno (cuerpo, filas alternas y cabecera) y borde.
 *
 * normalizeTableProps corrige cualquier entrada (rellena filas cortas, recorta a los límites,
 * convierte celdas a texto plano); el validador del servidor rechaza lo que aquí se corrige.
 * tableHtml devuelve el HTML con todo el texto escapado; lo usan las 6 pantallas y el PDF.
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 * Expone window.XiroSlideCanvasTable y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    const MAX_ROWS = 20;
    const MAX_COLS = 10;
    const MAX_CELL = 200;
    const DEFAULT_GRID = 3;
    const ALIGNS = ['left', 'center', 'right'];

    // Fuentes y validación de color: las del modelo, buscadas al usarlas (el orden de carga no importa)
    function model() {
        return typeof module !== 'undefined' && module.exports
            ? // eslint-disable-next-line no-undef -- require solo en Node/Jest (CommonJS)
              require('./slide-canvas-model')
            : root.XiroSlideCanvas;
    }

    function num(v, min, max, fallback) {
        if (typeof v !== 'number' || !isFinite(v)) return fallback;
        return Math.min(max, Math.max(min, Math.round(v)));
    }

    /** Color válido, null si se admite "sin color", o el valor por defecto. */
    function color(v, fallback, allowNull) {
        if (allowNull && v === null) return null;
        return model().isColor(v) ? v : fallback;
    }

    /** Celda como texto plano: números y booleanos se escriben; objetos y null quedan vacíos. */
    function cellText(v) {
        const kind = typeof v;
        if (kind !== 'string' && kind !== 'number' && kind !== 'boolean') return '';
        return String(v).replace(/\r\n?/g, '\n').slice(0, MAX_CELL);
    }

    function emptyGrid() {
        const rows = [];
        for (let r = 0; r < DEFAULT_GRID; r++) rows.push(['', '', '']);
        return rows;
    }

    /** Filas rectangulares dentro de los límites; sin filas válidas, cuadrícula vacía de 3x3. */
    function normalizeRows(raw) {
        const source = Array.isArray(raw) ? raw.filter(Array.isArray).slice(0, MAX_ROWS) : [];
        let cols = 0;
        for (let i = 0; i < source.length; i++) cols = Math.max(cols, Math.min(MAX_COLS, source[i].length));
        if (!source.length || !cols) return emptyGrid();
        return source.map(function (row) {
            const out = [];
            for (let c = 0; c < cols; c++) out.push(cellText(row[c]));
            return out;
        });
    }

    /**
     * Props de tabla normalizadas.
     * @param {Object} p - Props en bruto (de la BD, del editor o de una importación).
     * @returns {Object} Props completas: rows, font, size, color, align, header, fill,
     *   bandFill, headerFill, borderColor, borderWidth.
     */
    function normalizeTableProps(p) {
        const raw = p && typeof p === 'object' ? p : {};
        const fonts = model().FONTS;
        return {
            rows: normalizeRows(raw.rows),
            font: Object.prototype.hasOwnProperty.call(fonts, raw.font) ? raw.font : 'sans',
            size: num(raw.size, 8, 200, 32),
            color: color(raw.color, '#ffffff', false),
            align: ALIGNS.indexOf(raw.align) >= 0 ? raw.align : 'left',
            header: typeof raw.header === 'boolean' ? raw.header : true,
            fill: color(raw.fill === undefined ? null : raw.fill, null, true),
            bandFill: color(raw.bandFill === undefined ? null : raw.bandFill, null, true),
            headerFill: color(raw.headerFill === undefined ? '#7c3aed' : raw.headerFill, '#7c3aed', true),
            borderColor: color(raw.borderColor === undefined ? '#ffffff' : raw.borderColor, '#ffffff', true),
            borderWidth: num(raw.borderWidth, 0, 20, 2)
        };
    }

    /** Relleno de la fila r: cabecera, fila par del cuerpo (alterna) o cuerpo. */
    function rowFill(p, r) {
        if (p.header && r === 0) return p.headerFill;
        const bodyIndex = p.header ? r - 1 : r;
        return bodyIndex % 2 === 1 && p.bandFill ? p.bandFill : p.fill;
    }

    function cellHtml(p, text, fill, isHeader, escape) {
        let style = '';
        if (p.borderColor && p.borderWidth > 0) style += 'border:' + p.borderWidth + 'px solid ' + p.borderColor + ';';
        if (fill) style += 'background-color:' + fill + ';';
        const tag = isHeader ? 'th' : 'td';
        const body = escape(text).replace(/\n/g, '<br>');
        return '<' + tag + (isHeader ? ' scope="col"' : '') + ' style="' + style + '">' + body + '</' + tag + '>';
    }

    /**
     * HTML de la tabla (ocupa toda la caja del elemento).
     * @param {Object} p - Props normalizadas con normalizeTableProps.
     * @param {Function} escape - Escapado de texto HTML (XiroSlideCanvasRender.escapeText).
     * @returns {string}
     */
    function tableHtml(p, escape) {
        const m = model();
        const style =
            'font-family:' +
            escape(m.FONTS[p.font] || m.FONTS.sans) +
            ';font-size:' +
            p.size +
            'px;' +
            'color:' +
            color(p.color, '#ffffff', false) +
            ';text-align:' +
            p.align +
            ';';
        let html = '<table class="xsc-table" style="' + style + '"><tbody>';
        for (let r = 0; r < p.rows.length; r++) {
            const isHeader = p.header && r === 0;
            const fill = rowFill(p, r);
            html += '<tr>';
            for (let c = 0; c < p.rows[r].length; c++) html += cellHtml(p, p.rows[r][c], fill, isHeader, escape);
            html += '</tr>';
        }
        return html + '</tbody></table>';
    }

    const api = {
        MAX_ROWS: MAX_ROWS,
        MAX_COLS: MAX_COLS,
        MAX_CELL: MAX_CELL,
        ALIGNS: ALIGNS,
        normalizeTableProps: normalizeTableProps,
        tableHtml: tableHtml
    };

    root.XiroSlideCanvasTable = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
