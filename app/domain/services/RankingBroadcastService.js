/**
 * @fileoverview Ranking Broadcast Service - Gestión de emisión de rankings con deltas
 * @module domain/services/RankingBroadcastService
 * 
 * Responsabilidades:
 * - Emitir rankings al presentador con throttling
 * - Optimizar broadcasts usando delta updates (60-70% reducción)
 * - Emitir rankings a jugadores que han respondido
 * - Evitar broadcasts innecesarios (throttling de 500ms)
 */

const RankingDeltaCalculator = require('./RankingDeltaCalculator');
const rankingCache = require('./LastRankingBuffer');

/**
 * Broadcast ranking a jugadores que ya respondieron la pregunta actual
 * Consolida código duplicado entre broadcastRanking y forceBroadcastRanking
 * @private
 */
async function emitRankingToPlayersWhoAnswered(io, roomId, game, payload) {
    const playersRoom = `${roomId}:players`;
    const allPlayerSockets = await io.in(playersRoom).fetchSockets();

    for (const playerSocket of allPlayerSockets) {
        if (playerSocket.data?.answeredQuestions?.includes(game.currentIndex)) {
            io.to(playerSocket.id).emit('ranking-update', payload);
        }
    }
}

/**
 * Calcular y emitir ranking (con delta si es posible)
 * @private
 */
function emitRankingOptimized(io, roomId, sortedScores, useDelta = true) {
    let payload;

    if (useDelta) {
        // Obtener ranking anterior
        const oldRanking = rankingCache.get(roomId);

        // Calcular delta
        const deltaResult = RankingDeltaCalculator.calculate(oldRanking, sortedScores);

        if (deltaResult.type === 'delta') {
            // Enviar solo cambios (60-70% reducción)
            payload = {
                type: 'delta',
                ...deltaResult.data
            };
        } else {
            // Enviar ranking completo (demasiados cambios)
            payload = {
                type: 'full',
                ranking: sortedScores
            };
        }

        // Cachear nuevo ranking
        rankingCache.set(roomId, sortedScores);
    } else {
        // Forzar ranking completo (sin delta)
        payload = {
            type: 'full',
            ranking: sortedScores
        };
    }

    // Emitir al presentador
    io.to(`${roomId}:presenter`).emit('ranking-update', payload);

    return payload;
}

class RankingBroadcastService {
    /**
     * Broadcast de ranking con throttling y delta updates
     * @param {Object} params
     * @param {string} params.roomId - ID de la sala
     * @param {Object} params.game - Estado del juego
     * @param {Array} params.sortedScores - Ranking ordenado
     * @param {Object} params.io - Socket.IO server instance
     * @param {number} params.throttleMs - Milisegundos de throttle (default: 500)
     * @param {boolean} params.useDelta - Usar delta updates (default: true)
     * @returns {Promise<boolean>} true si se emitió, false si se hizo throttle
     */
    static async broadcastRanking({
        roomId,
        game,
        sortedScores,
        io,
        throttleMs = 500,
        useDelta = true
    }) {
        const lastRankingBroadcast = game.lastRankingBroadcast || 0;
        const now = Date.now();

        // Aplicar throttling
        if (now - lastRankingBroadcast < throttleMs) {
            return false; // No emitir, muy pronto desde el último broadcast
        }

        // Emitir con delta optimization
        const payload = emitRankingOptimized(io, roomId, sortedScores, useDelta);

        // Emitir a jugadores que ya respondieron
        await emitRankingToPlayersWhoAnswered(io, roomId, game, payload);

        // Actualizar timestamp del último broadcast
        game.lastRankingBroadcast = now;

        return true; // Emitido exitosamente
    }

    /**
     * Forzar broadcast inmediato (sin throttling, con delta opcional)
     * Útil para eventos importantes (fin de pregunta, fin de juego)
     * @param {Object} params - Same as broadcastRanking
     * @param {boolean} params.useDelta - Usar delta (default: false para eventos finales)
     * @returns {Promise<boolean>} Always true
     */
    static async forceBroadcastRanking({
        roomId,
        game,
        sortedScores,
        io,
        useDelta = false
    }) {
        // Emitir con delta opcional (generalmente false para eventos finales)
        const payload = emitRankingOptimized(io, roomId, sortedScores, useDelta);

        // Emitir a jugadores que ya respondieron
        await emitRankingToPlayersWhoAnswered(io, roomId, game, payload);

        // Actualizar timestamp
        game.lastRankingBroadcast = Date.now();

        return true;
    }

    /**
     * Limpiar caché de ranking al finalizar juego
     * @param {string} roomId - ID de la sala
     */
    static clearRankingCache(roomId) {
        rankingCache.delete(roomId);
    }
}

module.exports = RankingBroadcastService;
