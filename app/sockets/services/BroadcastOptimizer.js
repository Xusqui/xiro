/**
 * @fileoverview Broadcast Optimizer - Optimización de emits de Socket.IO (v2)
 * 
 * Mejoras v2:
 * - Debouncing configurable por tipo de evento (50-200ms)
 * - Smart flush: >10 pendientes → flush inmediato
 * - Soporte para múltiples tipos de eventos
 * - Integración con PayloadCompressor
 * 
 * @version 2.0.0
 */

const PayloadCompressor = require('../utils/PayloadCompressor');

/**
 * Configuración de debouncing por tipo de evento
 */
const DEBOUNCE_CONFIG = {
    'ranking-update': 100,      // Rankings: 100ms
    'player-answered': 50,       // Respuestas: 50ms (rápido)
    'game-state': 150,           // Estado de juego: 150ms
    'team-update': 100,          // Equipos: 100ms
    'default': 75                // Default: 75ms
};

class BroadcastOptimizer {
    constructor(io) {
        this.io = io;
        this.pendingBroadcasts = new Map(); // eventKey → {data, timeout, count}
        this.SMART_FLUSH_THRESHOLD = 10; // Flush si >10 pendientes del mismo eventKey
        this.MAX_PENDING_ENTRIES = 500;  // Límite total de entradas para evitar fuga de memoria
        this.stats = {
            originalBroadcasts: 0,
            optimizedBroadcasts: 0,
            bytesSaved: 0,
            smartFlushes: 0
        };
    }

    /**
     * Emit con debouncing configurable
     * 
     * @param {string} eventType - Tipo de evento ('ranking-update', 'player-answered', etc)
     * @param {string} roomId - Room ID
     * @param {Object} payload - Payload a enviar
     * @param {string} target - Target room (default: roomId)
     * @param {Object} options - {compress: boolean, debounceMs: number}
     */
    async emit(eventType, roomId, payload, target = null, options = {}) {
        this.stats.originalBroadcasts++;

        const targetRoom = target || roomId;
        const eventKey = `${roomId}:${eventType}:${targetRoom}`;

        // Obtener debounce configurado
        const debounceMs = options.debounceMs || DEBOUNCE_CONFIG[eventType] || DEBOUNCE_CONFIG.default;

        // Preparar payload (comprimir si es necesario)
        let finalPayload = payload;
        if (options.compress && PayloadCompressor.estimateSize(payload) > PayloadCompressor.MIN_SIZE) {
            const compressed = await PayloadCompressor.prepareForEmit(payload);
            if (PayloadCompressor.isCompressed(compressed)) {
                finalPayload = compressed;
                this.stats.bytesSaved += (compressed._originalSize - compressed._compressedSize);
            }
        }

        // Cancelar broadcast pendiente si existe
        if (this.pendingBroadcasts.has(eventKey)) {
            const pending = this.pendingBroadcasts.get(eventKey);
            clearTimeout(pending.timeout);
            pending.count++;
        } else {
            // Protección contra fuga de memoria: si el mapa supera el límite,
            // hacer flush de la entrada más antigua antes de añadir una nueva.
            if (this.pendingBroadcasts.size >= this.MAX_PENDING_ENTRIES) {
                const oldestKey = this.pendingBroadcasts.keys().next().value;
                const oldest = this.pendingBroadcasts.get(oldestKey);
                clearTimeout(oldest.timeout);
                this._executeBroadcast(oldest.eventType, oldest.targetRoom, oldest.data);
                this.pendingBroadcasts.delete(oldestKey);
                this.stats.optimizedBroadcasts++;
            }
            this.pendingBroadcasts.set(eventKey, {
                data: null,
                timeout: null,
                count: 1,
                eventType,
                targetRoom,
                firstEventTime: Date.now()
            });
        }

        const pending = this.pendingBroadcasts.get(eventKey);
        pending.data = finalPayload;

        // Smart flush: si hay >10 broadcasts pendientes del mismo tipo, flush inmediato
        if (pending.count >= this.SMART_FLUSH_THRESHOLD) {
            this._executeBroadcast(eventType, targetRoom, pending.data);
            this.pendingBroadcasts.delete(eventKey);
            this.stats.optimizedBroadcasts++;
            this.stats.smartFlushes++;
            return;
        }

        // Bound latency: check how much time is left until 250ms from firstEventTime
        const elapsed = Date.now() - pending.firstEventTime;
        const maxRemaining = 250 - elapsed;

        if (maxRemaining <= 0) {
            this._executeBroadcast(eventType, targetRoom, pending.data);
            this.pendingBroadcasts.delete(eventKey);
            this.stats.optimizedBroadcasts++;
            return;
        }

        const actualDelay = Math.min(debounceMs, maxRemaining);

        // Programar broadcast con debouncing
        pending.timeout = setTimeout(() => {
            this._executeBroadcast(eventType, targetRoom, pending.data);
            this.pendingBroadcasts.delete(eventKey);
            this.stats.optimizedBroadcasts++;
        }, actualDelay);
    }

