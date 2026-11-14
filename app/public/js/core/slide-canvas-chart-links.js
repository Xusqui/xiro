/**
 * @fileoverview Vínculos gráfico → tabla de la diapositiva libre (fase E2): qué tabla viaja con un gráfico
 * al copiar, cómo se reenlazan las copias al pegar o duplicar, qué gráficos se quedan sin datos al borrar una tabla
 * y qué elementos ocultos se quitan antes de enviar el lienzo a los móviles. Funciones puras; las usan el editor
 * (admin/modules/slides-canvas-selection.js) y services/payload.sanitizer.js.
 */
(function (root) {
    'use strict';

    /**
     * Obtiene el ID de tabla de un elemento gráfico.
     * @param {Object} el - Elemento del lienzo.
     * @returns {string} ID de tabla o cadena vacía.
     */
    function tableIdOf(el) {
        if (!el || !el.props || !el.props.source) return '';
        return el.props.source.tableId || '';
    }

    /**
     * Devuelve los elementos seleccionados más las tablas vinculadas a gráficos seleccionados.
     * @param {Array} selected - Elementos seleccionados.
     * @param {Array} all - Todos los elementos del lienzo.
     * @returns {Object} Objeto con elements y carried.
     */
    function withLinkedTables(selected, all) {
        const result = [];
        const carried = [];
        const selectedIds = {};
        const wanted = {};

        // Marcar los elementos seleccionados
        for (let i = 0; i < selected.length; i++) {
            selectedIds[selected[i].id] = true;
        }

        // Construir mapa de tablas deseadas (solo de los seleccionados)
        for (let j = 0; j < selected.length; j++) {
            const el = selected[j];
            if (el.type === 'chart') {
                const tid = tableIdOf(el);
                if (tid) wanted[tid] = true;
            }
        }

        // Procesar todos los elementos
        for (let k = 0; k < all.length; k++) {
            const el = all[k];
            if (selectedIds[el.id]) {
                result.push(el);
            } else if (el.type === 'table' && wanted[el.id]) {
                carried.push(el.id);
                result.push(el);
            }
        }

        return { elements: result, carried: carried };
    }

    /**
     * Elimina elementos de un portapapeles si están en carried y targetIds.
     * @param {Array} clip - Elementos del portapapeles.
     * @param {Array} carried - IDs de tablas arrastradas.
     * @param {Array} targetIds - IDs de elementos en el destino.
     * @returns {Array} Nuevo array filtrado.
     */
    function pasteSource(clip, carried, targetIds) {
        const targetSet = {};
        for (let i = 0; i < targetIds.length; i++) {
            targetSet[targetIds[i]] = true;
        }

        const result = [];
        for (let j = 0; j < clip.length; j++) {
            const el = clip[j];
            if (el.type === 'table' && carried.indexOf(el.id) !== -1 && targetSet[el.id]) continue;
            result.push(el);
        }
        return result;
    }

    /**
     * Reenlaza gráficos copiados con las nuevas tablas.
     * @param {Array} source - Elementos originales.
     * @param {Array} copies - Copias de los elementos.
     * @param {Array} targetIds - IDs de elementos en el destino.
     * @returns {Array} Las copias actualizadas.
     */
    function relink(source, copies, targetIds) {
        const sourceMap = {};
        for (let i = 0; i < source.length; i++) {
            sourceMap[source[i].id] = i;
        }

        for (let j = 0; j < copies.length; j++) {
            const copy = copies[j];
            if (copy.type !== 'chart') continue;

            const tid = tableIdOf(copy);
            if (!tid) continue;

            // Si el original de la tabla existe, usar su ID
            if (sourceMap[tid] !== undefined && source[sourceMap[tid]].type === 'table') {
                copy.props.source.tableId = copies[sourceMap[tid]].id;
            } else if (targetIds.indexOf(tid) !== -1) {
                // Si la tabla está en el destino, mantenerla
                continue;
            } else {
                // De lo contrario, desvincular
                copy.props.source.tableId = '';
            }
        }

        return copies;
    }

    /**
     * Encuentra los gráficos que dependen de tablas eliminadas.
     * @param {Array} elements - Todos los elementos del lienzo.
     * @param {Array} removedIds - IDs de elementos eliminados.
     * @returns {Array} IDs de gráficos dependientes.
     */
    function dependentCharts(elements, removedIds) {
        const removed = {};
        for (let i = 0; i < removedIds.length; i++) {
            removed[removedIds[i]] = true;
        }

        const result = [];
        for (let j = 0; j < elements.length; j++) {
            const el = elements[j];
            if (el.type !== 'chart') continue;

            const tid = tableIdOf(el);
            if (tid && !removed[el.id] && removed[tid]) result.push(el.id);
        }

        return result;
    }

    /**
     * Desvincula gráficos cuyas tablas fueron eliminadas.
     * @param {Array} elements - Elementos del lienzo.
     * @param {Array} removedIds - IDs de elementos eliminados.
     * @returns {Array} Elementos actualizados.
     */
    function unlinkRemoved(elements, removedIds) {
        const removed = {};
        for (let i = 0; i < removedIds.length; i++) {
            removed[removedIds[i]] = true;
        }

        for (let j = 0; j < elements.length; j++) {
            const el = elements[j];
            if (el.type !== 'chart') continue;

            const tid = tableIdOf(el);
            if (!tid || !removed[tid]) continue;

            el.props.source.tableId = '';
        }

        return elements;
    }

    /**
     * Elimina elementos ocultos del lienzo, manteniendo tablas vinculadas a gráficos visibles.
     * @param {Object} canvas - Lienzo completo.
     * @returns {Object} Nuevo lienzo sin elementos ocultos.
     */
    function stripHidden(canvas) {
        if (!canvas || !canvas.elements || !Array.isArray(canvas.elements)) return canvas;

        const result = {};
        for (let key in canvas) {
            if (Object.prototype.hasOwnProperty.call(canvas, key)) {
                result[key] = canvas[key];
            }
        }

        const elements = [];
        const fed = {};

        // Primero construir mapa de tablas que deben mantenerse
        for (let i = 0; i < canvas.elements.length; i++) {
            const el = canvas.elements[i];
            if (el.type === 'chart' && !el.hidden) {
                const tid = tableIdOf(el);
                if (tid) fed[tid] = true;
            }
        }

        // Luego procesar todos los elementos en orden
        for (let j = 0; j < canvas.elements.length; j++) {
            const el = canvas.elements[j];
            if (!el.hidden || (el.type === 'table' && fed[el.id])) {
                elements.push(el);
            }
        }

        result.elements = elements;
        return result;
    }

    const api = {
        withLinkedTables: withLinkedTables,
        pasteSource: pasteSource,
        relink: relink,
        dependentCharts: dependentCharts,
        unlinkRemoved: unlinkRemoved,
        stripHidden: stripHidden
    };

    root.XiroSlideCanvasChartLinks = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
