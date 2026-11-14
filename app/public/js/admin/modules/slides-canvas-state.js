/**
 * @fileoverview Estado del editor de diapositivas libres: lienzo abierto, selección de un
 * elemento, historial y operaciones de un solo elemento (añadir, cambiar, borrar, duplicar,
 * capas). La selección múltiple y el portapapeles están en slides-canvas-selection.js.
 */
(function () {
    'use strict';

    // Espacio de nombres compartido por los módulos del editor (scripts clásicos del admin)
    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});
    const E = XiroCanvasEditor;

    if (typeof window.XiroSlideCanvas === 'undefined' && typeof require !== 'undefined') {
        // eslint-disable-next-line no-undef -- solo en Jest (CommonJS)
        window.XiroSlideCanvas = require('../../../core/slide-canvas-model');
    }

    E.state = E.state || {};

    const elements = () => E.state.canvas.elements;

    /** Índice del elemento seleccionado en el array del lienzo, o -1. */
    function selectedIndex() {
        const id = E.state.selectedId;
        return id ? elements().findIndex(el => el.id === id) : -1;
    }

    /**
     * Abre un lienzo para editarlo (null crea uno en blanco).
     * @param {Object|null} canvas - Lienzo guardado.
     * @param {number|null} index - Posición de la diapositiva en el juego.
     */
    E.open = function (canvas, index) {
        E.state.canvas = window.XiroSlideCanvas.normalizeCanvas(canvas) || window.XiroSlideCanvas.createCanvas();
        E.state.selectedId = null;
        E.state.selectedIds = [];
        E.state.multiMode = false;
        E.state.mode = 'idle';
        E.state.index = index;
        E.state.history = E.history.createHistory();
        E.state.history.reset(JSON.stringify(E.state.canvas));
        E.state.dirty = false;
        E.render();
    };

    /** @param {Function} fn - Se llama con el estado tras cada cambio. */
    E.onRender = function (fn) {
        if (!E.state.renderListeners) E.state.renderListeners = [];
        // Sin duplicados: el editor se abre y se cierra muchas veces en la misma página
        if (E.state.renderListeners.indexOf(fn) < 0) E.state.renderListeners.push(fn);
    };

    /** @param {Function} fn - Listener registrado con onRender (al cerrar el editor). */
    E.offRender = function (fn) {
        const list = E.state.renderListeners || [];
        const index = list.indexOf(fn);
        if (index >= 0) list.splice(index, 1);
    };

    E.render = function () {
        (E.state.renderListeners || []).forEach(fn => fn(E.state));
    };

    /** Guarda el lienzo en el historial y repinta. */
    E.commit = function () {
        E.state.history.push(JSON.stringify(E.state.canvas));
        E.state.dirty = true;
        E.render();
    };

    /**
     * @param {string} id - Id del elemento.
     * @returns {Object|null} El elemento (referencia viva) o null.
     */
    E.getElement = function (id) {
        const canvas = E.state.canvas;
        if (!canvas || !canvas.elements) return null;
        return canvas.elements.find(el => el.id === id) || null;
    };

    /** @returns {Object|null} El elemento seleccionado si hay exactamente uno. */
    E.getSelected = function () {
        return E.state.selectedId ? E.getElement(E.state.selectedId) : null;
    };

    /** @param {string|null} id - Elemento a seleccionar (solo él), o null para deseleccionar. */
    E.select = function (id) {
        E.state.selectedId = id;
        E.state.selectedIds = id ? [id] : [];
        E.state.mode = id ? 'selected' : 'idle';
        E.render();
    };

    /** @param {string} mode - 'idle' | 'selected' | 'editing' */
    E.setMode = function (mode) {
        E.state.mode = mode;
        E.render();
    };

    /**
     * Añade un elemento delante de todo y lo selecciona.
     * @param {string} type - text | shape | image | video
     * @param {Object} overrides - Valores iniciales.
     * @returns {Object|null} El elemento creado, o null si el tipo no es válido.
     */
    E.addElement = function (type, overrides) {
        const ids = elements().map(el => el.id);
        const el = window.XiroSlideCanvas.createElement(type, Object.assign({ existingIds: ids }, overrides));
        if (!el) return null;
        elements().push(el);
        E.select(el.id);
        E.commit();
        return el;
    };

    /**
     * Aplica un parche normalizado a un elemento; con `silent` repinta sin guardar historial.
     * @param {string} id - Id del elemento.
     * @param {Object} patch - Campos (props se fusiona) y `silent` opcional.
     */
    E.updateElement = function (id, patch) {
        const element = E.getElement(id);
        if (!element) return;
        const merged = Object.assign({}, element);
        Object.keys(patch).forEach(key => {
            if (key === 'props') merged.props = Object.assign({}, element.props, patch.props);
            else if (key !== 'silent') merged[key] = patch[key];
        });
        const normalized = window.XiroSlideCanvas.normalizeElement(merged);
        if (!normalized) return;
        elements()[elements().indexOf(element)] = normalized;
        if (patch.silent) E.render();
        else E.commit();
    };

    /** @param {Object} patch - Cambios del fondo (se normaliza con el lienzo). */
    E.setBackground = function (patch) {
        const background = Object.assign({}, E.state.canvas.background, patch);
        E.state.canvas.background = window.XiroSlideCanvas.normalizeCanvas({
            background,
            elements: elements()
        }).background;
        E.commit();
    };

    /** Elimina el elemento seleccionado. */
    E.removeSelected = function () {
        const index = selectedIndex();
        if (index < 0) return;
        elements().splice(index, 1);
        E.select(null);
        E.commit();
    };

    /** Duplica el elemento seleccionado justo encima del original, desplazado 40 px. */
    E.duplicateSelected = function () {
        const index = selectedIndex();
        if (index < 0) return;
        const copy = JSON.parse(JSON.stringify(elements()[index]));
        copy.id = window.XiroSlideCanvas.newId(elements().map(el => el.id));
        copy.x += 40;
        copy.y += 40;
        elements().splice(index + 1, 0, copy);
        E.select(copy.id);
        E.commit();
    };

    /** Lleva el seleccionado a la capa que devuelve target(índice, total). */
    function moveLayer(target) {
        const index = selectedIndex();
        if (index < 0) return;
        const to = Math.max(0, Math.min(elements().length - 1, target(index, elements().length)));
        if (to === index) return;
        elements().splice(to, 0, elements().splice(index, 1)[0]);
        E.commit();
    }

    E.bringToFront = () => moveLayer((i, total) => total - 1);
    E.sendToBack = () => moveLayer(() => 0);
    E.bringForward = () => moveLayer(i => i + 1);
    E.sendBackward = () => moveLayer(i => i - 1);

    /** Restaura una instantánea del historial; la selección olvida lo que ya no existe. */
    function restore(snapshot) {
        if (!snapshot) return;
        E.state.canvas = JSON.parse(snapshot);
        if (E.state.selectedId && !E.getElement(E.state.selectedId)) E.state.selectedId = null;
        E.render();
        E.state.dirty = true;
    }

    E.undo = () => restore(E.state.history.undo());
    E.redo = () => restore(E.state.history.redo());

    /** @returns {Object} Copia profunda del lienzo. */
    E.getCanvas = function () {
        return JSON.parse(JSON.stringify(E.state.canvas));
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor;
})();
