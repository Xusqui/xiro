/**
 * @fileoverview Factory para crear instancias de estrategias de puntuación
 * Implementa el patrón Factory para desacoplar creación de estrategias
 * 
 * RESPONSABILIDADES:
 * - Registrar estrategias disponibles
 * - Crear instancias con configuración
 * - Validar parámetros antes de instanciar
 * - Proveer estrategia por defecto (time_based)
 * 
 * FASE 17.2 - Día 4
 * Fecha: 3 de febrero de 2026
 */

const TimeBasedScoring = require('./TimeBasedScoring');
const StreakBonusScoring = require('./StreakBonusScoring');
const BettingScoring = require('./BettingScoring');
const NumericApproximationScoring = require('./NumericApproximationScoring');
const { SCORING } = require('../../../config/game-constants');
const runtimeConfig = require('../../../config/runtime-config');

/**
 * Factory de estrategias de puntuación
 */
class ScoringStrategyFactory {
    constructor() {
        // Registro de estrategias disponibles
        this.strategies = new Map([
            [SCORING.STRATEGIES.TIME_BASED, TimeBasedScoring],
            [SCORING.STRATEGIES.STREAK_BONUS, StreakBonusScoring],
            [SCORING.STRATEGIES.BETTING, BettingScoring],
            ['numeric_approximation', NumericApproximationScoring]
        ]);
    }

    /**
     * Crea una instancia de estrategia de puntuación
     * 
     * @param {string} strategyName - Nombre de la estrategia ('time_based', 'streak_bonus', 'betting')
     * @param {Object} config - Configuración opcional para la estrategia
     * @returns {ScoringStrategy} Instancia de la estrategia
     * @throws {Error} Si la estrategia no existe
     * 
     * @example
     * const strategy = factory.create('time_based');
     * const customStrategy = factory.create('streak_bonus', { 
     *   streakThreshold: 5,
     *   streakBonusPercentage: 0.30
     * });
     */
    create(strategyName, config = {}) {
        // Si no se especifica estrategia, usar default
        const name = strategyName || SCORING.STRATEGIES.TIME_BASED;

        // Normalizar nombre (lowercase)
        const normalizedName = name.toLowerCase();

        // Verificar que existe
        if (!this.strategies.has(normalizedName)) {
            throw new Error(
                `Estrategia de puntuación desconocida: "${strategyName}". ` +
                `Disponibles: ${Array.from(this.strategies.keys()).join(', ')}`
            );
        }

        // Obtener clase
        const StrategyClass = this.strategies.get(normalizedName);

        // Crear instancia
        try {
            const instance = new StrategyClass(config);

            // Validar configuración
            instance.validateConfig(config);

            return instance;
        } catch (error) {
            throw new Error(
                `Error al crear estrategia "${strategyName}": ${error.message}`
            );
        }
    }

    /**
     * Crea estrategia basada en pregunta y configuración de juego
     * 
     * @param {Object} question - Objeto de pregunta
     * @param {string} question.scoring_strategy - Estrategia de la pregunta (opcional)
     * @param {Object} question.scoring_params - Parámetros de puntuación (opcional)
     * @param {Object} game - Objeto de juego
     * @param {number} game.streak_threshold - Umbral de racha (opcional)
     * @param {number} game.streak_bonus_percentage - Bonus de racha individual (opcional)
     * @param {boolean} game.team_streak_enabled - Si racha de equipo está activa (opcional)
     * @param {number} game.team_streak_bonus_percentage - Bonus de racha de equipo (opcional)
     * @returns {ScoringStrategy} Estrategia configurada
     * 
     * @example
     * const strategy = factory.createFromQuestion(question, game);
     */
    createFromQuestion(question, game = {}) {
        // Estrategia específica de la pregunta o default
        const strategyName = question.scoring_strategy || SCORING.STRATEGIES.TIME_BASED;

        // Configuración base de la pregunta
        let config = question.scoring_params || {};

        // Inyectar defaults dinámicos desde runtimeConfig
        config = {
            basePoints: runtimeConfig.get('BASE_POINTS'),
            maxTimeBonus: runtimeConfig.get('MAX_TIME_BONUS'),
            ...config,
        };

        // Si es streak_bonus, añadir configuración del juego
        if (strategyName === SCORING.STRATEGIES.STREAK_BONUS) {
            config = {
                ...config,
                streakThreshold: game.streak_threshold || runtimeConfig.get('STREAK_THRESHOLD'),
                streakBonusPercentage: game.streak_bonus_percentage !== undefined
                    ? game.streak_bonus_percentage
                    : runtimeConfig.get('STREAK_BONUS_PERCENTAGE'),
                teamStreakEnabled: game.team_streak_enabled,
                teamStreakBonusPercentage: game.team_streak_bonus_percentage
            };
        }

        return this.create(strategyName, config);
    }

    /**
     * Registra una nueva estrategia
     * 
     * @param {string} name - Nombre de la estrategia
     * @param {Class} StrategyClass - Clase de la estrategia
     * @throws {Error} Si la clase no extiende ScoringStrategy
     */
    register(name, StrategyClass) {
        // Verificar que es una clase válida
        if (typeof StrategyClass !== 'function') {
            throw new Error('StrategyClass debe ser una clase (función constructora)');
        }

        // Registrar
        this.strategies.set(name.toLowerCase(), StrategyClass);
    }

    /**
     * Obtiene lista de estrategias disponibles
     * 
     * @returns {string[]} Array de nombres de estrategias
     */
    getAvailableStrategies() {
        return Array.from(this.strategies.keys());
    }

    /**
     * Verifica si una estrategia existe
     * 
     * @param {string} strategyName - Nombre de la estrategia
     * @returns {boolean} true si existe
     */
    hasStrategy(strategyName) {
        return this.strategies.has(strategyName.toLowerCase());
    }
}

// Singleton
const factory = new ScoringStrategyFactory();

module.exports = factory;
