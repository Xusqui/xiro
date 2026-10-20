(function () {
    'use strict';

    // Espacio de nombres compartido por los módulos del editor (scripts clásicos del admin)
    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    // Requerir el modelo del canvas
    if (typeof window.XiroSlideCanvas === 'undefined') {
        // En entorno Node, requerir el modelo
        if (typeof require !== 'undefined') {
            // eslint-disable-next-line no-undef -- solo en Jest (CommonJS)
            window.XiroSlideCanvas = require('../../../core/slide-canvas-model');
        }
    }

    /**
     * Estado del editor de canvas
     */
    XiroCanvasEditor.state = XiroCanvasEditor.state || {};

    /**
     * Abre un canvas para edición
     * @param {Object} canvas - Canvas a abrir
     * @param {number} index - Índice del canvas
     */
    XiroCanvasEditor.open = function (canvas, index) {
        // Inicializar el estado
        XiroCanvasEditor.state.canvas =
            window.XiroSlideCanvas.normalizeCanvas(canvas) || window.XiroSlideCanvas.createCanvas();
        XiroCanvasEditor.state.selectedId = null;
        XiroCanvasEditor.state.mode = 'idle';
        XiroCanvasEditor.state.index = index;

        // Inicializar historial
        XiroCanvasEditor.state.history = XiroCanvasEditor.history.createHistory();
        XiroCanvasEditor.state.history.reset(JSON.stringify(XiroCanvasEditor.state.canvas));
        XiroCanvasEditor.state.dirty = false;

        // Renderizar
        XiroCanvasEditor.render();
    };

    /**
     * Registra un listener para renderizar
     * @param {Function} fn - Función de callback para renderizar
     */
    XiroCanvasEditor.onRender = function (fn) {
        if (!XiroCanvasEditor.state.renderListeners) {
            XiroCanvasEditor.state.renderListeners = [];
        }
        // Sin duplicados: el editor se abre y se cierra muchas veces en la misma página
        if (XiroCanvasEditor.state.renderListeners.indexOf(fn) < 0) XiroCanvasEditor.state.renderListeners.push(fn);
    };

    /**
     * Quita un listener de renderizado (al cerrar el editor)
     * @param {Function} fn - Función registrada con onRender
     */
    XiroCanvasEditor.offRender = function (fn) {
        const list = XiroCanvasEditor.state.renderListeners || [];
        const index = list.indexOf(fn);
        if (index >= 0) list.splice(index, 1);
    };

    /**
     * Renderiza el estado actual
     */
    XiroCanvasEditor.render = function () {
        if (XiroCanvasEditor.state.renderListeners) {
            for (let i = 0; i < XiroCanvasEditor.state.renderListeners.length; i++) {
                XiroCanvasEditor.state.renderListeners[i](XiroCanvasEditor.state);
            }
        }
    };

    /**
     * Confirma los cambios al historial
     */
    XiroCanvasEditor.commit = function () {
        XiroCanvasEditor.state.history.push(JSON.stringify(XiroCanvasEditor.state.canvas));
        XiroCanvasEditor.state.dirty = true;
        XiroCanvasEditor.render();
    };

    /**
     * Obtiene un elemento por ID
     * @param {string} id - ID del elemento
     * @returns {Object|null} Elemento o null si no se encuentra
     */
    XiroCanvasEditor.getElement = function (id) {
        if (!XiroCanvasEditor.state.canvas || !XiroCanvasEditor.state.canvas.elements) {
            return null;
        }

        for (let i = 0; i < XiroCanvasEditor.state.canvas.elements.length; i++) {
            if (XiroCanvasEditor.state.canvas.elements[i].id === id) {
                return XiroCanvasEditor.state.canvas.elements[i];
            }
        }

        return null;
    };

    /**
     * Obtiene el elemento seleccionado
     * @returns {Object|null} Elemento seleccionado o null
     */
    XiroCanvasEditor.getSelected = function () {
        if (!XiroCanvasEditor.state.selectedId) {
            return null;
        }

        return XiroCanvasEditor.getElement(XiroCanvasEditor.state.selectedId);
    };

    /**
     * Selecciona un elemento
     * @param {string|null} id - ID del elemento a seleccionar o null para deseleccionar
     */
    XiroCanvasEditor.select = function (id) {
        XiroCanvasEditor.state.selectedId = id;
        XiroCanvasEditor.state.mode = id ? 'selected' : 'idle';
        XiroCanvasEditor.render();
    };

    /**
     * Establece el modo
     * @param {string} mode - Modo ('idle', 'selected', 'editing')
     */
    XiroCanvasEditor.setMode = function (mode) {
        XiroCanvasEditor.state.mode = mode;
        XiroCanvasEditor.render();
    };

    /**
     * Agrega un elemento al canvas
     * @param {string} type - Tipo de elemento
     * @param {Object} overrides - Valores a sobrescribir
     * @returns {Object|null} Elemento creado o null si falla
     */
    XiroCanvasEditor.addElement = function (type, overrides) {
        let ids = XiroCanvasEditor.state.canvas.elements.map(function (el) {
            return el.id;
        });
        let el = window.XiroSlideCanvas.createElement(type, Object.assign({ existingIds: ids }, overrides));

        if (el) {
            // Agregar al final (al frente)
            XiroCanvasEditor.state.canvas.elements.push(el);
            XiroCanvasEditor.select(el.id);
            XiroCanvasEditor.commit();
            return el;
        }

        return null;
    };

    /**
     * Actualiza un elemento
     * @param {string} id - ID del elemento
     * @param {Object} patch - Cambios a aplicar
     */
    XiroCanvasEditor.updateElement = function (id, patch) {
        let element = XiroCanvasEditor.getElement(id);
        if (!element) return;

        // Fusionar el parche con el elemento actual
        let newElement = Object.assign({}, element);

        // Actualizar propiedades principales
        for (let key in patch) {
            if (key === 'props') {
                // Manejar props como un objeto separado
                if (!newElement.props) newElement.props = {};
                for (let propKey in patch.props) {
                    newElement.props[propKey] = patch.props[propKey];
                }
            } else {
                newElement[key] = patch[key];
            }
        }

        // Normalizar el elemento
        let normalized = window.XiroSlideCanvas.normalizeElement(newElement);

        if (normalized) {
            // Reemplazar en el canvas
            for (let i = 0; i < XiroCanvasEditor.state.canvas.elements.length; i++) {
                if (XiroCanvasEditor.state.canvas.elements[i].id === id) {
                    XiroCanvasEditor.state.canvas.elements[i] = normalized;
                    break;
                }
            }

            // No hacer commit si es silencioso
            if (!patch.silent) {
                XiroCanvasEditor.commit();
            } else {
                XiroCanvasEditor.render();
            }
        }
    };

    /**
     * Actualiza el fondo del canvas
     * @param {Object} patch - Cambios a aplicar al fondo
     */
    XiroCanvasEditor.setBackground = function (patch) {
        // Fusionar con el fondo actual
        let newBackground = Object.assign({}, XiroCanvasEditor.state.canvas.background);

        for (let key in patch) {
            newBackground[key] = patch[key];
        }

        // Normalizar el canvas completo
        XiroCanvasEditor.state.canvas.background = window.XiroSlideCanvas.normalizeCanvas({
            background: newBackground,
            elements: XiroCanvasEditor.state.canvas.elements
        }).background;

        XiroCanvasEditor.commit();
    };

    /**
     * Elimina el elemento seleccionado
     */
    XiroCanvasEditor.removeSelected = function () {
        if (!XiroCanvasEditor.state.selectedId) return;

        let index = -1;
        for (let i = 0; i < XiroCanvasEditor.state.canvas.elements.length; i++) {
            if (XiroCanvasEditor.state.canvas.elements[i].id === XiroCanvasEditor.state.selectedId) {
                index = i;
                break;
            }
        }

        if (index !== -1) {
            XiroCanvasEditor.state.canvas.elements.splice(index, 1);
            XiroCanvasEditor.select(null);
            XiroCanvasEditor.commit();
        }
    };

    /**
     * Duplica el elemento seleccionado
     */
    XiroCanvasEditor.duplicateSelected = function () {
        let selected = XiroCanvasEditor.getSelected();
        if (!selected) return;

        // Crear una copia del elemento
        let newElement = JSON.parse(JSON.stringify(selected));
        newElement.id = window.XiroSlideCanvas.newId(XiroCanvasEditor.state.canvas.elements.map(el => el.id));
        newElement.x += 40;
        newElement.y += 40;

        // Insertar justo encima del original
        let index = -1;
        for (let i = 0; i < XiroCanvasEditor.state.canvas.elements.length; i++) {
            if (XiroCanvasEditor.state.canvas.elements[i].id === selected.id) {
                index = i;
                break;
            }
        }

        if (index !== -1) {
            XiroCanvasEditor.state.canvas.elements.splice(index + 1, 0, newElement);
            XiroCanvasEditor.select(newElement.id);
            XiroCanvasEditor.commit();
        }
    };

    /**
     * Mueve el elemento seleccionado al frente
     */
    XiroCanvasEditor.bringToFront = function () {
        if (!XiroCanvasEditor.state.selectedId) return;

        let index = -1;
        for (let i = 0; i < XiroCanvasEditor.state.canvas.elements.length; i++) {
            if (XiroCanvasEditor.state.canvas.elements[i].id === XiroCanvasEditor.state.selectedId) {
                index = i;
                break;
            }
        }

        if (index !== -1 && index < XiroCanvasEditor.state.canvas.elements.length - 1) {
            let element = XiroCanvasEditor.state.canvas.elements.splice(index, 1)[0];
            XiroCanvasEditor.state.canvas.elements.push(element);
            XiroCanvasEditor.commit();
        }
    };

    /**
     * Mueve el elemento seleccionado al fondo
     */
    XiroCanvasEditor.sendToBack = function () {
        if (!XiroCanvasEditor.state.selectedId) return;

        let index = -1;
        for (let i = 0; i < XiroCanvasEditor.state.canvas.elements.length; i++) {
            if (XiroCanvasEditor.state.canvas.elements[i].id === XiroCanvasEditor.state.selectedId) {
                index = i;
                break;
            }
        }

        if (index !== -1 && index > 0) {
            let element = XiroCanvasEditor.state.canvas.elements.splice(index, 1)[0];
            XiroCanvasEditor.state.canvas.elements.unshift(element);
            XiroCanvasEditor.commit();
        }
    };

    /**
     * Mueve el elemento seleccionado hacia adelante
     */
    XiroCanvasEditor.bringForward = function () {
        if (!XiroCanvasEditor.state.selectedId) return;

        let index = -1;
        for (let i = 0; i < XiroCanvasEditor.state.canvas.elements.length; i++) {
            if (XiroCanvasEditor.state.canvas.elements[i].id === XiroCanvasEditor.state.selectedId) {
                index = i;
                break;
            }
        }

        if (index !== -1 && index < XiroCanvasEditor.state.canvas.elements.length - 1) {
            let element = XiroCanvasEditor.state.canvas.elements.splice(index, 1)[0];
            XiroCanvasEditor.state.canvas.elements.splice(index + 1, 0, element);
            XiroCanvasEditor.commit();
        }
    };

    /**
     * Mueve el elemento seleccionado hacia atrás
     */
    XiroCanvasEditor.sendBackward = function () {
        if (!XiroCanvasEditor.state.selectedId) return;

        let index = -1;
        for (let i = 0; i < XiroCanvasEditor.state.canvas.elements.length; i++) {
            if (XiroCanvasEditor.state.canvas.elements[i].id === XiroCanvasEditor.state.selectedId) {
                index = i;
                break;
            }
        }

        if (index !== -1 && index > 0) {
            let element = XiroCanvasEditor.state.canvas.elements.splice(index, 1)[0];
            XiroCanvasEditor.state.canvas.elements.splice(index - 1, 0, element);
            XiroCanvasEditor.commit();
        }
    };

    /**
     * Deshace la última acción
     */
    XiroCanvasEditor.undo = function () {
        let snapshot = XiroCanvasEditor.state.history.undo();
        if (snapshot) {
            let canvas = JSON.parse(snapshot);
            XiroCanvasEditor.state.canvas = canvas;

            // Mantener selección si el elemento aún existe
            if (XiroCanvasEditor.state.selectedId && !XiroCanvasEditor.getElement(XiroCanvasEditor.state.selectedId)) {
                XiroCanvasEditor.state.selectedId = null;
            }

            XiroCanvasEditor.render();
            XiroCanvasEditor.state.dirty = true;
        }
    };

    /**
     * Rehace la última acción deshecha
     */
    XiroCanvasEditor.redo = function () {
        let snapshot = XiroCanvasEditor.state.history.redo();
        if (snapshot) {
            let canvas = JSON.parse(snapshot);
            XiroCanvasEditor.state.canvas = canvas;

            // Mantener selección si el elemento aún existe
            if (XiroCanvasEditor.state.selectedId && !XiroCanvasEditor.getElement(XiroCanvasEditor.state.selectedId)) {
                XiroCanvasEditor.state.selectedId = null;
            }

            XiroCanvasEditor.render();
            XiroCanvasEditor.state.dirty = true;
        }
    };

    /**
     * Obtiene una copia profunda del canvas
     * @returns {Object} Copia del canvas
     */
    XiroCanvasEditor.getCanvas = function () {
        return JSON.parse(JSON.stringify(XiroCanvasEditor.state.canvas));
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor;
})();