    /**
     * Ejecutar broadcast
     * @private
     */
    _executeBroadcast(eventType, targetRoom, payload) {
        this.io.to(targetRoom).emit(eventType, payload);
    }

    /**
     * Emit ranking update (backward compatible con método original)
     * 
     * @param {string} roomId - Room ID
     * @param {Object} ranking - Ranking actualizado
     * @param {string} target - 'presenter' | 'players' | 'all'
     */
    async emitRankingUpdate(roomId, ranking, target = 'all') {
        const targets = [];

        if (target === 'presenter' || target === 'all') {
            targets.push(`${roomId}:presenter`);
        }
        if (target === 'players' || target === 'all') {
            targets.push(`${roomId}:players`);
        }

        // Emit a cada target
        for (const targetRoom of targets) {
            await this.emit('ranking-update', roomId, { ranking }, targetRoom, {
                compress: true // Rankings pueden ser grandes
            });
        }
    }

    /**
     * Flush pendientes inmediatamente (útil al finalizar juego)
     */
    flushPending() {
        for (const [, pending] of this.pendingBroadcasts.entries()) {
            clearTimeout(pending.timeout);
            this._executeBroadcast(pending.eventType, pending.targetRoom, pending.data);
            this.stats.optimizedBroadcasts++;
        }
        this.pendingBroadcasts.clear();
    }

    /**
     * Flush broadcasts de una sala específica
     * 
     * @param {string} roomId - ID de la sala
     */
    flushRoom(roomId) {
        const toFlush = [];

        for (const [eventKey, pending] of this.pendingBroadcasts.entries()) {
            if (eventKey.startsWith(`${roomId}:`)) {
                toFlush.push(eventKey);
                clearTimeout(pending.timeout);
                this._executeBroadcast(pending.eventType, pending.targetRoom, pending.data);
                this.stats.optimizedBroadcasts++;
            }
        }

        toFlush.forEach(key => this.pendingBroadcasts.delete(key));
    }

    /**
     * Obtener estadísticas de optimización
     */
    getStats() {
        const saved = this.stats.originalBroadcasts - this.stats.optimizedBroadcasts;
        const savePercent = this.stats.originalBroadcasts > 0
            ? (saved / this.stats.originalBroadcasts * 100).toFixed(1)
            : 0;

        return {
            originalBroadcasts: this.stats.originalBroadcasts,
            optimizedBroadcasts: this.stats.optimizedBroadcasts,
            broadcastsSaved: saved,
            savePercent: parseFloat(savePercent),
            bytesSaved: this.stats.bytesSaved,
            kbSaved: (this.stats.bytesSaved / 1024).toFixed(2),
            smartFlushes: this.stats.smartFlushes,
            pendingCount: this.pendingBroadcasts.size
        };
    }

    /**
     * Reset estadísticas
     */
    resetStats() {
        this.stats = {
            originalBroadcasts: 0,
            optimizedBroadcasts: 0,
            bytesSaved: 0,
            smartFlushes: 0
        };
    }

    /**
     * Obtener configuración de debouncing
     * 
     * @param {string} eventType - Tipo de evento
     * @returns {number} Milisegundos de debounce
     */
    static getDebounceMs(eventType) {
        return DEBOUNCE_CONFIG[eventType] || DEBOUNCE_CONFIG.default;
    }

    /**
     * Configurar debounce personalizado para un tipo de evento
     * 
     * @param {string} eventType - Tipo de evento
     * @param {number} debounceMs - Milisegundos
     */
    static setDebounceMs(eventType, debounceMs) {
        DEBOUNCE_CONFIG[eventType] = debounceMs;
    }
}

module.exports = BroadcastOptimizer;
