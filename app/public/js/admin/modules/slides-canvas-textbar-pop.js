/**
 * @fileoverview Paneles de la barra de formato: el espaciado del párrafo y el menú de la lista
 * numerada. Cada uno es un <div class="xsce-tb-pop" hidden> dentro de la propia barra, abierto por
 * su botón [data-tb-pop] (aria-controls). Al vivir dentro del <fieldset>, sus campos y botones usan
 * los mismos eventos y el mismo pintado que los de la fila (slides-canvas-textbar.js).
 *
 * Posición fija bajo el botón: en el móvil la barra se desplaza en horizontal y recortaría un
 * panel absoluto. Escape y pulsar fuera se escuchan en window en fase de captura, antes que los
 * atajos del editor (Escape deseleccionaría o cerraría el editor). El panel lleva data-keep-edit:
 * entrar en él aparca la edición del texto en vez de terminarla (slides-canvas-textedit.js).
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const GAP_PX = 6;
    const MARGIN_PX = 8;
    const MENU_STEPS = { ArrowDown: 1, ArrowUp: -1 };

    let openButton = null;

    const panelOf = button => document.getElementById(button.getAttribute('aria-controls'));

    /** Bajo el botón, alineado a su izquierda y sin salirse de la ventana. */
    function place(panel, button) {
        const r = button.getBoundingClientRect();
        const width = panel.offsetWidth || 0;
        const maxLeft = Math.max(MARGIN_PX, (root.innerWidth || 0) - width - MARGIN_PX);
        panel.style.top = r.bottom + GAP_PX + 'px';
        panel.style.left = Math.min(Math.max(MARGIN_PX, r.left), maxLeft) + 'px';
    }

    function onOutside(event) {
        if (!openButton) return;
        const panel = panelOf(openButton);
        if ((panel && panel.contains(event.target)) || openButton.contains(event.target)) return;
        close();
    }

    /** En un menú, flecha abajo y arriba recorren sus opciones dando la vuelta (patrón «menu»). */
    function moveInMenu(event) {
        const panel = panelOf(openButton);
        const step = MENU_STEPS[event.key];
        if (!step || !panel || panel.getAttribute('role') !== 'menu') return;
        const items = Array.prototype.slice.call(panel.querySelectorAll('[role^="menuitem"]'));
        if (!items.length) return;
        event.preventDefault();
        event.stopPropagation();
        const index = items.indexOf(document.activeElement);
        const from = index < 0 && step < 0 ? 0 : index;
        items[(from + step + items.length) % items.length].focus();
    }

    /** Escape cierra el panel y vuelve al texto que se escribe (o al botón que lo abrió). */
    function onKey(event) {
        if (!openButton) return;
        if (event.key !== 'Escape') return moveInMenu(event);
        event.preventDefault();
        event.stopPropagation();
        const button = openButton;
        close();
        if (E.textEdit && E.textEdit.isEditing()) E.textEdit.restore();
        else button.focus();
    }

    function close() {
        if (!openButton) return;
        // El editor se vuelve a montar al cambiar de idioma: el panel puede no existir ya
        const panel = panelOf(openButton);
        if (panel) panel.hidden = true;
        openButton.setAttribute('aria-expanded', 'false');
        openButton = null;
        root.removeEventListener('pointerdown', onOutside, true);
        root.removeEventListener('keydown', onKey, true);
    }

    /**
     * Abre el panel del botón (cerrando el que hubiera).
     * @param {HTMLElement} button - Botón [data-tb-pop] con aria-controls.
     * @param {boolean} focusFirst - Llevar el foco al primer control (al abrir con el teclado).
     */
    function open(button, focusFirst) {
        close();
        const panel = panelOf(button);
        if (!panel) return;
        panel.hidden = false;
        place(panel, button);
        button.setAttribute('aria-expanded', 'true');
        openButton = button;
        root.addEventListener('pointerdown', onOutside, true);
        root.addEventListener('keydown', onKey, true);
        const first = focusFirst ? panel.querySelector('button, select, input') : null;
        if (first) first.focus();
    }

    E.textbarPop = {
        /**
         * Abre o cierra el panel de un botón.
         * @param {HTMLElement} button - Botón [data-tb-pop].
         * @param {boolean} [focusFirst] - Abrir con el foco en el primer control.
         */
        toggle(button, focusFirst) {
            if (openButton === button) close();
            else open(button, !!focusFirst);
        },
        close,
        isOpen: () => openButton !== null
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.textbarPop;
})();
