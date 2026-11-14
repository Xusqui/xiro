/**
 * @fileoverview Alinear, distribuir y agrupar elementos del lienzo libre (fase A del editor).
 *
 * Funciones puras: reciben el array `elements` del lienzo y devuelven uno nuevo con las
 * posiciones cambiadas; nunca mutan la entrada, para que el historial del editor guarde
 * instantáneas limpias. Los elementos con `locked: true` cuentan para el contorno común
 * pero no se mueven. Las cajas se toman sin rotación (x, y, w, h), igual que las guías.
 * ES5 a propósito, como el resto de core/slide-canvas-*.js.
 * Expone window.XiroSlideCanvasAlign y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    const ALIGN_MODES = ['left', 'centerH', 'right', 'top', 'middleV', 'bottom'];

    function cloneAll(elements) {
        return JSON.parse(JSON.stringify(elements || []));
    }

    function pickSelected(list, ids) {
        return list.filter(function (el) {
            return ids.indexOf(el.id) >= 0;
        });
    }

    /** Contorno común (sin rotación) de una lista de elementos. */
    function boundsOf(list) {
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (let i = 0; i < list.length; i++) {
            left = Math.min(left, list[i].x);
            top = Math.min(top, list[i].y);
            right = Math.max(right, list[i].x + list[i].w);
            bottom = Math.max(bottom, list[i].y + list[i].h);
        }
        return { left: left, top: top, right: right, bottom: bottom };
    }

    /** Nueva posición de un elemento para el modo dado dentro del contorno. */
    function alignedPosition(el, b, mode) {
        if (mode === 'left') return { x: b.left, y: el.y };
        if (mode === 'right') return { x: b.right - el.w, y: el.y };
        if (mode === 'centerH') return { x: Math.round((b.left + b.right - el.w) / 2), y: el.y };
        if (mode === 'top') return { x: el.x, y: b.top };
        if (mode === 'bottom') return { x: el.x, y: b.bottom - el.h };
        return { x: el.x, y: Math.round((b.top + b.bottom - el.h) / 2) };
    }

    /**
     * Alinea los elementos seleccionados a su contorno común.
     * @param {Array<Object>} elements - Elementos del lienzo.
     * @param {Array<string>} ids - Ids seleccionados (hacen falta dos o más).
     * @param {string} mode - left | centerH | right | top | middleV | bottom.
     * @returns {Array<Object>} Copia de `elements` con las posiciones nuevas.
     */
    function alignElements(elements, ids, mode) {
        const out = cloneAll(elements);
        const selected = pickSelected(out, ids || []);
        if (selected.length < 2 || ALIGN_MODES.indexOf(mode) < 0) return out;
        const b = boundsOf(selected);
        for (let i = 0; i < selected.length; i++) {
            if (selected[i].locked) continue;
            const pos = alignedPosition(selected[i], b, mode);
            selected[i].x = pos.x;
            selected[i].y = pos.y;
        }
        return out;
    }

    /**
     * Reparte los elementos con huecos iguales entre el primero y el último del eje.
     * @param {Array<Object>} elements - Elementos del lienzo.
     * @param {Array<string>} ids - Ids seleccionados (hacen falta tres o más).
     * @param {string} axis - 'h' (horizontal) o 'v' (vertical).
     * @returns {Array<Object>} Copia de `elements` con las posiciones nuevas.
     */
    function distributeElements(elements, ids, axis) {
        const out = cloneAll(elements);
        const selected = pickSelected(out, ids || []);
        if (selected.length < 3 || (axis !== 'h' && axis !== 'v')) return out;
        const pos = axis === 'h' ? 'x' : 'y';
        const size = axis === 'h' ? 'w' : 'h';
        selected.sort(function (a, b) {
            return a[pos] - b[pos];
        });
        const first = selected[0];
        const last = selected[selected.length - 1];
        let used = 0;
        for (let i = 0; i < selected.length; i++) used += selected[i][size];
        const gap = (last[pos] + last[size] - first[pos] - used) / (selected.length - 1);
        let cursor = first[pos] + first[size] + gap;
        for (let j = 1; j < selected.length - 1; j++) {
            if (!selected[j].locked) selected[j][pos] = Math.round(cursor);
            cursor += selected[j][size] + gap;
        }
        return out;
    }

    /**
     * Amplía una selección a todos los miembros de los grupos tocados.
     * @param {Array<Object>} elements - Elementos del lienzo.
     * @param {Array<string>} ids - Ids seleccionados.
     * @returns {Array<string>} Ids existentes, con los compañeros de grupo añadidos.
     */
    function expandToGroups(elements, ids) {
        const list = elements || [];
        const wanted = ids || [];
        const groups = [];
        const result = [];
        for (let i = 0; i < list.length; i++) {
            if (wanted.indexOf(list[i].id) >= 0 && list[i].groupId) groups.push(list[i].groupId);
        }
        for (let j = 0; j < list.length; j++) {
            const el = list[j];
            if (wanted.indexOf(el.id) >= 0 || (el.groupId && groups.indexOf(el.groupId) >= 0)) result.push(el.id);
        }
        return result;
    }

    /**
     * Ids de los elementos cuya caja (sin giro) cabe entera en el marco de selección.
     * @param {Array<Object>} elements - Elementos del lienzo.
     * @param {{x:number,y:number,w:number,h:number}} rect - Marco; w y h pueden ser negativos.
     * @returns {Array<string>} Ids en el orden de `elements`.
     */
    function idsInsideRect(elements, rect) {
        const left = Math.min(rect.x, rect.x + rect.w);
        const top = Math.min(rect.y, rect.y + rect.h);
        const right = Math.max(rect.x, rect.x + rect.w);
        const bottom = Math.max(rect.y, rect.y + rect.h);
        return (elements || [])
            .filter(function (el) {
                return el.x >= left && el.y >= top && el.x + el.w <= right && el.y + el.h <= bottom;
            })
            .map(function (el) {
                return el.id;
            });
    }

    const api = {
        ALIGN_MODES: ALIGN_MODES,
        boundsOf: boundsOf,
        idsInsideRect: idsInsideRect,
        alignElements: alignElements,
        distributeElements: distributeElements,
        expandToGroups: expandToGroups
    };

    root.XiroSlideCanvasAlign = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
