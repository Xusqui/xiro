/**
 * @fileoverview Estrategia de puntuación basada en apuestas
 * El jugador apuesta puntos antes de responder
 * 
 * FLUJO:
 * 1. Jugador ve la pregunta (sin opciones)
 * 2. Jugador apuesta X puntos (mínimo: 10% de sus puntos)
 * 3. Esperar a que todos apuesten
 * 4. Revelar opciones de respuesta
 * 5. Jugador responde
 * 6. Si acierta: +apuesta + timeBonus
 *    Si falla: -apuesta
 * 
 * FASE 17.2 - Día 3
 * Fecha: 3 de febrero de 2026
 */

const ScoringStrategy = require('./ScoringStrategy');
const { SCORING, TIMING } = require('../../../config/game-constants');

/**
 * Estrategia de apuesta de puntos
 * 
 * Ejemplo:
 * - Jugador tiene 100 puntos
 * - Apuesta 50 puntos
 * - Responde correctamente en 5s
 * - Gana: 50 (apuesta) + 16.67 (timeBonus) = 66.67 puntos
 * - Total: 166.67 puntos
 * 
 * Si falla:
 * - Pierde: 50 puntos
 * - Total: 50 puntos
 */
class BettingScoring extends ScoringStrategy {
    /**
     * @param {Object} config - Configuración
     * @param {number} config.maxTimeBonus - Bonus máximo por tiempo (default: 20)
     * @param {number} config.minBetPercentage - % mínimo de apuesta (default: 0.10 = 10%)
     * @param {number} config.minBetAbsolute - Apuesta mínima absoluta (default: 10)
     * @param {number} config.maxBetAbsolute - Apuesta máxima absoluta (default: 1000)
     * @param {boolean} config.allowNegativeScore - Permitir puntuación negativa (default: false)
     * @param {boolean} config.includeTimeBonus - Incluir bonus de tiempo (default: true)
     */
    constructor(config = {}) {
        super(config);
        this.maxTimeBonus = config.maxTimeBonus || SCORING.MAX_TIME_BONUS;
        this.minBetPercentage = config.minBetPercentage !== undefined
            ? config.minBetPercentage
            : SCORING.BETTING.MIN_BET_PERCENTAGE;
        this.minBetAbsolute = config.minBetAbsolute !== undefined
            ? config.minBetAbsolute
            : SCORING.BETTING.MIN_BET_ABSOLUTE;
        this.maxBetAbsolute = config.maxBetAbsolute !== undefined
            ? config.maxBetAbsolute
            : SCORING.BETTING.MAX_BET_ABSOLUTE;
        this.allowNegativeScore = config.allowNegativeScore !== undefined
            ? config.allowNegativeScore
            : SCORING.BETTING.ALLOW_NEGATIVE_SCORE;
        this.includeTimeBonus = config.includeTimeBonus !== undefined
            ? config.includeTimeBonus
            : SCORING.BETTING.INCLUDE_TIME_BONUS;
    }

    /**
     * @inheritdoc
     */
    getName() {
        return SCORING.STRATEGIES.BETTING;
    }

    /**
     * Calcula bonus de tiempo
     */
    calculateTimeBonus(timeElapsed, questionTimeLimit) {
        if (!this.includeTimeBonus) return 0;

        const timeLeft = Math.max(0, questionTimeLimit - timeElapsed);
        const bonusRatio = timeLeft / questionTimeLimit;
        return this._round(bonusRatio * this.maxTimeBonus);
    }

    /**
     * Calcula apuesta mínima requerida basada en puntos actuales
     * @param {number} currentScore - Puntuación actual del jugador
     * @returns {number} Apuesta mínima
     */
    calculateMinBet(currentScore) {
        const percentageBet = currentScore * this.minBetPercentage;
        return Math.max(this.minBetAbsolute, this._round(percentageBet));
    }

