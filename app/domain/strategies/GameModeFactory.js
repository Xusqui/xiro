/**
 * @fileoverview Factory para crear estrategias de modo de juego
 * Patrón Factory + Singleton para reutilizar instancias
 */

const IndividualGameMode = require('./IndividualGameMode');
const TeamGameMode = require('./TeamGameMode');
const logger = require('../../config/logger');

/**
 * Factory para crear instancias de GameModeStrategy
 * Usa patrón Singleton para reutilizar instancias
 */
class GameModeFactory {
    constructor() {
        // Cache de instancias (Singleton por estrategia)
        this._individualInstance = null;
        this._teamInstance = null;
    }

    /**
     * Crea o retorna estrategia según el modo de juego
     * @param {boolean} isTeamMode - true para equipos, false para individual
     * @returns {GameModeStrategy} Instancia de la estrategia
     */
    createStrategy(isTeamMode) {
        if (isTeamMode) {
            if (!this._teamInstance) {
                this._teamInstance = new TeamGameMode();
                logger.debug('TeamGameMode instance created');
            }
            return this._teamInstance;
        } else {
            if (!this._individualInstance) {
                this._individualInstance = new IndividualGameMode();
                logger.debug('IndividualGameMode instance created');
            }
            return this._individualInstance;
        }
    }

    /**
     * Determina el modo de juego desde diferentes fuentes
     * @param {Object} params - Parámetros
     * @param {Object} [params.game] - Estado del juego
     * @param {Object} [params.teamConfig] - Configuración de equipos
     * @param {boolean} [params.isTeamMode] - Flag explícito
     * @returns {boolean} true si es modo equipos
     */
    determineTeamMode(params) {
        const { game, teamConfig, isTeamMode } = params;

        // Prioridad 1: Flag explícito
        if (typeof isTeamMode === 'boolean') {
            return isTeamMode;
        }

        // Prioridad 2: TeamConfig con isTeamMode
        if (teamConfig && teamConfig.isTeamMode === true) {
            return true;
        }

        // Prioridad 3: Game mode
        if (game && game.mode === 'teams') {
            return true;
        }

        // Default: modo individual
        return false;
    }

    /**
     * Limpia el caché de instancias (útil para tests)
     */
    clearCache() {
        this._individualInstance = null;
        this._teamInstance = null;
        logger.debug('GameModeFactory cache cleared');
    }
}

// Singleton de la factory
const factoryInstance = new GameModeFactory();

module.exports = factoryInstance;
module.exports.GameModeFactory = GameModeFactory; // Para tests
