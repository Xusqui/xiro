/**
 * @fileoverview Fase A del editor de diapositivas libres: selección múltiple, grupos,
 * bloqueo, alinear y distribuir, mover en bloque y portapapeles de elementos.
 *
 * La selección vive en state.selectedIds; state.selectedId solo tiene valor cuando hay un
 * único elemento, así que los paneles de un solo elemento (props, textbar) siguen igual.
 * Seleccionar un miembro de un grupo selecciona el grupo entero (expandToGroups).
 * Cada operación hace un único commit: un solo paso de deshacer.
 *
 * El portapapeles es memoria de la página, no el del sistema: el del sistema exige permisos
 * y es asíncrono, y aquí solo se copia entre diapositivas del mismo editor.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const PASTE_OFFSET = 40;
    const MAX_PASTE_STEPS = 25;
    let clipboard = null;

    const model = () => root.XiroSlideCanvas;
    const align = () => root.XiroSlideCanvasAlign;
    const elements = () => E.state.canvas.elements;
    const idsOf = list => list.map(el => el.id);
    const groupIdsInUse = () => elements().map(el => el.groupId).filter(Boolean);

    function selectedElements() {
        const ids = E.getSelectedIds();
        return elements().filter(el => ids.indexOf(el.id) >= 0);
    }

    /**
     * Ids seleccionados que aún existen (deshacer puede haber borrado alguno).
     * @returns {Array<string>}
     */
    E.getSelectedIds = function () {
        const state = E.state;
        const ids = state.selectedIds || (state.selectedId ? [state.selectedId] : []);
        return ids.filter(id => E.getElement(id));
    };

    /**
     * Selecciona varios elementos (ampliados a sus grupos).
     * @param {Array<string>} ids - Ids a seleccionar; vacío deselecciona.
     */
    E.selectMany = function (ids) {
        const wanted = align().expandToGroups(elements(), ids || []);
        E.state.selectedIds = wanted;
        E.state.selectedId = wanted.length === 1 ? wanted[0] : null;
        E.state.mode = wanted.length ? 'selected' : 'idle';
        E.render();
    };

    /**
     * Añade o quita un elemento (y su grupo) de la selección, como Mayús+clic.
     * @param {string} id - Elemento pulsado.
     */
    E.toggleSelection = function (id) {
        const current = E.getSelectedIds();
        const group = align().expandToGroups(elements(), [id]);
        const removing = current.indexOf(id) >= 0;
        E.selectMany(removing ? current.filter(x => group.indexOf(x) < 0) : current.concat(group));
    };

    /** Selecciona todos los elementos del lienzo. */
    E.selectAll = function () {
        E.selectMany(idsOf(elements()));
    };

    /**
     * Sustituye los seleccionados que cumplen `filter` por copias cambiadas y normalizadas,
     * en un solo commit. Nunca muta: como updateElement, quien guarde una referencia no la ve cambiar.
     */
    function patchSelected(filter, change) {
        const ids = E.getSelectedIds();
        let touched = 0;
        E.state.canvas.elements = elements().map(el => {
            if (ids.indexOf(el.id) < 0 || !filter(el)) return el;
            touched++;
            return model().normalizeElement(change(Object.assign({}, el)));
        });
        if (touched) E.commit();
    }

    const always = () => true;

    /** Da un groupId común a la selección (hacen falta dos o más). */
    E.groupSelection = function () {
        if (selectedElements().length < 2) return;
        const groupId = model().newGroupId(groupIdsInUse());
        patchSelected(always, el => Object.assign(el, { groupId }));
    };

    /** Quita el grupo a los elementos seleccionados. */
    E.ungroupSelection = function () {
        patchSelected(
            el => !!el.groupId,
            el => Object.assign(el, { groupId: undefined })
        );
    };

    /** Si todo está bloqueado, desbloquea; si no, bloquea toda la selección. */
    E.toggleLockSelection = function () {
        const lock = selectedElements().some(el => !el.locked);
        patchSelected(always, el => Object.assign(el, { locked: lock }));
    };

    function replaceElements(next) {
        E.state.canvas.elements = next;
        E.commit();
    }

    /** @param {string} mode - left | centerH | right | top | middleV | bottom */
    E.alignSelection = function (mode) {
        replaceElements(align().alignElements(elements(), E.getSelectedIds(), mode));
    };

    /** @param {string} axis - 'h' o 'v' */
    E.distributeSelection = function (axis) {
        replaceElements(align().distributeElements(elements(), E.getSelectedIds(), axis));
    };

    /**
     * Mueve los seleccionados no bloqueados (flechas y arrastre en bloque).
     * @param {number} dx - Desplazamiento lógico X.
     * @param {number} dy - Desplazamiento lógico Y.
     */
    E.moveSelectionBy = function (dx, dy) {
        if (!dx && !dy) return;
        patchSelected(
            el => !el.locked,
            el => Object.assign(el, { x: el.x + dx, y: el.y + dy })
        );
    };

    /** Elimina todos los elementos seleccionados. */
    E.removeSelection = function () {
        const ids = E.getSelectedIds();
        if (!ids.length) return;
        E.state.canvas.elements = elements().filter(el => ids.indexOf(el.id) < 0);
        E.select(null);
        E.commit();
    };

    /** Primer desplazamiento (0, 40, 80…) en el que la copia no tapa a un elemento igual de sitio. */
    function freeOffset(source) {
        const first = source[0];
        const taken = n => elements().some(el => el.x === first.x + n && el.y === first.y + n);
        let steps = 0;
        while (steps < MAX_PASTE_STEPS && taken(steps * PASTE_OFFSET)) steps++;
        return steps * PASTE_OFFSET;
    }

    /** Copias con ids y grupos nuevos (los miembros de un grupo comparten el grupo nuevo). */
    function cloneWithNewIds(source, offset) {
        const ids = idsOf(elements());
        const groups = groupIdsInUse();
        const renamed = {};
        return source.map(original => {
            const copy = JSON.parse(JSON.stringify(original));
            copy.id = model().newId(ids);
            ids.push(copy.id);
            if (copy.groupId) {
                if (!renamed[copy.groupId]) renamed[copy.groupId] = model().newGroupId(groups.concat(Object.values(renamed)));
                copy.groupId = renamed[copy.groupId];
            }
            copy.x += offset;
            copy.y += offset;
            return model().normalizeElement(copy);
        });
    }

    function warnFull() {
        if (typeof root.mostrarModalError === 'function' && E.th) root.mostrarModalError(E.th('paste_full'));
    }

    function insertCopies(source) {
        if (!source.length) return;
        if (elements().length + source.length > model().MAX_ELEMENTS) {
            warnFull();
            return;
        }
        const copies = cloneWithNewIds(source, freeOffset(source));
        copies.forEach(copy => elements().push(copy));
        E.selectMany(idsOf(copies));
        E.commit();
    }

    /** Guarda una copia de la selección para pegarla aquí o en otra diapositiva. */
    E.copySelection = function () {
        const list = selectedElements();
        if (!list.length) return;
        clipboard = JSON.parse(JSON.stringify(list));
        // Repinta para que la barra habilite «Pegar»
        E.render();
    };

    /** Pega el portapapeles, desplazado si taparía a los originales. */
    E.pasteClipboard = function () {
        if (clipboard) insertCopies(clipboard);
    };

    /** Duplica la selección sin tocar el portapapeles; un solo elemento queda encima del original. */
    E.duplicateSelection = function () {
        const list = selectedElements();
        if (list.length === 1 && !list[0].groupId) E.duplicateSelected();
        else insertCopies(list);
    };

    E.clearClipboard = function () {
        clipboard = null;
        E.render();
    };

    /** @returns {boolean} Si hay algo que pegar. */
    E.hasClipboard = function () {
        return !!clipboard;
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E;
})();