    /**
     * Calcula apuesta máxima permitida
     * @param {number} currentScore - Puntuación actual del jugador
     * @returns {number} Apuesta máxima
     */
    calculateMaxBet(currentScore) {
        if (this.allowNegativeScore) {
            return this.maxBetAbsolute;
        }
        // Si no permite negativo, máximo es su score actual
        return Math.min(currentScore, this.maxBetAbsolute);
    }

    /**
     * Valida si una apuesta es válida
     * @param {number} betAmount - Cantidad apostada
     * @param {number} currentScore - Puntuación actual
     * @returns {Object} { valid: boolean, reason?: string, adjustedBet?: number }
     */
    validateBet(betAmount, currentScore) {
        const minBet = this.calculateMinBet(currentScore);
        const maxBet = this.calculateMaxBet(currentScore);

        if (betAmount < minBet) {
            return {
                valid: false,
                reason: `Apuesta mínima: ${minBet}`,
                adjustedBet: minBet
            };
        }

        if (betAmount > maxBet) {
            return {
                valid: false,
                reason: `Apuesta máxima: ${maxBet}`,
                adjustedBet: maxBet
            };
        }

        return { valid: true };
    }

    /**
     * @inheritdoc
     */
    calculatePoints(params) {
        const {
            isCorrect,
            timeElapsed,
            questionTimeLimit,
            playerState = {},
            betState = {}
        } = params;

        const timeLimit = questionTimeLimit || TIMING.DEFAULT_QUESTION_TIME;
        const currentScore = playerState.currentScore || 0;
        const betAmount = betState.betAmount || this.calculateMinBet(currentScore);

        // Validar apuesta
        const validation = this.validateBet(betAmount, currentScore);
        const finalBet = validation.valid ? betAmount : validation.adjustedBet;

        // Respuesta incorrecta: pierde la apuesta
        if (!isCorrect) {
            let pointsLost = finalBet;

            // Si no permite negativo, limitar pérdida
            if (!this.allowNegativeScore) {
                pointsLost = Math.min(pointsLost, currentScore);
            }

            return {
                pointsEarned: -pointsLost,
                details: {
                    strategy: this.getName(),
                    isCorrect: false,
                    betAmount: finalBet,
                    betValid: validation.valid,
                    timeBonus: 0,
                    pointsLost,
                    currentScore,
                    newScore: currentScore - pointsLost,
                    timeElapsed,
                    questionTimeLimit: timeLimit
                }
            };
        }

        // Respuesta correcta: gana apuesta + timeBonus
        const timeBonus = this.calculateTimeBonus(timeElapsed, timeLimit);
        const totalPoints = finalBet + timeBonus;

        return {
            pointsEarned: this._round(totalPoints),
            details: {
                strategy: this.getName(),
                isCorrect: true,
                betAmount: finalBet,
                betValid: validation.valid,
                timeBonus,
                currentScore,
                newScore: currentScore + totalPoints,
                timeElapsed,
                questionTimeLimit: timeLimit,
                formula: `${finalBet} (bet) + ${timeBonus} (time) = ${this._round(totalPoints)}`
            }
        };
    }

    /**
     * @inheritdoc
     */
    validateConfig(config) {
        if (config.maxTimeBonus !== undefined && config.maxTimeBonus < 0) {
            throw new Error('maxTimeBonus debe ser >= 0');
        }
        if (config.minBetPercentage !== undefined &&
            (config.minBetPercentage < 0 || config.minBetPercentage > 1)) {
            throw new Error('minBetPercentage debe estar entre 0 y 1');
        }
        if (config.minBetAbsolute !== undefined && config.minBetAbsolute < 0) {
            throw new Error('minBetAbsolute debe ser >= 0');
        }
        if (config.maxBetAbsolute !== undefined && config.maxBetAbsolute < 0) {
            throw new Error('maxBetAbsolute debe ser >= 0');
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

module.exports = BettingScoring;
