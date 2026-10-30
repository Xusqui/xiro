/**
 * @fileoverview Planificador de la corriente de reacciones con emoji del presentador y la
 * TV. Convierte una ráfaga del servidor ({ clap: 7, fire: 2 }) en la lista de emojis que
 * hay que lanzar. Datos puros, azar inyectado.
 *
 * - Como mucho MAX_PER_REACTION emojis por reacción y ráfaga; a partir de BADGE_FROM, uno
 *   de ellos lleva la cifra («×12») y sale más grande: se ve la magnitud sin saturar.
 * - Nunca más de MAX_ACTIVE en pantalla; con poco hueco, primero uno por reacción.
 *
 * ES5: tv.html también lo carga. Export dual: require en Jest; self.XiroReactionsStreamPlan.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.XiroReactionsStreamPlan = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const MAX_ACTIVE = 24;
    const MAX_PER_REACTION = 3;
    const BADGE_FROM = 4;
    const MAX_DELAY_MS = 180;
    const BADGE_SIZE = 1.3;

    function validCount(value) {
        return typeof value === 'number' && value >= 1 && Math.floor(value) === value;
    }

    /** Cola de lanzamientos: primero una ronda con uno por reacción, después el resto. */
    function queueFor(counts, set) {
        const rounds = [];
        for (let i = 0; i < set.length; i++) {
            const id = set[i];
            if (!Object.prototype.hasOwnProperty.call(counts, id) || !validCount(counts[id])) continue;
            const n = counts[id];
            const launches = Math.min(n, MAX_PER_REACTION);
            for (let k = 0; k < launches; k++) {
                if (!rounds[k]) rounds[k] = [];
                rounds[k].push({ id: id, count: k === 0 && n >= BADGE_FROM ? n : null });
            }
        }
        const queue = [];
        for (let r = 0; r < rounds.length; r++) queue.push.apply(queue, rounds[r]);
        return queue;
    }

    /**
     * @param {Object} params
     * @param {Object} params.counts - { id: n } de la ráfaga
     * @param {string[]} params.set - Conjunto de la sala (orden de lanzamiento)
     * @param {number} params.active - Emojis ya en pantalla
     * @param {Function} [params.rng=Math.random]
     * @returns {Array<{ id, count, x, delay, duration, size, drift }>}
     */
    function planBurst(params) {
        const rng = params.rng || Math.random;
        const room = Math.max(0, MAX_ACTIVE - (params.active || 0));
        const queue = queueFor(params.counts || {}, params.set || []).slice(0, room);
        const items = [];
        for (let i = 0; i < queue.length; i++) {
            const entry = queue[i];
            items.push({
                id: entry.id,
                count: entry.count,
                x: rng(),
                delay: Math.round(rng() * MAX_DELAY_MS),
                duration: Math.round(2800 + rng() * 800),
                size: entry.count === null ? 0.85 + rng() * 0.3 : BADGE_SIZE,
                drift: rng() * 2 - 1
            });
        }
        return items;
    }

    return { planBurst: planBurst, MAX_ACTIVE: MAX_ACTIVE };
});
