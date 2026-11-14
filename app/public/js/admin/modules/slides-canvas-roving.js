/**
 * @fileoverview Barras del editor con teclado, según el patrón «toolbar» de WAI-ARIA: la barra es
 * una sola parada de Tab (tabindex 0 en un control, -1 en el resto) y las flechas izquierda y
 * derecha, Inicio y Fin, recorren sus controles activos dando la vuelta en los extremos. El
 * control que recibe el foco, también con el ratón, pasa a ser la parada.
 *
 * Las flechas que mueven el foco no siguen hacia los atajos del lienzo (slides-canvas-keys.js),
 * que moverían lo seleccionado. Si la parada se desactiva (los botones de la barra de objetos
 * cambian con la selección), pasa al primer control activo: si no, Tab se saltaría la barra.
 */
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const E = (root.XiroCanvasEditor = root.XiroCanvasEditor || {});

    const CONTROLS = 'button, select, input';
    const STEPS = { ArrowRight: 1, ArrowLeft: -1 };
    const EDGES = ['Home', 'End'];

    const isOff = control => control.matches(':disabled');

    /** Controles de la barra en orden, sin los de las zonas excluidas. */
    function items(bar) {
        return Array.prototype.filter.call(bar.container.querySelectorAll(CONTROLS), c => !(bar.skip && c.closest(bar.skip)));
    }

    function makeStop(bar, stop) {
        items(bar).forEach(c => c.setAttribute('tabindex', c === stop ? '0' : '-1'));
    }

    /** La parada sigue en un control activo (sin ninguno, la barra entera está desactivada). */
    function keepStop(bar) {
        const list = items(bar);
        const stop = list.find(c => c.getAttribute('tabindex') === '0');
        const first = list.find(c => !isOff(c));
        if (first && (!stop || isOff(stop))) makeStop(bar, first);
    }

    function destination(key, list, index) {
        if (key === 'Home') return list[0];
        if (key === 'End') return list[list.length - 1];
        return list[(index + STEPS[key] + list.length) % list.length];
    }

    function onKeyDown(bar, event) {
        if (!STEPS[event.key] && EDGES.indexOf(event.key) < 0) return;
        const list = items(bar).filter(c => !isOff(c));
        const index = list.indexOf(event.target);
        if (index < 0) return;
        event.preventDefault();
        event.stopPropagation();
        const next = destination(event.key, list, index);
        makeStop(bar, next);
        next.focus();
    }

    function onFocusIn(bar, event) {
        if (items(bar).indexOf(event.target) >= 0) makeStop(bar, event.target);
    }

    /**
     * Engancha el recorrido con teclado a una barra.
     * @param {HTMLElement} container - Elemento con role="toolbar".
     * @param {string} [skip] - Selector de zonas cuyos controles no entran (los paneles de la barra).
     * @returns {{detach: Function}} Para soltar la barra al cerrar el editor.
     */
    function attach(container, skip) {
        const bar = { container, skip };
        const keydown = event => onKeyDown(bar, event);
        const focusin = event => onFocusIn(bar, event);
        const observer = root.MutationObserver ? new root.MutationObserver(() => keepStop(bar)) : null;
        if (observer) observer.observe(container, { subtree: true, attributes: true, attributeFilter: ['disabled'] });
        makeStop(bar, items(bar)[0]);
        keepStop(bar);
        container.addEventListener('keydown', keydown);
        container.addEventListener('focusin', focusin);
        return {
            detach() {
                if (observer) observer.disconnect();
                container.removeEventListener('keydown', keydown);
                container.removeEventListener('focusin', focusin);
            }
        };
    }

    E.roving = { attach };

    if (typeof module !== 'undefined' && module.exports) module.exports = E.roving;
})();
