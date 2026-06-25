/**
 * @fileoverview Servicio de invalidación inteligente de cachés
 * 
 * Coordina la invalidación en cascada de múltiples capas de caché
 * cuando ocurren eventos relevantes del dominio (game.ended, player.joined).
 * 
 * Patrón: Event-driven cache invalidation
 * - game.ended → RankingCache + SessionStore + QuestionBankCache
 * - player.joined → SessionStore (refresco de sesión)
 * 
 * La invalidación en cascada es tolerante a fallos: si un caché falla,
 * los demás se siguen invalidando igualmente.
 * 
 * @module CacheInvalidationService
 * @extends EventHandler
 * @requires domain/events/handlers/EventHandler
 * @requires services/cache.service
 * @requires services/RankingCache
 * @requires services/SessionStore
 * @requires config/logger
 */

const EventHandler = require('../domain/events/handlers/EventHandler');
const { questionBankCache } = require('./cache.service');
const rankingCache = require('./RankingCache');
const sessionStore = require('./SessionStore');
const logger = require('../config/logger');

class CacheInvalidationService extends EventHandler {
    /**
     * @constructor
     * @param {EventEmitter} eventBus - Bus de eventos del dominio
     * @param {object} io - Instancia de Socket.IO (inyectada por convención)
     * @param {object} [dependencies={}] - Dependencias adicionales opcionales
     */
    constructor(eventBus, io, dependencies = {}) {
        super(eventBus, io, dependencies);
        this.stats = { gameEndedInvalidations: 0, playerJoinedInvalidations: 0, cascadeInvalidations: 0, errors: 0, lastInvalidation: null };
    }

    /**
     * Registra los listeners de eventos del dominio.
     * - game.ended: invalidación en cascada completa
     * - player.joined: invalidación de SessionStore
     */
    register() {
        // GameEndedEvent → invalidar RankingCache + SessionStore + QuestionBankCache
        this.subscribe('game.ended', this.handleGameEnded.bind(this));

        // PlayerJoinedEvent → invalidar SessionStore del juego
        this.subscribe('player.joined', this.handlePlayerJoined.bind(this));

        logger.info('CacheInvalidationService registered', { listeners: ['game.ended', 'player.joined'] });
    }

    /**
     * Maneja el evento game.ended con invalidación en cascada.
     * Orden: RankingCache → SessionStore → QuestionBankCache
     * Cada paso es independiente: si uno falla, los demás continúan.
     * 
     * @param {object} event - Evento game.ended
     * @param {string} event.gameId - ID del juego finalizado
     * @param {string} [event.sessionId] - ID de sesión (usa gameId si no se proporciona)
     */
    async handleGameEnded(event) {
        const { gameId, sessionId } = event;

        if (!gameId) {
            logger.warn('CacheInvalidationService: GameEndedEvent sin gameId', { event });
            return;
        }

        try {
            logger.info('CacheInvalidationService: Iniciando invalidación en cascada (game.ended)', {
                gameId, sessionId: sessionId || gameId
            });

            const invalidatedCaches = [];

            // 1. Invalidar RankingCache
            const actualSessionId = sessionId || gameId;
            try {
                await rankingCache.invalidate(actualSessionId);
                invalidatedCaches.push('RankingCache');
            } catch (error) {
                logger.error('Error invalidando RankingCache', { sessionId: actualSessionId, error: error.message });
            }

            // 2. Invalidar SessionStore
            try {
                await sessionStore.invalidate(actualSessionId);
                invalidatedCaches.push('SessionStore');
            } catch (error) {
                logger.error('Error invalidando SessionStore', { sessionId: actualSessionId, error: error.message });
            }

            // 3. Invalidar QuestionBankCache
            try {
                questionBankCache.invalidateGame(gameId, 'game');
                invalidatedCaches.push('QuestionBankCache');
            } catch (error) {
                logger.error('Error invalidando QuestionBankCache', { gameId, error: error.message });
            }

            this.stats.gameEndedInvalidations++;
            this.stats.cascadeInvalidations += invalidatedCaches.length;
            this.stats.lastInvalidation = new Date();

            logger.info('CacheInvalidationService: Invalidación en cascada completada', {
                gameId, sessionId: actualSessionId, invalidatedCaches, count: invalidatedCaches.length
            });
        } catch (error) {
            this.stats.errors++;
            logger.error('CacheInvalidationService: Error en handleGameEnded', {
                gameId, sessionId, error: error.message, stack: error.stack
            });
        }
    }

    /**
     * Maneja el evento player.joined invalidando la sesión.
     * Esto fuerza un refresco de los datos de sesión del juego.
     * 
     * @param {object} event - Evento player.joined
     * @param {string} event.gameId - ID del juego
     * @param {string} event.playerId - ID del jugador
     * @param {string} event.nickname - Nombre del jugador
     */
    async handlePlayerJoined(event) {
        const { gameId, playerId, nickname } = event;

        if (!gameId) {
            logger.warn('CacheInvalidationService: PlayerJoinedEvent sin gameId', { event });
            return;
        }

        try {
            logger.debug('CacheInvalidationService: Invalidando SessionStore (player.joined)', {
                gameId, playerId, nickname
            });

            await sessionStore.invalidate(gameId);

            this.stats.playerJoinedInvalidations++;
            this.stats.lastInvalidation = new Date();
        } catch (error) {
            this.stats.errors++;
            logger.error('CacheInvalidationService: Error en handlePlayerJoined', {
                gameId, playerId, error: error.message, stack: error.stack
            });
        }
    }

    /**
     * Retorna estadísticas de invalidaciones realizadas.
     * @returns {{gameEndedInvalidations: number, playerJoinedInvalidations: number, cascadeInvalidations: number, errors: number, lastInvalidation: Date|null, totalInvalidations: number}}
     */
    getStats() {
        return {
            ...this.stats,
            totalInvalidations: this.stats.gameEndedInvalidations + this.stats.playerJoinedInvalidations
        };
    }

    /** Resetea todas las estadísticas a cero. */
    resetStats() {
        this.stats = { gameEndedInvalidations: 0, playerJoinedInvalidations: 0, cascadeInvalidations: 0, errors: 0, lastInvalidation: null };
    }

    unregister() {
        super.unregister();
    }
}

module.exports = CacheInvalidationService;
