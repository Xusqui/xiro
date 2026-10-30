/**
 * @fileoverview Corriente de reacciones con emoji en el presentador y la TV: monta en una
 * capa los emojis que planifica reactions-stream-plan.js y los retira al acabar.
 *
 * Cada emoji son dos capas: .rxs-item sube y se desvanece, .rxs-sway se balancea. Solo se
 * animan transform y opacity, con estilos en línea sin variables CSS (TV webOS antiguas).
 * Estilos en css/reactions-stream.css.
 *
 * ES5: tv.html también lo carga. Necesita XiroReactions y XiroReactionsStreamPlan.
 * Export dual: require en Jest; self.XiroReactionsStream en el navegador.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            module.require('./reactions-catalog.js'),
            module.require('./reactions-stream-plan.js')
        );
    } else {
        root.XiroReactionsStream = factory(root.XiroReactions, root.XiroReactionsStreamPlan);
    }
})(typeof self !== 'undefined' ? self : this, function (catalog, streamPlan) {
    'use strict';

    const REMOVE_MARGIN_MS = 120;

    function buildItem(doc, item) {
        const node = doc.createElement('div');
        node.className = 'rxs-item' + (item.drift < 0 ? ' rxs-item--left' : '');
        node.setAttribute('aria-hidden', 'true');
        // El emoji ocupa ~40 % de la columna: x recorre el hueco que queda sin salirse
        node.style.left = (4 + item.x * 52).toFixed(1) + '%';
        node.style.animationDuration = item.duration + 'ms';
        node.style.animationDelay = item.delay + 'ms';

        const sway = doc.createElement('div');
        sway.className = 'rxs-sway';
        sway.style.animationDuration = Math.round(900 + Math.abs(item.drift) * 500) + 'ms';
        sway.style.animationDelay = item.delay + 'ms';

        const img = doc.createElement('img');
        img.src = catalog.iconUrl(item.id);
        img.alt = '';
        img.style.width = Math.round(item.size * 100) + '%';
        sway.appendChild(img);

        if (item.count !== null) {
            const badge = doc.createElement('span');
            badge.className = 'rxs-count';
            badge.textContent = '×' + item.count;
            sway.appendChild(badge);
        }
        node.appendChild(sway);
        return node;
    }

    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - Capa donde se montan los emojis
     * @param {Function} [options.rng=Math.random]
     */
    function createReactionsStream(options) {
        const container = options.container;
        const doc = container.ownerDocument;
        const rng = options.rng || Math.random;
        const timers = {};
        let nextTimer = 0;

        function activeCount() {
            return container.children.length;
        }

        function push(counts, set) {
            if (!set || !set.length) return;
            const items = streamPlan.planBurst({ counts: counts, set: set, active: activeCount(), rng: rng });
            for (let i = 0; i < items.length; i++) {
                const node = buildItem(doc, items[i]);
                container.appendChild(node);
                schedule(node, items[i].delay + items[i].duration + REMOVE_MARGIN_MS);
            }
        }

        function schedule(node, ms) {
            const key = ++nextTimer;
            timers[key] = setTimeout(function () {
                delete timers[key];
                if (node.parentNode) node.parentNode.removeChild(node);
            }, ms);
        }

        function clear() {
            Object.keys(timers).forEach(function (key) {
                clearTimeout(timers[key]);
                delete timers[key];
            });
            while (container.firstChild) container.removeChild(container.firstChild);
        }

        return { push: push, clear: clear, activeCount: activeCount };
    }

    return { createReactionsStream: createReactionsStream };
});
