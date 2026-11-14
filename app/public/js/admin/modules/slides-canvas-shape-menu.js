/**
 * @fileoverview Menú «Más formas» de la barra del editor: rejilla con las formas del catálogo
 * (core/slide-canvas-path-presets.js), cada una con su miniatura. Elegir una añade una forma
 * libre (shape 'path') con ese trazado.
 *
 * Se cuelga de #modalLienzo con posición fija bajo el botón, no dentro de la barra: en el
 * móvil la barra se desplaza en horizontal y recortaría el menú.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const MENU_ID = 'xsceShapeMenu';
    const GAP_PX = 8;

    const presets = () => root.XiroSlideCanvasPathPresets;
    const menuNode = () => document.getElementById(MENU_ID);

    function presetButton(preset) {
        const label = E.th('preset.' + preset.name);
        return (
            '<button type="button" class="xsce-shape-option" role="menuitem" data-shape-preset="' +
            preset.name +
            '" aria-label="' +
            label +
            '" title="' +
            label +
            '"><svg viewBox="-4 -4 108 108" aria-hidden="true"><path d="' +
            root.XiroSlideCanvasRender.escapeText(preset.d) +
            '"/></svg></button>'
        );
    }

    function close() {
        const menu = menuNode();
        if (menu) menu.remove();
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('keydown', onKey, true);
    }

    function onOutside(event) {
        const menu = menuNode();
        if (menu && !menu.contains(event.target) && !event.target.closest('[data-canvas-action="add-path"]')) close();
    }

    /** Escape cierra el menú sin llegar al editor (que se cerraría si no hay nada seleccionado). */
    function onKey(event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        close();
    }

    function addPreset(name) {
        const d = presets().get(name);
        close();
        if (d) E.addElement('shape', { props: { shape: 'path', d, viewBox: presets().VIEWBOX.slice() } });
    }

    function open(anchor) {
        const host = document.getElementById('modalLienzo');
        if (!host || !anchor) return;
        const menu = document.createElement('div');
        menu.id = MENU_ID;
        menu.className = 'xsce-shape-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', E.t('tool.shapes'));
        menu.innerHTML = presets().list().map(presetButton).join('');
        const r = anchor.getBoundingClientRect();
        menu.style.top = r.bottom + GAP_PX + 'px';
        menu.style.left = Math.max(GAP_PX, r.left) + 'px';
        menu.addEventListener('click', event => {
            const option = event.target.closest('[data-shape-preset]');
            if (option) addPreset(option.getAttribute('data-shape-preset'));
        });
        host.appendChild(menu);
        document.addEventListener('pointerdown', onOutside, true);
        document.addEventListener('keydown', onKey, true);
        const first = menu.querySelector('button');
        if (first) first.focus();
    }

    E.shapeMenu = {
        /** @param {HTMLElement} anchor - Botón de la barra bajo el que se abre. */
        toggle(anchor) {
            if (menuNode()) close();
            else open(anchor);
        },
        close,
        isOpen: () => !!menuNode()
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.shapeMenu;
})();
