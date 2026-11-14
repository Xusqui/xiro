/**
 * @fileoverview Atajos de teclado del editor de diapositivas libres. Actúan sobre toda la
 * selección (slides-canvas-selection.js) y solo con el editor abierto y sin foco en un campo.
 * preventDefault marca la tecla como usada: así Escape deselecciona en vez de cerrar el editor.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const EDITABLE = 'input, textarea, select, [contenteditable="true"]';
    const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    let listening = false;

    /** Ctrl/Cmd + tecla, o null. Deshacer, rehacer, seleccionar todo y pegar no piden selección. */
    function modifierAction(event, count) {
        const key = event.key.toLowerCase();
        if (key === 'z') return event.shiftKey ? E.redo : E.undo;
        if (key === 'y') return E.redo;
        if (key === 'a') return E.selectAll;
        if (key === 'v') return E.hasClipboard() ? E.pasteClipboard : null;
        if (!count) return null;
        if (key === 'c') return E.copySelection;
        if (key === 'd') return E.duplicateSelection;
        if (key === 'g') return event.shiftKey ? E.ungroupSelection : E.groupSelection;
        // Ctrl+L a secas es la barra de direcciones del navegador
        if (key === 'l' && event.shiftKey) return E.toggleLockSelection;
        return null;
    }

    /** Tecla sin modificador sobre la selección, o null. */
    function plainAction(event) {
        const key = event.key;
        if (key === 'Delete' || key === 'Backspace') return E.removeSelection;
        if (ARROWS[key]) {
            const step = event.shiftKey ? 10 : 1;
            return () => E.moveSelectionBy(ARROWS[key][0] * step, ARROWS[key][1] * step);
        }
        if (key === 'Escape') return () => E.select(null);
        const el = E.getSelected();
        if (key === 'Enter' && el && el.type === 'text') return () => E.setMode('editing');
        if (key === 'Enter' && el && el.type === 'table' && E.tableCellEdit) return () => E.tableCellEdit.openAt(0, 0);
        return null;
    }

    function onKeyDown(event) {
        if (!E.pointer.isAttached() || !document.getElementById('modalLienzo')) return;
        if (document.getElementById('modalLienzoMedia')) return;
        if (event.target && event.target.closest && event.target.closest(EDITABLE)) return;
        const count = E.getSelectedIds().length;
        let action = null;
        if (event.ctrlKey || event.metaKey) action = modifierAction(event, count);
        else if (count) action = plainAction(event);
        if (!action) return;
        event.preventDefault();
        action();
    }

    E.keys = {
        /** Engancha el teclado una sola vez por página (el editor se abre muchas veces). */
        listen() {
            if (listening) return;
            listening = true;
            document.addEventListener('keydown', onKeyDown);
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.keys;
})();
