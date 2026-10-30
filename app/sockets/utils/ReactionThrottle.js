/**
 * @fileoverview Límite de reacciones con emoji por socket: cubo de fichas con una ráfaga
 * corta y recarga constante. Es local al worker (el socket vive en uno solo), así que no
 * cuesta un viaje a Redis por cada toque.
 */

'use strict';

class ReactionThrottle {
    /**
     * @param {Object} [options]
     * @param {number} [options.burst=3] - Fichas máximas
     * @param {number} [options.refillMs=400] - Milisegundos por ficha
     * @param {Function} [options.now=Date.now]
     */
    constructor({ burst = 3, refillMs = 400, now = Date.now } = {}) {
        this._burst = burst;
        this._refillMs = refillMs;
        this._now = now;
        this._buckets = new Map();
    }

    /** Gasta una ficha del socket; false si no le quedan. */
    take(socketId) {
        const now = this._now();
        const bucket = this._buckets.get(socketId) || { tokens: this._burst, at: now };
        const refilled = Math.floor((now - bucket.at) / this._refillMs);
        if (refilled > 0) {
            bucket.tokens = Math.min(this._burst, bucket.tokens + refilled);
            bucket.at = bucket.tokens === this._burst ? now : bucket.at + refilled * this._refillMs;
        }
        this._buckets.set(socketId, bucket);
        if (bucket.tokens < 1) return false;
        bucket.tokens -= 1;
        return true;
    }

    forget(socketId) {
        this._buckets.delete(socketId);
    }

    get size() {
        return this._buckets.size;
    }
}

module.exports = { ReactionThrottle };
