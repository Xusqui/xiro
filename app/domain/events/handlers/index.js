/**
 * @fileoverview Registro centralizado de Event Handlers
 * @module domain/events/handlers
 * 
 * Configura y registra todos los event handlers del sistema.
 * Los handlers escuchan eventos del EventBus y ejecutan side effects.
 */

const GameStartedHandler = require('./GameStartedHandler');
const QuestionRevealedHandler = require('./QuestionRevealedHandler');
const PlayerScoredHandler = require('./PlayerScoredHandler');
const GameEndedHandler = require('./GameEndedHandler');
const RankingCacheHandler = require('./RankingCacheHandler');
const CacheInvalidationService = require('../../../services/CacheInvalidationService');

/**
 * Registra todos los event handlers
 * @param {EventBus} eventBus - Instancia del EventBus
 * @param {Object} io - Socket.IO server instance
 * @param {Object} dependencies - Dependencias opcionales (db, cache, logger, etc.)
 * @returns {Array} Array de handlers registrados
 */
function registerAllHandlers(eventBus, io, dependencies = {}) {
    const handlers = [];
    const logger = dependencies.logger || console;

    try {
        // Game lifecycle handlers
        const gameStartedHandler = new GameStartedHandler(eventBus, io, dependencies);
        gameStartedHandler.register();
        handlers.push(gameStartedHandler);

        const questionRevealedHandler = new QuestionRevealedHandler(eventBus, io, dependencies);
        questionRevealedHandler.register();
        handlers.push(questionRevealedHandler);

        const playerScoredHandler = new PlayerScoredHandler(eventBus, io, dependencies);
        playerScoredHandler.register();
        handlers.push(playerScoredHandler);

        const gameEndedHandler = new GameEndedHandler(eventBus, io, dependencies);
        gameEndedHandler.register();
        handlers.push(gameEndedHandler);

        // Cache handlers
        const rankingCacheHandler = new RankingCacheHandler(eventBus, io, dependencies);
        rankingCacheHandler.register();
        handlers.push(rankingCacheHandler);

        const cacheInvalidationService = new CacheInvalidationService(eventBus, io, dependencies);
        cacheInvalidationService.register();
        handlers.push(cacheInvalidationService);

        logger.info(`✅ Event handlers registered (${handlers.length} total)`);

        return handlers;
    } catch (error) {
        logger.error('❌ Error registering event handlers:', error);
        throw error;
    }
}

/**
 * Desregistra todos los handlers (cleanup)
 * @param {Array} handlers - Array de handlers a desregistrar
 * @param {Object} [logger] - Logger opcional
 */
function unregisterAllHandlers(handlers, logger) {
    const log = logger || console;
    handlers.forEach(handler => {
        try {
            handler.unregister();
        } catch (error) {
            log.error('Error unregistering handler:', handler.constructor.name, error);
        }
    });
    log.info(`✅ Event handlers unregistered (${handlers.length} total)`);
}

module.exports = {
    registerAllHandlers,
    unregisterAllHandlers,
    // Export individual handlers for testing
    GameStartedHandler,
    QuestionRevealedHandler,
    PlayerScoredHandler,
    GameEndedHandler,
    RankingCacheHandler,
    CacheInvalidationService
};
