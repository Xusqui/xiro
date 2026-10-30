/**
 * @fileoverview Agrupa las reacciones con emoji por sala y emite un único mensaje con los
 * recuentos por intervalo ({ clap: 7, fire: 2 }), en vez de un mensaje por toque. Con
 * cientos de jugadores, el presentador recibe unos pocos mensajes por segundo.
 * El temporizador solo corre mientras hay algo pendiente.
 */

'use strict';

const logger = require('../../config/logger');

class ReactionBurstBuffer {
    /**
     * @param {Object} options
     * @param {Function} options.emit - (roomId, counts) => void
     * @param {number} [options.intervalMs=200]
     */
    constructor({ emit, intervalMs = 200 }) {
        this._emit = emit;
        this._intervalMs = intervalMs;
        this._pending = new Map();
        this._timer = null;
    }

    add(roomId, reaction) {
        const counts = this._pending.get(roomId) || {};
        counts[reaction] = (counts[reaction] || 0) + 1;
        this._pending.set(roomId, counts);
        if (!this._timer) {
            this._timer = setTimeout(() => this._flush(), this._intervalMs);
        }
    }

    stop() {
        if (this._timer) clearTimeout(this._timer);
        this._timer = null;
        this._pending.clear();
    }

    _flush() {
        this._timer = null;
        const batch = this._pending;
        this._pending = new Map();
        for (const [roomId, counts] of batch) {
            try {
                this._emit(roomId, counts);
            } catch (error) {
                logger.warn('No se pudieron emitir las reacciones', { roomId, error: error.message });
            }
        }
    }
}

module.exports = { ReactionBurstBuffer };
