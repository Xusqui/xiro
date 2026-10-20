/**
 * @fileoverview Barra de herramientas del editor de diapositivas libres: añadir texto, figuras,
 * imagen y vídeo; duplicar, eliminar, orden de apilamiento y deshacer/rehacer.
 */
(function () {
    'use strict';
    const root = typeof window !== 'undefined' ? window : globalThis;
    const XiroCanvasEditor = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    // [acción, icono, clave del texto (admin.canvas.tool.*), mostrar el texto, con atajo
    // (admin.canvas.shortcut.*)]: el texto va visible en los botones de añadir contenido y como
    // tooltip inmediato (admin.css .xiro-toolbar-btn) en los de solo icono.
    const GROUPS = [
        [
            ['add-text', 'fa-font', 'text', true],
            ['add-rect', 'fa-square', 'rect'],
            ['add-ellipse', 'fa-circle', 'ellipse'],
            ['add-line', 'fa-minus', 'line'],
            ['add-arrow', 'fa-arrow-right', 'arrow'],
            ['add-image', 'fa-image', 'image', true],
            ['add-video', 'fa-film', 'video', true]
        ],
        [
            ['duplicate', 'fa-clone', 'duplicate', false, true],
            ['delete', 'fa-trash-can', 'delete', false, true]
        ],
        [
            ['front', 'fa-angles-up', 'front'],
            ['forward', 'fa-angle-up', 'forward'],
            ['backward', 'fa-angle-down', 'backward'],
            ['back', 'fa-angles-down', 'back']
        ],
        [
            ['undo', 'fa-rotate-left', 'undo', false, true],
            ['redo', 'fa-rotate-right', 'redo', false, true]
        ]
    ];

    function toolButton(tool) {
        const [action, icon, name, showLabel, shortcut] = tool;
        const th = XiroCanvasEditor.th;
        const label = th('tool.' + name);
        const tip = shortcut
            ? th('tool.with_shortcut', {
                label: XiroCanvasEditor.t('tool.' + name),
                keys: XiroCanvasEditor.t('shortcut.' + name)
            })
            : label;
        const cls =
            'xsce-tool xiro-toolbar-btn' +
            (showLabel ? ' xsce-tool--label' : '') +
            (action === 'delete' ? ' xsce-tool--danger' : '');
        return (
            '<button type="button" class="' +
            cls +
            '" data-canvas-action="' +
            action +
            '" aria-label="' +
            tip +
            '"' +
            (showLabel ? '' : ' data-tooltip="' + tip + '"') +
            '>' +
            '<i class="fas ' +
            icon +
            '" aria-hidden="true"></i>' +
            (showLabel ? '<span>' + label + '</span>' : '') +
            '</button>'
        );
    }

    XiroCanvasEditor.toolbar = {
        html: function () {
            const sep = '<span class="xsce-sep" aria-hidden="true"></span>';
            return (
                '<div class="xsce-toolbar xsce-bar" role="toolbar" aria-label="' +
                XiroCanvasEditor.th('toolbar_label') +
                '">' +
                GROUPS.map(group => group.map(toolButton).join('')).join(sep) +
                '</div>'
            );
        },

        refresh: function (state) {
            const toolbar = document.querySelector('.xsce-toolbar');
            if (!toolbar) return;

            // Botones de selección
            const selectionButtons = toolbar.querySelectorAll(
                '[data-canvas-action="duplicate"], [data-canvas-action="delete"], [data-canvas-action="front"], [data-canvas-action="forward"], [data-canvas-action="backward"], [data-canvas-action="back"]'
            );
            if (state.selectedId) {
                selectionButtons.forEach(btn => (btn.disabled = false));
            } else {
                selectionButtons.forEach(btn => (btn.disabled = true));
            }

            // Botones de historial
            const historyButtons = toolbar.querySelectorAll('[data-canvas-action="undo"], [data-canvas-action="redo"]');
            historyButtons[0].disabled = !state.history.canUndo();
            historyButtons[1].disabled = !state.history.canRedo();
        },

        handle: function (action) {
            switch (action) {
                case 'add-text':
                    XiroCanvasEditor.addElement('text', { props: { text: XiroCanvasEditor.t('default_text') } });
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
                            XiroCanvasEditor.addElement('image', {
                                w: w,
                                h: h,
                                props: { src: result.src, ratio: ratio }
                            });
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
