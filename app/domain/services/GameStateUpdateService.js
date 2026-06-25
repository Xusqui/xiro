/**
 * @fileoverview Game State Update Service - Sincronización cross-worker via Redis
 * @module domain/services/GameStateUpdateService
 * 
 * Responsabilidades:
 * - Publicar actualizaciones de estado del juego a Redis
 * - Sincronización delta-based (solo jugador que cambió)
 * - Logging de sincronización para debugging
 */

class GameStateUpdateService {
    /**
     * Publicar actualización de score de un jugador
     * Usa delta-based updates para evitar race conditions cross-worker
     * 
     * @param {Object} params
     * @param {string} params.roomId - ID de la sala
     * @param {string} params.nickname - Nickname del jugador
     * @param {number} params.score - Score actualizado del jugador
     * @param {number} params.currentIndex - Índice de la pregunta actual
     * @param {Object} params.allScores - Objeto completo de scores (para logging)
     * @param {Object} params.syncBus - Instancia de RedisSyncBus
     * @param {Object} params.logger - Instancia del logger
     * @returns {Promise<void>}
     */
    static async publishScoreUpdate({
        roomId,
        nickname,
        score,
        currentIndex,
        allScores,
        syncBus,
        logger
    }) {
        if (typeof logger.isDebugEnabled !== 'function' || logger.isDebugEnabled()) {
            logger.debug('📤 Publicando delta score a Redis', {
                roomId,
                nickname,
                score,
                currentIndex,
                allScoresBeforePublish: JSON.stringify(allScores),
                workerId: process.pid
            });
        }

        await syncBus.publishGameStateUpdate(roomId, nickname, score, currentIndex);
    }

    /**
     * Publicar que un jugador respondió
     * @param {Object} params
     * @param {string} params.roomId - ID de la sala
     * @param {string} params.nickname - Nickname del jugador
     * @param {boolean|null} params.correct - Si respondió correctamente (null en modo equipos/encuesta)
     * @param {Object} params.syncBus - Instancia de RedisSyncBus
     * @returns {Promise<void>}
     */
    static async publishPlayerAnswered({
        roomId,
        nickname,
        correct,
        syncBus
    }) {
        await syncBus.publishPlayerAnswered(roomId, nickname, correct);
    }
}

module.exports = GameStateUpdateService;
