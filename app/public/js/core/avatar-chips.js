/**
 * @fileoverview Avatares junto al nombre del jugador, sin mezclarlos con su texto.
 *
 * Las plantillas solo marcan el elemento que lleva el nombre con
 * `data-avatar-of="<apodo escapado>"`. Este módulo observa el DOM y pone delante de cada
 * elemento marcado un <img> del avatar (creado con el DOM, la URL sale del catálogo, nunca
 * del apodo); si el jugador no tiene avatar, lo quita. `repaint()` vuelve a pintar todo
 * cuando cambia el mapa de avatares.
 *
 * Lo usan el presentador (presenter-avatars.js) y la TV (tv-avatars.js). ES5: tv.html
 * también lo carga. Export dual: require en Jest; self.XiroAvatarChips en el navegador.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.XiroAvatarChips = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const ATTR = 'data-avatar-of';
    const CHIP_ATTR = 'data-avatar-chip';

    /**
     * @param {Object} options
     * @param {Element} options.root - Zona observada (document.body)
     * @param {Object} options.catalog - XiroAvatars (isKnown, iconUrl)
     * @param {Function} options.lookup - apodo → id del avatar o null
     * @param {string} [options.className]
     * @param {string} [options.style] - Estilo en línea (la TV no usa hojas con variables)
     * @param {number} [options.size=32]
     */
    function attach(options) {
        const root = options.root;
        const catalog = options.catalog;
        const size = options.size || 32;

        function chipBefore(el) {
            const prev = el.previousSibling;
            return prev && prev.nodeType === 1 && prev.getAttribute(CHIP_ATTR) === '1' ? prev : null;
        }

        function createChip() {
            const img = document.createElement('img');
            img.setAttribute(CHIP_ATTR, '1');
            img.setAttribute('alt', '');
            img.setAttribute('width', String(size));
            img.setAttribute('height', String(size));
            if (options.className) img.className = options.className;
            if (options.style) img.setAttribute('style', options.style);
            return img;
        }

        function paint(el) {
            const id = options.lookup(el.getAttribute(ATTR));
            let chip = chipBefore(el);
            if (!catalog.isKnown(id)) {
                if (chip) chip.parentNode.removeChild(chip);
                return;
            }
            if (!el.parentNode) return;
            if (!chip) {
                chip = createChip();
                el.parentNode.insertBefore(chip, el);
            }
            const src = catalog.iconUrl(id);
            if (chip.getAttribute('src') !== src) chip.setAttribute('src', src);
        }

        function paintWithin(node) {
            if (!node || node.nodeType !== 1) return;
            if (node.hasAttribute(ATTR)) paint(node);
            const marked = node.querySelectorAll('[' + ATTR + ']');
            for (let i = 0; i < marked.length; i++) paint(marked[i]);
        }

        let observer = null;
        if (typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver(function (records) {
                for (let r = 0; r < records.length; r++) {
                    const added = records[r].addedNodes;
                    for (let n = 0; n < added.length; n++) paintWithin(added[n]);
                }
            });
            observer.observe(root, { childList: true, subtree: true });
        }

        paintWithin(root);

        return {
            repaint: function () {
                paintWithin(root);
            },
            detach: function () {
                if (observer) observer.disconnect();
            }
        };
    }

    return { ATTR: ATTR, attach: attach };
});
