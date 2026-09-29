/**
 * @fileoverview Handler para actualizar caché de ranking incrementalmente
 * @module domain/events/handlers/RankingCacheHandler
 */

const EventHandler = require('./EventHandler');
const rankingCache = require('../../../services/RankingCache');
const logger = require('../../../config/logger');

/**
 * Handler de eventos relacionados con ranking
 * Escucha: PlayerScoredEvent, GameEndedEvent
 * 
 * Responsabilidades:
 * - Actualizar caché incremental cuando cambia score de jugador
 * - Invalidar caché cuando termina el juego
 */
class RankingCacheHandler extends EventHandler {
    /**
     * Constructor
     * @param {EventBus} eventBus - Instancia del EventBus
     * @param {Object} io - Socket.IO server instance (no usado aquí)
     * @param {Object} dependencies - Dependencias opcionales
     */
    constructor(eventBus, io, dependencies = {}) {
        super(eventBus, io, dependencies);
    }

    /**
     * Registrar listeners de eventos
     */
    register() {
        // Listener para PlayerScoredEvent
        this.subscribe('player.scored', (event) => this.handlePlayerScored(event));

        // Listener para GameEndedEvent
        this.subscribe('game.ended', (event) => this.handleGameEnded(event));
    }

    /**
     * Manejar evento PlayerScoredEvent
     * Actualiza score de jugador en caché incremental
     * 
     * @param {Object} event - PlayerScoredEvent
     * @param {string} event.gameId - ID del juego
     * @param {string} event.playerId - ID del jugador
     * @param {string} event.nickname - Nickname del jugador
     * @param {number} event.newScore - Nuevo score total
     */
    async handlePlayerScored(event) {
        try {
            const gameId = event?.gameId || event?.payload?.gameId;
            const nickname = event?.nickname || event?.payload?.nickname;
            const newScore =
                event?.newScore ??
                event?.totalScore ??
                event?.payload?.newScore ??
                event?.payload?.totalScore;

            if (!gameId || !nickname || newScore === undefined) {
                logger.warn('RankingCacheHandler: PlayerScoredEvent incompleto', { event });
                return;
            }

            // Actualizar score en caché incremental
            await rankingCache.updateIncremental(gameId, nickname, newScore);

        } catch (error) {
            logger.error('RankingCacheHandler: Error en handlePlayerScored', {
                error: error.message,
                event
            });
        }
    }

    /**
     * Manejar evento GameEndedEvent
     * Invalida caché de ranking cuando termina el juego
     * 
     * @param {Object} event - GameEndedEvent
     * @param {string} event.gameId - ID del juego
     */
    async handleGameEnded(event) {
        try {
            const gameId = event?.gameId || event?.payload?.gameId;

            if (!gameId) {
                logger.warn('RankingCacheHandler: GameEndedEvent sin gameId', { event });
                return;
            }

            // Invalidar caché de ranking
            const invalidated = await rankingCache.invalidate(gameId);

            if (invalidated) {
                logger.info(`RankingCacheHandler: Invalidado caché de ranking para ${gameId}`);
            } else {
                logger.debug(`RankingCacheHandler: No había caché de ranking para ${gameId}`);
            }

        } catch (error) {
            logger.error('RankingCacheHandler: Error en handleGameEnded', {
                error: error.message,
                event
            });
        }
    }
}

module.exports = RankingCacheHandler;
