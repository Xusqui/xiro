/**
 * @fileoverview Barra de herramientas del editor de diapositivas libres: añadir texto, figuras,
 * imagen y vídeo; duplicar, eliminar, orden de apilamiento y deshacer/rehacer.
 */
(function () {
    'use strict';
    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = root.XiroCanvasEditor = root.XiroCanvasEditor || {};

    XiroCanvasEditor.toolbar = {
        html: function () {
            return `
                <div class="xsce-toolbar flex items-center gap-1 p-2 bg-slate-800 text-white">
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Texto" aria-label="Texto" data-canvas-action="add-text">
                        <i class="fas fa-font"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Rectángulo" aria-label="Rectángulo" data-canvas-action="add-rect">
                        <i class="fas fa-square"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Elipse" aria-label="Elipse" data-canvas-action="add-ellipse">
                        <i class="fas fa-circle"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Línea" aria-label="Línea" data-canvas-action="add-line">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Flecha" aria-label="Flecha" data-canvas-action="add-arrow">
                        <i class="fas fa-arrow-right"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Imagen" aria-label="Imagen" data-canvas-action="add-image">
                        <i class="fas fa-image"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Video" aria-label="Video" data-canvas-action="add-video">
                        <i class="fas fa-film"></i>
                    </button>
                    <span class="xsce-separator w-px h-6 bg-slate-600 mx-1"></span>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Duplicar" aria-label="Duplicar" data-canvas-action="duplicate">
                        <i class="fas fa-clone"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Eliminar" aria-label="Eliminar" data-canvas-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    <span class="xsce-separator w-px h-6 bg-slate-600 mx-1"></span>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Traer al frente" aria-label="Traer al frente" data-canvas-action="front">
                        <i class="fas fa-angles-up"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Avanzar" aria-label="Avanzar" data-canvas-action="forward">
                        <i class="fas fa-angle-up"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Retroceder" aria-label="Retroceder" data-canvas-action="backward">
                        <i class="fas fa-angle-down"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Enviar al fondo" aria-label="Enviar al fondo" data-canvas-action="back">
                        <i class="fas fa-angles-down"></i>
                    </button>
                    <span class="xsce-separator w-px h-6 bg-slate-600 mx-1"></span>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Deshacer" aria-label="Deshacer" data-canvas-action="undo">
                        <i class="fas fa-rotate-left"></i>
                    </button>
                    <button type="button" class="xsce-btn p-2 rounded hover:bg-slate-700" title="Rehacer" aria-label="Rehacer" data-canvas-action="redo">
                        <i class="fas fa-rotate-right"></i>
                    </button>
                </div>
            `;
        },

        refresh: function (state) {
            const toolbar = document.querySelector('.xsce-toolbar');
            if (!toolbar) return;

            // Botones de selección
            const selectionButtons = toolbar.querySelectorAll('[data-canvas-action="duplicate"], [data-canvas-action="delete"], [data-canvas-action="front"], [data-canvas-action="forward"], [data-canvas-action="backward"], [data-canvas-action="back"]');
            if (state.selectedId) {
                selectionButtons.forEach(btn => btn.disabled = false);
            } else {
                selectionButtons.forEach(btn => btn.disabled = true);
            }

            // Botones de historial
            const historyButtons = toolbar.querySelectorAll('[data-canvas-action="undo"], [data-canvas-action="redo"]');
            historyButtons[0].disabled = !state.history.canUndo();
            historyButtons[1].disabled = !state.history.canRedo();
        },

        handle: function (action) {
            switch (action) {
                case 'add-text':
                    XiroCanvasEditor.addElement('text', { props: { text: 'Escribe aquí' } });
                    XiroCanvasEditor.setMode('editing');
                    break;
                case 'add-rect':
                case 'add-ellipse':
                case 'add-line':
                case 'add-arrow':
                    XiroCanvasEditor.addElement('shape', { props: { shape: action.split('-')[1] } });
                    break;
                case 'add-image':
                    XiroCanvasEditor.media.openImage(function (result) {
                        if (result && result.src) {
                            const ratio = result.ratio || null;
                            const w = 800;
                            const h = ratio ? Math.round(800 / ratio) : 450;
                            XiroCanvasEditor.addElement('image', { w: w, h: h, props: { src: result.src, ratio: ratio } });
                        }
                    });
                    break;
                case 'add-video':
                    XiroCanvasEditor.media.openVideo(function (result) {
                        if (result && result.url) {
                            XiroCanvasEditor.addElement('video', { props: { url: result.url } });
                        }
                    });
                    break;
                case 'duplicate':
                    XiroCanvasEditor.duplicateSelected();
                    break;
                case 'delete':
                    XiroCanvasEditor.removeSelected();
                    break;
                case 'front':
                    XiroCanvasEditor.bringToFront();
                    break;
                case 'forward':
                    XiroCanvasEditor.bringForward();
                    break;
                case 'backward':
                    XiroCanvasEditor.sendBackward();
                    break;
                case 'back':
                    XiroCanvasEditor.sendToBack();
                    break;
                case 'undo':
                    XiroCanvasEditor.undo();
                    break;
                case 'redo':
                    XiroCanvasEditor.redo();
                    break;
            }
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = XiroCanvasEditor.toolbar;
})();
