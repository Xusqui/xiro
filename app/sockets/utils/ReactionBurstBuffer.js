/**
 * @fileoverview Agrupa las reacciones con emoji por sala y emite un único mensaje con los
 * recuentos por intervalo ({ clap: 7, fire: 2 }), en vez de un mensaje por toque. Con
 * cientos de jugadores, el presentador recibe unos pocos mensajes por segundo.
 * Un toque aislado sale al momento: la ventana se abre después y agrupa lo que llegue
 * dentro de ella. Cada sala tiene su ventana; el temporizador solo corre mientras la sala
 * está activa (hubo un envío en el último intervalo).
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
        this._windows = new Map();
    }

    add(roomId, reaction) {
        if (!this._windows.has(roomId)) {
            this._send(roomId, { [reaction]: 1 });
            this._openWindow(roomId);
            return;
        }
        const counts = this._pending.get(roomId) || {};
        counts[reaction] = (counts[reaction] || 0) + 1;
        this._pending.set(roomId, counts);
    }

    stop() {
        for (const timer of this._windows.values()) clearTimeout(timer);
        this._windows.clear();
        this._pending.clear();
    }

    _openWindow(roomId) {
        this._windows.set(
            roomId,
            setTimeout(() => this._closeWindow(roomId), this._intervalMs)
        );
    }

    _closeWindow(roomId) {
        const counts = this._pending.get(roomId);
        this._pending.delete(roomId);
        if (!counts) {
            this._windows.delete(roomId);
            return;
        }
        this._send(roomId, counts);
        this._openWindow(roomId);
    }

    _send(roomId, counts) {
        try {
            this._emit(roomId, counts);
        } catch (error) {
            logger.warn('No se pudieron emitir las reacciones', { roomId, error: error.message });
        }
    }
}

module.exports = { ReactionBurstBuffer };
