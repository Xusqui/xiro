/**
 * @fileoverview Estrategia de puntuación basada en tiempo de respuesta
 * Implementa el sistema actual: BASE_POINTS + TIME_BONUS
 * 
 * ARQUITECTURA: Strategy Pattern
 * - Refactor del comportamiento actual en ScoringService
 * - Bonus lineal basado en tiempo restante
 * 
 * FASE 17.2 - Día 2
 * Fecha: 3 de febrero de 2026
 */

const ScoringStrategy = require('./ScoringStrategy');
const { SCORING, TIMING } = require('../../../config/game-constants');

/**
 * Estrategia de puntuación basada en velocidad de respuesta
 * 
 * Fórmula: BASE_POINTS + (timeLeft / timeLimit) × MAX_TIME_BONUS
 * 
 * Ejemplos:
 * - Respuesta instantánea (0s): 20 + 20 = 40 puntos
 * - Respuesta a mitad (15s de 30s): 20 + 10 = 30 puntos
 * - Respuesta final (30s): 20 + 0 = 20 puntos
 */
class TimeBasedScoring extends ScoringStrategy {
    /**
     * @param {Object} config - Configuración opcional
     * @param {number} config.basePoints - Puntos base (default: 20)
     * @param {number} config.maxTimeBonus - Bonus máximo por tiempo (default: 20)
     */
    constructor(config = {}) {
        super(config);
        this.basePoints = config.basePoints ?? SCORING.BASE_POINTS;
        this.maxTimeBonus = config.maxTimeBonus ?? SCORING.MAX_TIME_BONUS;
    }

    /**
     * @inheritdoc
     */
    getName() {
        return SCORING.STRATEGIES.TIME_BASED;
    }

    /**
     * Calcula el bonus de tiempo basado en velocidad de respuesta
     * 
     * @param {number} timeElapsed - Tiempo transcurrido en segundos
     * @param {number} questionTimeLimit - Límite de tiempo en segundos
     * @returns {number} Bonus de tiempo (0 a maxTimeBonus)
     */
    calculateTimeBonus(timeElapsed, questionTimeLimit) {
        const timeLeft = Math.max(0, questionTimeLimit - timeElapsed);
        const bonusRatio = timeLeft / questionTimeLimit;
        return this._round(bonusRatio * this.maxTimeBonus);
    }

    /**
     * @inheritdoc
     */
    calculatePoints(params) {
        const { isCorrect, timeElapsed, questionTimeLimit } = params;

        // Respuesta incorrecta: 0 puntos
        if (!isCorrect) {
            return {
                pointsEarned: 0,
                details: {
                    strategy: this.getName(),
                    isCorrect: false,
                    basePoints: 0,
                    timeBonus: 0,
                    timeElapsed,
                    questionTimeLimit
                }
            };
        }

        // Respuesta correcta: calcular puntos
        const timeLimit = questionTimeLimit || TIMING.DEFAULT_QUESTION_TIME;
        const timeBonus = this.calculateTimeBonus(timeElapsed, timeLimit);
        const totalPoints = this.basePoints + timeBonus;

        return {
            pointsEarned: this._round(totalPoints),
            details: {
                strategy: this.getName(),
                isCorrect: true,
                basePoints: this.basePoints,
                timeBonus,
                timeElapsed,
                questionTimeLimit: timeLimit,
                formula: `${this.basePoints} (base) + ${timeBonus} (time) = ${this._round(totalPoints)}`
            }
        };
    }

    /**
     * @inheritdoc
     */
    validateConfig(config) {
        if (config.basePoints !== undefined && config.basePoints < 0) {
            throw new Error('basePoints debe ser >= 0');
        }
        if (config.maxTimeBonus !== undefined && config.maxTimeBonus < 0) {
            throw new Error('maxTimeBonus debe ser >= 0');
        }
        return true;
    }

    /**
     * Redondea a 2 decimales
     * @private
     */
    _round(value) {
        return Math.round(value * 100) / 100;
    }
}

module.exports = TimeBasedScoring;
