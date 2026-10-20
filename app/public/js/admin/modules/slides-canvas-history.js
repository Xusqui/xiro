(function () {
    'use strict';

    // Espacio de nombres compartido por los módulos del editor (scripts clásicos del admin)
    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};

    /**
     * Crea un historial para el editor de canvas
     * @param {number} maxSnapshots - Límite máximo de snapshots (por defecto 50)
     * @returns {Object} Objeto con métodos de historial
     */
    XiroCanvasEditor.history = XiroCanvasEditor.history || {};

    XiroCanvasEditor.history.createHistory = function(maxSnapshots) {
        let history = [];
        let currentIndex = -1;
        const limit = maxSnapshots || 50;

        return {
            /**
             * Reinicia el historial con un snapshot
             * @param {string} snapshot - Snapshot JSON
             */
            reset: function(snapshot) {
                history = [snapshot];
                currentIndex = 0;
            },

            /**
             * Agrega un snapshot al historial
             * @param {string} snapshot - Snapshot JSON
             */
            push: function(snapshot) {
                // Si es igual al actual, no hacer nada
                if (currentIndex >= 0 && history[currentIndex] === snapshot) {
                    return;
                }

                // Eliminar snapshots posteriores
                history = history.slice(0, currentIndex + 1);

                // Agregar nuevo snapshot
                history.push(snapshot);

                // Mantener límite
                if (history.length > limit) {
                    history.shift();
                    currentIndex--;
                }

                currentIndex = history.length - 1;
            },

            /**
             * Deshace la última acción
             * @returns {string|null} Snapshot o null si no hay nada que deshacer
             */
            undo: function() {
                if (currentIndex <= 0) {
                    return null;
                }

                currentIndex--;
                return history[currentIndex];
            },

            /**
             * Rehace la última acción deshecha
             * @returns {string|null} Snapshot o null si no hay nada que rehacer
             */
            redo: function() {
                if (currentIndex >= history.length - 1) {
                    return null;
                }

                currentIndex++;
                return history[currentIndex];
            },

            /**
             * Verifica si se puede deshacer
             * @returns {boolean}
             */
            canUndo: function() {
                return currentIndex > 0;
            },

            /**
             * Verifica si se puede rehacer
             * @returns {boolean}
             */
            canRedo: function() {
                return currentIndex < history.length - 1;
            }
        };
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.history;
})();
