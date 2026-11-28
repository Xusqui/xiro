/* eslint-disable no-var -- ES5 a propósito: tv.html debe funcionar en WebOS 3.5 */
/**
 * @fileoverview Pintado de la «Nube de palabras» en el DOM (presentador y TV). Cada palabra es un
 * elemento colocado por la espiral de word-cloud-layout.js. Al llegar una actualización se
 * reutiliza el elemento de las palabras que siguen, para que el CSS anime su movimiento y su
 * crecimiento; solo las nuevas llevan la clase de entrada. El texto de los jugadores se pone
 * siempre con textContent. Estilos en css/word-cloud.css.
 *
 * ES5 a propósito (webOS 3.5): nada de =>, plantillas, ?., ?? ni spread.
 * Expone window.XiroWordCloudRender y module.exports (Node/Jest).
 */
(function (root) {
    'use strict';

    // En el navegador, el global de word-cloud-layout.js; en Node (tests), el módulo
    var Layout =
        root.XiroWordCloudLayout ||
        (typeof module !== 'undefined' && module.require ? module.require('./word-cloud-layout') : null);

    var MAX_FONT_RATIO = 0.2;
    var MIN_FONT_RATIO = 0.034;
    var MIN_FONT_FLOOR = 14;

    // Tipografía, color y giro vienen de la colocación (word-cloud-layout.js) y salen de la clave
    function styleClasses(item) {
        return 'wc-cloud__word--f' + item.face + ' wc-cloud__word--c' + item.color + (item.vertical ? ' wc-cloud__word--v' : '');
    }

    function existingByKey(container) {
        var found = {};
        for (var i = 0; i < container.children.length; i++) {
            var key = container.children[i].getAttribute('data-wc-key');
            if (key !== null) found[key] = container.children[i];
        }
        return found;
    }

    function hideButton(container, key, label) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'wc-cloud__hide';
        button.setAttribute('aria-label', label || '');
        button.textContent = '×';
        button.addEventListener('click', function () {
            if (container.xiroWordCloudOnHide) container.xiroWordCloudOnHide(key);
        });
        return button;
    }

    // El botón sigue a las opciones de cada pintado: se añade o se quita en las palabras que siguen
    function syncHideButton(container, el, key, options) {
        var button = el.querySelector('.wc-cloud__hide');
        if (options.onHide && !button) el.appendChild(hideButton(container, key, options.hideLabel));
        else if (!options.onHide && button) el.removeChild(button);
    }

    function createWordElement(container, item, options) {
        var el = document.createElement('span');
        el.className = 'wc-cloud__word wc-cloud__word--new ' + styleClasses(item);
        el.setAttribute('data-wc-key', item.key);
        var label = document.createElement('span');
        label.className = 'wc-cloud__label';
        label.textContent = item.text;
        el.appendChild(label);
        if (options.onHide) el.appendChild(hideButton(container, item.key, options.hideLabel));
        return el;
    }

    function positionWord(el, item) {
        el.style.left = Math.round(item.x - item.w / 2) + 'px';
        el.style.top = Math.round(item.y - item.h / 2) + 'px';
        el.style.width = item.w + 'px';
        el.style.height = item.h + 'px';
        el.style.fontSize = item.fontSize + 'px';
        el.setAttribute('data-wc-count', String(item.count));
    }

    function removeMissing(container, existing, placed) {
        var keep = {};
        for (var i = 0; i < placed.length; i++) keep[placed[i].key] = true;
        for (var key in existing) {
            if (Object.prototype.hasOwnProperty.call(existing, key) && !keep[key]) container.removeChild(existing[key]);
        }
    }

    /**
     * Pinta la nube en el contenedor, reutilizando los elementos de las palabras que siguen.
     * @param {HTMLElement} container - Lienzo de la nube
     * @param {{words: Array<{key: string, text: string, count: number}>}|undefined} cloud - Nube de `word-cloud-update`
     * @param {{width?: number, height?: number, onHide?: function(string): void, hideLabel?: string}} [options]
     *   Tamaño del lienzo (por defecto el del contenedor); `onHide` solo en el presentador
     * @returns {number} Palabras pintadas
     */
    function render(container, cloud, options) {
        var settings = options || {};
        var height = settings.height || container.clientHeight;
        var placed = Layout.compute(cloud && cloud.words, {
            width: settings.width || container.clientWidth,
            height: height,
            // Letra en proporción al lienzo: en una TV de 1080p la palabra mayor llena la pantalla
            maxFont: settings.maxFont || Math.round(height * MAX_FONT_RATIO),
            minFont: settings.minFont || Math.max(MIN_FONT_FLOOR, Math.round(height * MIN_FONT_RATIO))
        });
        var existing = existingByKey(container);
        container.xiroWordCloudOnHide = settings.onHide || null;
        container.classList.add('wc-cloud');
        container.classList.toggle('wc-cloud--empty', placed.length === 0);
        removeMissing(container, existing, placed);
        for (var i = 0; i < placed.length; i++) {
            var el = existing[placed[i].key];
            if (el) {
                el.className = 'wc-cloud__word ' + styleClasses(placed[i]);
                syncHideButton(container, el, placed[i].key, settings);
            } else {
                el = container.appendChild(createWordElement(container, placed[i], settings));
            }
            positionWord(el, placed[i]);
        }
        return placed.length;
    }

    var api = { render: render };
    root.XiroWordCloudRender = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
