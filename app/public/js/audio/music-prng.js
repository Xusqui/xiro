/**
 * @fileoverview PRNG con semilla para la música generativa: misma semilla, misma
 * música (reproducible para depurar). Puro, sin dependencias.
 *
 * Script clásico con export dual: Jest lo carga con require(); en el navegador lo
 * importa music-engine.js por efecto lateral y queda en self.XiroMusic.prng.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.XiroMusic = root.XiroMusic || {};
        root.XiroMusic.prng = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /** FNV-1a de 32 bits: convierte cualquier semilla (texto o número) en un entero. */
    function hashSeed(seed) {
        const str = String(seed);
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        return hash >>> 0;
    }

    /**
     * Generador mulberry32. Cada capa usa su propia etiqueta (createRng(seed, 'bass'))
     * para que cambiar cómo se genera una capa no altere las demás.
     */
    function createRng(seed, label) {
        let state = hashSeed(label ? seed + ':' + label : seed);

        function next() {
            state = (state + 0x6D2B79F5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }

        return {
            next,
            /** Entero en [min, max], ambos incluidos. */
            int(min, max) {
                return min + Math.floor(next() * (max - min + 1));
            },
            pick(list) {
                return list[Math.floor(next() * list.length)];
            },
            chance(probability) {
                return next() < probability;
            },
            /** Índice elegido según pesos relativos (no hace falta que sumen 1). */
            weightedIndex(weights) {
                let total = 0;
                for (let i = 0; i < weights.length; i++) total += weights[i];
                let roll = next() * total;
                for (let i = 0; i < weights.length; i++) {
                    roll -= weights[i];
                    if (roll < 0) return i;
                }
                return weights.length - 1;
            }
        };
    }

    /** Semilla aleatoria legible para partidas nuevas. */
    function randomSeed() {
        return Math.floor(Math.random() * 0xFFFFFF).toString(36);
    }

    return { hashSeed, createRng, randomSeed };
});
