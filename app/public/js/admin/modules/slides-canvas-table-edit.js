/**
 * @fileoverview Operaciones puras sobre las filas de una tabla de la diapositiva libre (fase D):
 * añadir y quitar filas y columnas, cambiar una celda y leer lo copiado de una hoja de cálculo.
 * Nunca modifican las filas de entrada; los límites salen de core/slide-canvas-table.js.
 * Expone XiroCanvasEditor.tableEdit y module.exports (Node/Jest).
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    function table() {
        return root.XiroSlideCanvasTable;
    }

    function clone(rows) {
        return rows.map(row => row.slice());
    }

    /** Posición válida de inserción o borrado; sin ella (o fuera de rango), la última. */
    function position(index, length) {
        return Number.isInteger(index) && index >= 0 && index <= length ? index : length;
    }

    /**
     * @param {string[][]} rows - Filas rectangulares.
     * @param {number} [index] - Dónde insertar (por defecto, al final).
     * @returns {string[][]} Filas nuevas con una fila vacía más (o iguales si ya hay el máximo).
     */
    function addRow(rows, index) {
        const out = clone(rows);
        if (out.length >= table().MAX_ROWS) return out;
        out.splice(
            position(index, out.length),
            0,
            out[0].map(() => '')
        );
        return out;
    }

    /** @returns {string[][]} Filas con una columna vacía más (o iguales si ya hay el máximo). */
    function addCol(rows, index) {
        const out = clone(rows);
        if (out[0].length >= table().MAX_COLS) return out;
        const at = position(index, out[0].length);
        out.forEach(row => row.splice(at, 0, ''));
        return out;
    }

    /** @returns {string[][]} Filas sin la fila indicada (la última si no se indica); nunca vacías. */
    function removeRow(rows, index) {
        const out = clone(rows);
        if (out.length <= 1) return out;
        out.splice(Math.min(position(index, out.length), out.length - 1), 1);
        return out;
    }

    /** @returns {string[][]} Filas sin la columna indicada (la última si no se indica); nunca vacías. */
    function removeCol(rows, index) {
        const out = clone(rows);
        const cols = out[0].length;
        if (cols <= 1) return out;
        const at = Math.min(position(index, cols), cols - 1);
        out.forEach(row => row.splice(at, 1));
        return out;
    }

    /** @returns {string[][]} Filas con la celda (r, c) cambiada; fuera de la tabla, una copia igual. */
    function setCell(rows, r, c, text) {
        const out = clone(rows);
        if (!out[r] || c < 0 || c >= out[r].length) return out;
        out[r][c] = String(text);
        return out;
    }

    /** Celda entre comillas desde la comilla de apertura en start; "" dentro es una comilla. */
    function readQuoted(src, start) {
        let text = '';
        let i = start + 1;
        while (i < src.length) {
            if (src[i] === '"' && src[i + 1] === '"') {
                text += '"';
                i += 2;
            } else if (src[i] === '"') {
                return { text, end: i + 1 };
            } else {
                text += src[i++];
            }
        }
        return { text, end: i };
    }

    function splitTsv(src) {
        const rows = [[]];
        let cell = '';
        let i = 0;
        while (i < src.length) {
            const ch = src[i];
            if (ch === '"' && cell === '') {
                const quoted = readQuoted(src, i);
                cell = quoted.text;
                i = quoted.end;
                continue;
            }
            if (ch === '\t' || ch === '\n') {
                rows[rows.length - 1].push(cell);
                cell = '';
                if (ch === '\n') rows.push([]);
            } else cell += ch;
            i++;
        }
        rows[rows.length - 1].push(cell);
        return rows;
    }

    /**
     * Lee lo copiado de una hoja de cálculo (Excel, Calc, Google Sheets): tabuladores entre
     * celdas, saltos de línea entre filas y celdas entre comillas si llevan saltos o tabuladores.
     * @param {*} text - Texto pegado.
     * @returns {string[][]|null} Filas rectangulares dentro de los límites, o null si no hay nada.
     */
    function parseTsv(text) {
        if (typeof text !== 'string' || !text.trim()) return null;
        const src = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
        return table().normalizeTableProps({ rows: splitTsv(src) }).rows;
    }

    const api = { addRow, addCol, removeRow, removeCol, setCell, parseTsv };
    E.tableEdit = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
