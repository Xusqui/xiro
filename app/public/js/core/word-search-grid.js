/**
 * @fileoverview Núcleo compartido de la Sopa de letras (word_search) en el navegador:
 * geometría de selecciones, lectura de letras, emparejado con la lista de palabras,
 * HTML de la rejilla e interacción (arrastrar, tocar inicio y final, o teclado).
 *
 * ES5 a propósito: lo cargan jugador, presentador, standalone y tv.html (webOS 3.5).
 * Nada de =>, plantillas, ?. ni ??. Expone window.XiroWordSearch (y module.exports
 * para los tests de Jest).
 */
(function (root) {
    'use strict';

    // Mismos colores que las opciones A-F (rojo, azul, amarillo, verde, ciruela, rosa)
    let WORD_COLORS = ['#dc2626', '#2563eb', '#eab308', '#16a34a', '#94438e', '#ec4899'];
    // Fondos claros: el blanco no contrasta (amarillo ≈ 1,9:1), se escribe en tinta oscura
    let LIGHT_BACKGROUNDS = ['#eab308'];
    let INK_DARK = '#1e293b';
    let INK_LIGHT = '#ffffff';
    let MISS_FLASH_MS = 450;
    let ARROW_STEPS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

    function sign(n) {
        return n > 0 ? 1 : (n < 0 ? -1 : 0);
    }

    /** Celdas [r, c] de una línea recta (8 direcciones), o null si no es recta */
    function cellsBetween(r1, c1, r2, c2) {
        let dr = r2 - r1;
        let dc = c2 - c1;
        if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
        let steps = Math.max(Math.abs(dr), Math.abs(dc));
        let cells = [];
        for (let i = 0; i <= steps; i++) {
            cells.push([r1 + sign(dr) * i, c1 + sign(dc) * i]);
        }
        return cells;
    }

    /** Celdas de una palabra colocada {word,row,col,dr,dc} */
    function placementCells(p) {
        let last = p.word.length - 1;
        return cellsBetween(p.row, p.col, p.row + p.dr * last, p.col + p.dc * last);
    }

    /**
     * Ajusta el final de un arrastre a la dirección válida más cercana (múltiplo de 45°)
     * sin salirse de la rejilla. Devuelve [r, c].
     */
    function snapEnd(r1, c1, r2, c2, size) {
        let dr = r2 - r1;
        let dc = c2 - c1;
        if (dr === 0 && dc === 0) return [r1, c1];
        let octant = Math.round(Math.atan2(dr, dc) / (Math.PI / 4));
        let stepR = Math.round(Math.sin(octant * Math.PI / 4));
        let stepC = Math.round(Math.cos(octant * Math.PI / 4));
        let len = (stepR !== 0 && stepC !== 0)
            ? Math.round((Math.abs(dr) + Math.abs(dc)) / 2)
            : Math.max(Math.abs(dr), Math.abs(dc));
        while (len > 0) {
            let er = r1 + stepR * len;
            let ec = c1 + stepC * len;
            if (er >= 0 && er < size && ec >= 0 && ec < size) return [er, ec];
            len--;
        }
        return [r1, c1];
    }

    function readCells(grid, cells) {
        let letters = '';
        for (let i = 0; i < cells.length; i++) {
            letters += grid[cells[i][0]].charAt(cells[i][1]);
        }
        return letters;
    }

    function reverse(text) {
        return text.split('').reverse().join('');
    }

    /** Índice de la palabra (aún no encontrada) que forman las letras en cualquier sentido, o -1 */
    function matchWord(words, foundFlags, letters) {
        let backwards = reverse(letters);
        for (let i = 0; i < words.length; i++) {
            if (!foundFlags[i] && (words[i] === letters || words[i] === backwards)) return i;
        }
        return -1;
    }

    function colorFor(index) {
        return WORD_COLORS[index % WORD_COLORS.length];
    }

    /** Color de texto legible sobre `background` */
    function inkFor(background) {
        return LIGHT_BACKGROUNDS.indexOf(background) !== -1 ? INK_DARK : INK_LIGHT;
    }

    /** Estilo inline (fondo + texto) de la palabra `index` ya encontrada */
    function chipStyle(index) {
        let color = colorFor(index);
        return 'background-color:' + color + ';color:' + inkFor(color);
    }

    function escapeText(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * HTML de la rejilla: filas .wsg-row con celdas .wsg-cell (data-r, data-c).
     * Roles ARIA de rejilla para lectores de pantalla.
     */
    function gridHtml(grid, extraClass, label) {
        let html = '<div class="wsg' + (extraClass ? ' ' + extraClass : '') + '" data-size="' + grid.length +
            '" role="grid" aria-label="' + escapeText(label || 'Sopa de letras').replace(/"/g, '&quot;') + '">';
        for (let r = 0; r < grid.length; r++) {
            html += '<div class="wsg-row" role="row">';
            for (let c = 0; c < grid[r].length; c++) {
                html += '<span class="wsg-cell" role="gridcell" data-r="' + r + '" data-c="' + c + '">' + escapeText(grid[r].charAt(c)) + '</span>';
            }
            html += '</div>';
        }
        return html + '</div>';
    }

    let BULB_SVG = '<svg class="ws-bulb" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"></path></svg>';

    /**
     * HTML de la lista de palabras. Sin `hintLabel`: fichas (contenedor con role="list").
     * Con `hintLabel`: cada palabra es un botón que pide pista (aria-label "<hintLabel> <PALABRA>").
     */
    function chipsHtml(words, hintLabel) {
        let html = '';
        for (let i = 0; i < words.length; i++) {
            if (hintLabel) {
                html += '<button type="button" class="ws-word ws-word--hint" data-word-index="' + i + '" aria-label="' +
                    escapeText(hintLabel + ' ' + words[i]).replace(/"/g, '&quot;') + '">' + escapeText(words[i]) + BULB_SVG + '</button>';
            } else {
                html += '<span class="ws-word" role="listitem" data-word-index="' + i + '">' + escapeText(words[i]) + '</span>';
            }
        }
        return html;
    }

    /** Pista recibida: resalta la casilla donde empieza la palabra y marca su ficha */
    function markHint(board, chipsContainer, index, cell) {
        let el = cellAt(board, cell);
        if (el) el.className += ' wsg-hint';
        let chip = chipsContainer.querySelector('[data-word-index="' + index + '"]');
        if (chip) chip.className += ' is-hinted';
    }

    function cellAt(container, cell) {
        return container.querySelector('.wsg-cell[data-r="' + cell[0] + '"][data-c="' + cell[1] + '"]');
    }

    /** Pinta las celdas de una palabra encontrada dentro de `container` */
    function paintCells(container, cells, color, className) {
        for (let i = 0; i < cells.length; i++) {
            let el = cellAt(container, cells[i]);
            if (!el) continue;
            el.className += ' ' + (className || 'wsg-found');
            el.style.backgroundColor = color;
            el.style.color = inkFor(color);
        }
    }

    /** Marca la ficha de la palabra `index` (dentro de `container`) como encontrada */
    function paintChip(container, index) {
        let chip = container.querySelector('.ws-word[data-word-index="' + index + '"]');
        if (!chip) return;
        let color = colorFor(index);
        chip.className += ' is-found';
        chip.style.backgroundColor = color;
        chip.style.color = inkFor(color);
        // El tachado y el color no los anuncia un lector de pantalla
        chip.setAttribute('aria-label', chip.textContent + ' ✓');
    }

    /** Deja `className` solo en `cells` (o en ninguna) */
    function markCells(board, className, cells) {
        let old = board.querySelectorAll('.' + className);
        for (let i = 0; i < old.length; i++) old[i].classList.remove(className);
        for (let j = 0; cells && j < cells.length; j++) {
            let el = cellAt(board, cells[j]);
            if (el) el.classList.add(className);
        }
    }

    function cellFromPoint(x, y) {
        let el = document.elementFromPoint(x, y);
        if (!el || !el.classList || !el.classList.contains('wsg-cell')) return null;
        return [Number(el.getAttribute('data-r')), Number(el.getAttribute('data-c'))];
    }

    function sameCell(a, b) {
        return a[0] === b[0] && a[1] === b[1];
    }

    // ===== Interacción (estado compartido por los manejadores de bindSelection) =====

    /** Comprueba la selección de `a` a `b`; si forma una palabra pendiente, la marca */
    function tryPair(state, a, b) {
        let cells = cellsBetween(a[0], a[1], b[0], b[1]);
        let opts = state.opts;
        let index = cells ? matchWord(opts.words, opts.getFoundFlags(), readCells(opts.grid, cells)) : -1;
        if (index === -1) {
            markCells(state.board, 'wsg-miss', cells || [a, b]);
            setTimeout(function () { markCells(state.board, 'wsg-miss', []); }, MISS_FLASH_MS);
            return;
        }
        paintCells(state.board, cells, colorFor(index));
        opts.onFound({ r1: a[0], c1: a[1], r2: b[0], c2: b[1], index: index }, cells, index);
    }

    /** Toque (o Enter): el primero fija el inicio; el segundo, el final */
    function onTap(state, cell) {
        if (state.anchor && !sameCell(state.anchor, cell)) {
            let first = state.anchor;
            state.anchor = null;
            markCells(state.board, 'wsg-anchor', []);
            tryPair(state, first, cell);
            return;
        }
        state.anchor = state.anchor ? null : cell;
        markCells(state.board, 'wsg-anchor', state.anchor ? [state.anchor] : []);
    }

    function onPointerDown(state, e) {
        let cell = cellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        e.preventDefault();
        state.start = cell;
        state.end = cell;
        state.moved = false;
        if (state.board.setPointerCapture) state.board.setPointerCapture(e.pointerId);
        markCells(state.board, 'wsg-sel', [cell]);
    }

    function onPointerMove(state, e) {
        if (!state.start) return;
        let cell = cellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        let snapped = snapEnd(state.start[0], state.start[1], cell[0], cell[1], state.opts.grid.length);
        if (sameCell(snapped, state.end)) return;
        state.end = snapped;
        state.moved = true;
        markCells(state.board, 'wsg-sel', cellsBetween(state.start[0], state.start[1], snapped[0], snapped[1]));
    }

    function onPointerUp(state) {
        if (!state.start) return;
        let from = state.start;
        let to = state.end;
        state.start = null;
        markCells(state.board, 'wsg-sel', []);
        if (!state.moved) {
            onTap(state, from);
            return;
        }
        state.anchor = null;
        markCells(state.board, 'wsg-anchor', []);
        tryPair(state, from, to);
    }

    function onPointerCancel(state) {
        state.start = null;
        markCells(state.board, 'wsg-sel', []);
    }

    /** Teclado: flechas mueven el cursor; Enter o Espacio marcan inicio y final */
    function onKeyDown(state, e) {
        let size = state.opts.grid.length;
        let step = ARROW_STEPS[e.key];
        if (step) {
            e.preventDefault();
            let r = Math.min(size - 1, Math.max(0, state.cursor[0] + step[0]));
            let c = Math.min(size - 1, Math.max(0, state.cursor[1] + step[1]));
            state.cursor = [r, c];
            markCells(state.board, 'wsg-cursor', [state.cursor]);
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTap(state, state.cursor);
        }
    }

    /**
     * Interacción de selección (jugador y standalone): arrastrar de la primera a la
     * última letra, tocar la primera y luego la última, o el mismo par con el teclado.
     * @param {Element} board - contenedor de la rejilla
     * @param {{grid: string[], words: string[], getFoundFlags: Function, onFound: Function}} opts
     *   onFound(selection {r1,c1,r2,c2,index}, cells, index) al acertar una palabra pendiente
     */
    function bindSelection(board, opts) {
        let state = { board: board, opts: opts, start: null, end: null, moved: false, anchor: null, cursor: [0, 0] };
        board.setAttribute('tabindex', '0');
        board.addEventListener('pointerdown', function (e) { onPointerDown(state, e); });
        board.addEventListener('pointermove', function (e) { onPointerMove(state, e); });
        board.addEventListener('pointerup', function () { onPointerUp(state); });
        board.addEventListener('pointercancel', function () { onPointerCancel(state); });
        board.addEventListener('keydown', function (e) { onKeyDown(state, e); });
        board.addEventListener('focus', function () { markCells(board, 'wsg-cursor', [state.cursor]); });
        board.addEventListener('blur', function () { markCells(board, 'wsg-cursor', []); });
    }

    let api = {
        WORD_COLORS: WORD_COLORS,
        cellsBetween: cellsBetween,
        placementCells: placementCells,
        snapEnd: snapEnd,
        readCells: readCells,
        matchWord: matchWord,
        colorFor: colorFor,
        inkFor: inkFor,
        chipStyle: chipStyle,
        gridHtml: gridHtml,
        chipsHtml: chipsHtml,
        paintCells: paintCells,
        paintChip: paintChip,
        markHint: markHint,
        bindSelection: bindSelection
    };

    root.XiroWordSearch = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
