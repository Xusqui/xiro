/**
 * @fileoverview Escribir en las celdas de una tabla directamente en el lienzo (fase D): un
 * textarea encima de la celda, con la fuente, el color, la alineación y el fondo de la tabla.
 * Como en el texto (slides-canvas-textedit.js), cada tecla se guarda sin historial y cada celda
 * terminada es un paso de deshacer.
 *
 * Teclas: Intro es un salto de línea dentro de la celda (las celdas lo admiten); Tab y
 * Mayús+Tab pasan a la celda siguiente o anterior, y Tab en la última añade una fila; Escape o
 * pulsar fuera terminan. Las celdas son texto plano: el valor entra por .value, nunca como HTML.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    // Caja (con el giro) del elemento pintado y estilo de texto de su tabla
    const BOX_KEYS = ['left', 'top', 'width', 'height', 'transform', 'webkitTransform'];
    const TEXT_KEYS = ['fontFamily', 'fontSize', 'color', 'textAlign'];

    let editingId = null;
    let target = [0, 0];
    let frame = null;
    let input = null;

    function rowsOf() {
        const el = E.getElement(editingId);
        return el ? el.props.rows : null;
    }

    /** Quita el cuadro sin terminar la edición (sin blur: no cerraría la celda siguiente). */
    function close() {
        if (!frame) return;
        input.removeEventListener('blur', finish);
        frame.remove();
        frame = null;
        input = null;
    }

    function finish() {
        if (!editingId) return;
        close();
        editingId = null;
        target = [0, 0];
        E.setMode('selected');
        E.commit();
    }

    function save() {
        const rows = rowsOf();
        if (!rows || !input) return;
        const next = E.tableEdit.setCell(rows, target[0], target[1], input.value);
        E.updateElement(editingId, { props: { rows: next }, silent: true });
    }

    /** Celda siguiente (o anterior); null si Tab sale de la última. */
    function step(rows, back) {
        const cols = rows[0].length;
        const index = target[0] * cols + target[1] + (back ? -1 : 1);
        if (index < 0) return [0, 0];
        if (index >= rows.length * cols) return null;
        return [Math.floor(index / cols), index % cols];
    }

    /** Tab: guarda la celda (un paso de deshacer) y abre la otra al repintar la tabla. */
    function moveTo(back) {
        const id = editingId;
        const rows = rowsOf();
        if (!rows) return finish();
        const next = step(rows, back);
        E.commit();
        close();
        if (next) {
            target = next;
            return E.render();
        }
        const grown = E.tableEdit.addRow(rows);
        if (grown.length > rows.length) target = [rows.length, 0];
        E.updateElement(id, { props: { rows: grown } });
    }

    function onKeyDown(event) {
        // Las teclas son de la celda, no de los atajos del editor
        event.stopPropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            finish();
        } else if (event.key === 'Tab') {
            event.preventDefault();
            moveTo(event.shiftKey);
        }
    }

    function cellNode(elementNode) {
        const table = elementNode ? elementNode.querySelector('table.xsc-table') : null;
        const row = table ? table.rows[target[0]] : null;
        return row ? row.cells[target[1]] : null;
    }

    /** El cuadro ocupa la celda pintada y la tapa: la celda deja de verse mientras se escribe. */
    function matchCell(node, cell) {
        const table = cell.closest('table');
        node.style.left = cell.offsetLeft + 'px';
        node.style.top = cell.offsetTop + 'px';
        node.style.width = cell.offsetWidth + 'px';
        node.style.height = cell.offsetHeight + 'px';
        TEXT_KEYS.forEach(key => (node.style[key] = table.style[key]));
        node.style.backgroundColor = cell.style.backgroundColor || 'transparent';
        if (cell.tagName === 'TH') node.classList.add('xsce-celledit--head');
        cell.style.color = 'transparent';
    }

    function createInput(text, cell) {
        const node = document.createElement('textarea');
        node.className = 'xsce-celledit';
        node.maxLength = root.XiroSlideCanvasTable.MAX_CELL;
        node.setAttribute('spellcheck', 'true');
        node.setAttribute('aria-label', E.t('table.cell_label', { r: target[0] + 1, c: target[1] + 1 }));
        node.value = text;
        if (cell) matchCell(node, cell);
        return node;
    }

    function openFrame(elementNode) {
        const node = document.createElement('div');
        node.className = 'xsce-celledit-frame';
        if (elementNode) BOX_KEYS.forEach(key => (node.style[key] = elementNode.style[key]));
        return node;
    }

    E.tableCellEdit = {
        /**
         * Abre la celda pedida (por defecto la primera) de una tabla; lo llama el escenario al repintar.
         * @param {Object} el - Elemento de tabla.
         * @param {HTMLElement} overlay - Capa del escenario donde va el cuadro.
         * @param {HTMLElement|null} elementNode - Nodo pintado del elemento.
         */
        start(el, overlay, elementNode) {
            const rows = el.props.rows;
            editingId = el.id;
            target = [Math.min(target[0], rows.length - 1), Math.min(target[1], rows[0].length - 1)];
            frame = openFrame(elementNode);
            input = createInput(rows[target[0]][target[1]], cellNode(elementNode));
            frame.appendChild(input);
            overlay.appendChild(frame);
            input.addEventListener('input', save);
            input.addEventListener('keydown', onKeyDown);
            input.addEventListener('blur', finish);
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        },
        /**
         * Doble clic: si es sobre una celda de una tabla, la abre.
         * @param {EventTarget} node - Nodo pulsado.
         * @returns {boolean} Si era una celda.
         */
        openFromCell(node) {
            const cell = node && node.closest ? node.closest('.xsc-el--table td, .xsc-el--table th') : null;
            if (!cell) return false;
            const id = cell.closest('.xsc-el').getAttribute('data-el-id');
            target = [cell.parentNode.rowIndex, cell.cellIndex];
            E.select(id);
            E.setMode('editing');
            return true;
        },
        /** Abre la celda (r, c) de la tabla seleccionada (Intro abre la primera). */
        openAt(r, c) {
            target = [r, c];
            E.setMode('editing');
        },
        /** @returns {boolean} Si hay una celda abierta en esa capa. */
        isOpenIn: overlay => !!(frame && overlay && overlay.contains(frame)),
        isEditing: () => editingId !== null,
        /** Termina la edición y guarda un paso de deshacer. */
        finish,
        reset() {
            close();
            editingId = null;
            target = [0, 0];
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.tableCellEdit;
})();
