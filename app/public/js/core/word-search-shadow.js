/**
 * @fileoverview Regla compartida de la Sopa de letras (word_search): copias «sombra».
 * Usada por el servidor (WordSearchService) y por el navegador (word-search-grid.js).
 *
 * ES5 a propósito, como word-search-grid.js: lo cargan jugador y standalone.
 * Nada de =>, plantillas, ?. ni ??. Expone window.XiroWordSearchShadow (y module.exports
 * para los tests de Jest).
 */
(function (root) {
    'use strict';

    /** Direcciones 8-way: vertical, horizontal y diagonales */
    let DIRECTIONS = [[0,1],[1,0],[1,1],[-1,1],[0,-1],[-1,0],[-1,-1],[1,-1]];

    /**
     * Celdas [r, c] de una línea recta (8 direcciones), o null si no es recta
     * @param {number} r1 - Fila inicial
     * @param {number} c1 - Columna inicial
     * @param {number} r2 - Fila final
     * @param {number} c2 - Columna final
     * @returns {Array<Array<number>>|null} Celdas o null si no es recta
     */
    function lineCells(r1, c1, r2, c2) {
        let dr = r2 - r1;
        let dc = c2 - c1;
        if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
        let steps = Math.max(Math.abs(dr), Math.abs(dc));
        let cells = [];
        for (let i = 0; i <= steps; i++) {
            cells.push([r1 + (dr ? (dr > 0 ? 1 : -1) * i : 0), c1 + (dc ? (dc > 0 ? 1 : -1) * i : 0)]);
        }
        return cells;
    }

    /**
     * Celdas [r, c] de una línea recta (8 direcciones), o null si no es recta
     * @param {{r1: number, c1: number, r2: number, c2: number}} sel - Selección
     * @returns {Array<Array<number>>|null} Celdas o null si no es recta
     */
    function selectionCells(sel) {
        if (!sel) return null;
        return lineCells(sel.r1, sel.c1, sel.r2, sel.c2);
    }

    /** ¿Se lee `word` desde (r, c) en la dirección [dr, dc] sin salirse de la rejilla? */
    function readsAt(grid, word, r, c, dir) {
        for (let j = 0; j < word.length; j++) {
            let row = grid[r + dir[0] * j];
            if (!row || row[c + dir[1] * j] !== word[j]) return false;
        }
        return true;
    }

    /**
     * Todas las ocurrencias de una palabra en la rejilla
     * @param {Array<string>} grid - Rejilla como array de strings
     * @param {string} word - Palabra a buscar (mayúsculas)
     * @returns {Array<Array<Array<number>>>} Array de ocurrencias, cada una es array de celdas [r,c]
     */
    function occurrences(grid, word) {
        if (!grid || !Array.isArray(grid)) return [];
        let rows = grid.length;
        if (rows === 0) return [];
        let cols = grid[0].length;
        if (cols === 0) return [];
        let result = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                for (let i = 0; i < DIRECTIONS.length; i++) {
                    let dir = DIRECTIONS[i];
                    if (readsAt(grid, word, r, c, dir)) {
                        result.push(lineCells(r, c, r + dir[0] * (word.length - 1), c + dir[1] * (word.length - 1)));
                    }
                }
            }
        }
        return result;
    }

    /**
     * Comprueba si cada celda de cells está en alguna ocurrencia de occ
     * @param {Array<Array<number>>} occ - Una ocurrencia (array de celdas [r,c])
     * @param {Array<Array<number>>} cells - Celdas a verificar
     * @returns {boolean} True si todas las celdas están cubiertas por la ocurrencia
     */
    function covers(occ, cells) {
        for (let i = 0; i < cells.length; i++) {
            let found = false;
            for (let j = 0; j < occ.length; j++) {
                if (occ[j][0] === cells[i][0] && occ[j][1] === cells[i][1]) {
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    }

    /**
     * Obtiene todas las ocurrencias de palabras contenedoras
     * @param {Array<string>} grid - Rejilla como array de strings
     * @param {Array<string>} words - Lista de palabras (mayúsculas)
     * @param {number} index - Índice de la palabra seleccionada
     * @returns {Array<Array<Array<number>>>} Array de todas las ocurrencias contenedoras
     */
    function containerOccurrences(grid, words, index) {
        let result = [];
        let word = words[index];
        let reversedWord = word.split('').reverse().join('');
        for (let i = 0; i < words.length; i++) {
            if (i === index) continue;
            let w = words[i];
            if (w.length <= word.length) continue;
            if (w.indexOf(word) !== -1 || w.indexOf(reversedWord) !== -1) {
                result = result.concat(occurrences(grid, w));
            }
        }
        return result;
    }

    /**
     * Comprueba si todas las celdas están cubiertas por alguna ocurrencia en containers
     * @param {Array<Array<Array<number>>>} containers - Array de ocurrencias contenedoras
     * @param {Array<Array<number>>} cells - Celdas a verificar
     * @returns {boolean} True si todas las celdas están cubiertas por alguna ocurrencia
     */
    function isInsideContainer(containers, cells) {
        for (let i = 0; i < containers.length; i++) {
            if (covers(containers[i], cells)) return true;
        }
        return false;
    }

    /**
     * Comprueba si una selección es "sombra" de otra palabra
     * @param {Array<string>} grid - Rejilla como array de strings
     * @param {Array<string>} words - Lista de palabras (mayúsculas)
     * @param {number} index - Índice de la palabra seleccionada
     * @param {{r1: number, c1: number, r2: number, c2: number}} sel - Selección
     * @returns {boolean} true si la selección es una copia «sombra» (dentro de una palabra más larga) y la palabra tiene otra copia libre
     */
    function isShadowed(grid, words, index, sel) {
        if (!Array.isArray(grid) || !Array.isArray(words) || !words[index]) return false;
        let cells = selectionCells(sel);
        if (!cells) return false;
        let containers = containerOccurrences(grid, words, index);
        if (!isInsideContainer(containers, cells)) return false;
        let own = occurrences(grid, words[index]);
        for (let i = 0; i < own.length; i++) {
            if (!isInsideContainer(containers, own[i])) return true;
        }
        return false;
    }

    let api = {
        occurrences: occurrences,
        selectionCells: selectionCells,
        isShadowed: isShadowed
    };

    root.XiroWordSearchShadow = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
