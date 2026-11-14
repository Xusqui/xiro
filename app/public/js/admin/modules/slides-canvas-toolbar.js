/**
 * @fileoverview Barra de herramientas del editor de diapositivas libres: añadir texto, figuras,
 * imagen y vídeo, más formas del catálogo (slides-canvas-shape-menu.js); selección múltiple (para pantallas táctiles, donde no hay Mayúsculas),
 * copiar, pegar, agrupar y bloquear; duplicar, eliminar, orden de apilamiento y deshacer/rehacer.
 */
(function () {
    'use strict';
    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

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
            ['add-path', 'fa-shapes', 'shapes'],
            ['add-image', 'fa-image', 'image', true],
            ['add-video', 'fa-film', 'video', true],
            ['add-table', 'fa-table', 'table', true]
        ],
        [
            ['select-multi', 'fa-hand-pointer', 'select_multi'],
            ['copy', 'fa-copy', 'copy', false, true],
            ['paste', 'fa-paste', 'paste', false, true],
            ['group', 'fa-object-group', 'group', false, true],
            ['lock', 'fa-lock', 'lock', false, true]
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
    // Conmutadores: llevan aria-pressed
    const TOGGLES = ['select-multi', 'group', 'lock'];

    function toolButton(tool) {
        const [action, icon, name, showLabel, shortcut] = tool;
        const label = E.th('tool.' + name);
        const tip = shortcut
            ? E.th('tool.with_shortcut', { label: E.t('tool.' + name), keys: E.t('shortcut.' + name) })
            : label;
        const cls =
            'xsce-tool xiro-toolbar-btn' +
            (showLabel ? ' xsce-tool--label' : '') +
            (action === 'delete' ? ' xsce-tool--danger' : '');
        const pressed = TOGGLES.indexOf(action) >= 0 ? ' aria-pressed="false"' : '';
        return (
            '<button type="button" class="' +
            cls +
            '" data-canvas-action="' +
            action +
            '" aria-label="' +
            tip +
            '"' +
            pressed +
            (showLabel ? '' : ' data-tooltip="' + tip + '"') +
            '><i class="fas ' +
            icon +
            '" aria-hidden="true"></i>' +
            (showLabel ? '<span>' + label + '</span>' : '') +
            '</button>'
        );
    }

    /** La selección es exactamente un grupo: el botón «Agrupar» desagrupa. */
    function isOneGroup(list) {
        return list.length > 1 && !!list[0].groupId && list.every(el => el.groupId === list[0].groupId);
    }

    function selectedList() {
        return E.getSelectedIds().map(E.getElement);
    }

    function addImage() {
        E.media.openImage(result => {
            if (!result || !result.src) return;
            const ratio = result.ratio || null;
            E.addElement('image', {
                w: 800,
                h: ratio ? Math.round(800 / ratio) : 450,
                props: { src: result.src, ratio }
            });
        });
    }

    function addVideo() {
        E.media.openVideo(result => {
            if (result && result.url) E.addElement('video', { props: { url: result.url } });
        });
    }

    const addShape = shape => () => E.addElement('shape', { props: { shape } });

    const ACTIONS = {
        'add-text': () => {
            E.addElement('text', { props: { text: E.t('default_text') } });
            E.setMode('editing');
        },
        'add-rect': addShape('rect'),
        'add-ellipse': addShape('ellipse'),
        'add-line': addShape('line'),
        'add-arrow': addShape('arrow'),
        'add-path': () => E.shapeMenu.toggle(document.querySelector('.xsce-toolbar [data-canvas-action="add-path"]')),
        'add-image': addImage,
        'add-video': addVideo,
        'add-table': () => E.addElement('table'),
        'select-multi': () => {
            E.state.multiMode = !E.state.multiMode;
            E.render();
        },
        copy: () => E.copySelection(),
        paste: () => E.pasteClipboard(),
        group: () => (isOneGroup(selectedList()) ? E.ungroupSelection() : E.groupSelection()),
        lock: () => E.toggleLockSelection(),
        duplicate: () => E.duplicateSelection(),
        delete: () => E.removeSelection(),
        front: () => E.bringToFront(),
        forward: () => E.bringForward(),
        backward: () => E.sendBackward(),
        back: () => E.sendToBack(),
        undo: () => E.undo(),
        redo: () => E.redo()
    };

    /** Habilitado de cada botón según la selección, el portapapeles y el historial. */
    function enabledStates(state) {
        const count = E.getSelectedIds().length;
        const any = count > 0;
        const single = count === 1;
        return {
            copy: any,
            paste: E.hasClipboard(),
            group: count > 1,
            lock: any,
            duplicate: any,
            delete: any,
            front: single,
            forward: single,
            backward: single,
            back: single,
            undo: state.history.canUndo(),
            redo: state.history.canRedo()
        };
    }

    function setPressed(toolbar, action, on) {
        const button = toolbar.querySelector('[data-canvas-action="' + action + '"]');
        if (button) button.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    E.toolbar = {
        html: function () {
            const sep = '<span class="xsce-sep" aria-hidden="true"></span>';
            return (
                '<div class="xsce-toolbar xsce-bar" role="toolbar" aria-label="' +
                E.th('toolbar_label') +
                '">' +
                GROUPS.map(group => group.map(toolButton).join('')).join(sep) +
                '</div>'
            );
        },

        refresh: function (state) {
            const toolbar = document.querySelector('.xsce-toolbar');
            if (!toolbar) return;
            const enabled = enabledStates(state);
            Object.keys(enabled).forEach(action => {
                const button = toolbar.querySelector('[data-canvas-action="' + action + '"]');
                if (button) button.disabled = !enabled[action];
            });
            const list = selectedList();
            setPressed(toolbar, 'select-multi', !!state.multiMode);
            setPressed(toolbar, 'group', isOneGroup(list));
            setPressed(toolbar, 'lock', list.length > 0 && list.every(el => el.locked));
        },

        /** @param {string} action - Valor de data-canvas-action del botón pulsado. */
        handle: function (action) {
            if (ACTIONS[action]) ACTIONS[action]();
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.toolbar;
})();
