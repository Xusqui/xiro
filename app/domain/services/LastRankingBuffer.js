/**
 * @fileoverview LastRankingBuffer - Almacena el último ranking emitido por sala
 * @module domain/services/LastRankingBuffer
 * 
 * Responsabilidades:
 * - Almacenar último ranking enviado por sala
 * - Recuperar último ranking para comparar deltas
 * - Limpiar cachés de salas finalizadas
 * 
 * Estructura:
 * - Map<roomId, {ranking, timestamp}>
 */

class LastRankingBuffer {
    constructor() {
        /**
         * Caché de rankings por sala
         * @type {Map<string, Object>}
         */
        this.cache = new Map();

        /**
         * TTL por defecto: 2 horas (juegos antiguos se limpian)
         */
        this.TTL_MS = 2 * 60 * 60 * 1000;
    }

    /**
     * Guardar ranking en caché
     * 
     * @param {string} roomId - ID de la sala
     * @param {Array} ranking - Ranking completo
     */
    set(roomId, ranking) {
        this.cache.set(roomId, {
            ranking: JSON.parse(JSON.stringify(ranking)), // Deep copy
            timestamp: Date.now()
        });
    }

    /**
     * Obtener último ranking de una sala
     * 
     * @param {string} roomId - ID de la sala
     * @returns {Array|null} Ranking o null si no existe
     */
    get(roomId) {
        const cached = this.cache.get(roomId);

        if (!cached) {
            return null;
        }

        // Verificar TTL
        const age = Date.now() - cached.timestamp;
        if (age > this.TTL_MS) {
            this.cache.delete(roomId);
            return null;
        }

        return cached.ranking;
    }

    /**
     * Eliminar ranking de una sala (al finalizar juego)
     * 
     * @param {string} roomId - ID de la sala
     */
    delete(roomId) {
        this.cache.delete(roomId);
    }

    /**
     * Limpiar rankings antiguos (ejecutar periódicamente)
     * 
     * @returns {number} Número de cachés eliminados
     */
    cleanup() {
        const now = Date.now();
        let deleted = 0;

        for (const [roomId, cached] of this.cache.entries()) {
            const age = now - cached.timestamp;
            if (age > this.TTL_MS) {
                this.cache.delete(roomId);
                deleted++;
            }
        }

        return deleted;
    }

    /**
     * Obtener estadísticas del caché
     * 
     * @returns {Object} Estadísticas
     */
    getStats() {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());

        return {
            totalRooms: this.cache.size,
            oldestCache: entries.length > 0
                ? Math.max(...entries.map(([, v]) => now - v.timestamp))
                : 0,
            avgSize: entries.length > 0
                ? Math.round(
                    entries.reduce((sum, [, v]) => sum + v.ranking.length, 0) / entries.length
                )
                : 0
        };
    }

    /**
     * Limpiar todo el caché (para testing)
     */
    clear() {
        this.cache.clear();
    }
}

// Singleton
const instance = new LastRankingBuffer();

module.exports = instance;
