/**
 * @fileoverview Estrategia de puntuación con bonificación por racha
 * Añade bonus acumulativo por respuestas correctas consecutivas
 * 
 * CARACTERÍSTICAS:
 * - Racha individual: +X% después de N respuestas correctas
 * - Racha de equipo: +Y% adicional si TODO el equipo está en racha
 * - Acumulación ADITIVA: points × (1 + bonusIndividual + bonusEquipo)
 * - Reset individual: al fallar una pregunta
 * - Reset equipo: si UN jugador falla
 * 
 * FASE 17.2 - Día 2
 * Fecha: 3 de febrero de 2026
 */

const ScoringStrategy = require('./ScoringStrategy');
const { SCORING, TIMING } = require('../../../config/game-constants');

/**
 * Estrategia con bonus por racha de aciertos consecutivos
 * 
 * Ejemplo con threshold=3, bonus=50%:
 * - Pregunta 1 correcta: 40 puntos (sin racha)
 * - Pregunta 2 correcta: 40 puntos (sin racha)
 * - Pregunta 3 correcta: 40 + 20 (50%) = 60 puntos (racha activada)
 * - Pregunta 4 correcta: 40 + 20 = 60 puntos (mantiene racha)
 * - Pregunta 5 incorrecta: 0 puntos (racha perdida)
 */
class StreakBonusScoring extends ScoringStrategy {
    /**
     * @param {Object} config - Configuración
     * @param {number} config.basePoints - Puntos base (default: 20)
     * @param {number} config.maxTimeBonus - Bonus máximo por tiempo (default: 20)
     * @param {number} config.streakThreshold - Respuestas correctas para activar racha (default: 3)
     * @param {number} config.streakBonusPercentage - Bonus individual por racha (default: 0.50 = 50%)
     * @param {number} config.teamStreakBonusPercentage - Bonus equipo (default: 0.50 = 50%)
     * @param {boolean} config.teamStreakEnabled - Activar racha de equipo (default: false)
     */
    constructor(config = {}) {
        super(config);
        this.basePoints = config.basePoints || SCORING.BASE_POINTS;
        this.maxTimeBonus = config.maxTimeBonus || SCORING.MAX_TIME_BONUS;
        this.streakThreshold = config.streakThreshold || SCORING.STREAK.DEFAULT_THRESHOLD;
        this.streakBonusPercentage = config.streakBonusPercentage !== undefined
            ? config.streakBonusPercentage
            : SCORING.STREAK.DEFAULT_BONUS_PERCENTAGE;
        this.teamStreakBonusPercentage = config.teamStreakBonusPercentage !== undefined
            ? config.teamStreakBonusPercentage
            : SCORING.STREAK.DEFAULT_TEAM_BONUS_PERCENTAGE;
        this.teamStreakEnabled = config.teamStreakEnabled || false;
    }

    /**
     * @inheritdoc
     */
    getName() {
        return SCORING.STRATEGIES.STREAK_BONUS;
    }

    /**
     * Calcula bonus de tiempo (mismo que TimeBasedScoring)
     */
    calculateTimeBonus(timeElapsed, questionTimeLimit) {
        const timeLeft = Math.max(0, questionTimeLimit - timeElapsed);
        const bonusRatio = timeLeft / questionTimeLimit;
        return this._round(bonusRatio * this.maxTimeBonus);
    }

    /**
     * Determina si el jugador tiene racha activa
     */
    isPlayerInStreak(currentStreak) {
        return currentStreak >= this.streakThreshold;
    }

    /**
     * Determina si el equipo completo está en racha
     */
    isTeamInStreak(teamState) {
        if (!this.teamStreakEnabled || !teamState) {
            return false;
        }
        return teamState.inStreak === true;
    }

    /**
     * Calcula bonus total de racha (individual + equipo)
     * Acumulación ADITIVA: bonusIndividual + bonusEquipo
     */
    calculateStreakBonus(playerStreak, teamInStreak, basePoints) {
        let totalBonusPercentage = 0;
        const details = {
            playerInStreak: this.isPlayerInStreak(playerStreak),
            teamInStreak: teamInStreak,
            playerBonusPercentage: 0,
            teamBonusPercentage: 0
        };

        // Bonus individual
        if (this.isPlayerInStreak(playerStreak)) {
            totalBonusPercentage += this.streakBonusPercentage;
            details.playerBonusPercentage = this.streakBonusPercentage;
        }

        // Bonus de equipo (solo si jugador también está en racha)
        if (details.playerInStreak && teamInStreak) {
            totalBonusPercentage += this.teamStreakBonusPercentage;
            details.teamBonusPercentage = this.teamStreakBonusPercentage;
        }

        const bonusPoints = basePoints * totalBonusPercentage;

        return {
            bonusPoints: this._round(bonusPoints),
            totalBonusPercentage,
            ...details
        };
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
            teamState = {}
        } = params;

        const timeLimit = questionTimeLimit || TIMING.DEFAULT_QUESTION_TIME;
        const currentStreak = playerState.currentStreak || 0;

        // Respuesta incorrecta: 0 puntos
        if (!isCorrect) {
            return {
                pointsEarned: 0,
                details: {
                    strategy: this.getName(),
                    isCorrect: false,
                    basePoints: 0,
                    timeBonus: 0,
                    streakBonus: 0,
                    timeElapsed,
                    questionTimeLimit: timeLimit,
                    currentStreak,
                    streakLost: currentStreak > 0
                }
            };
        }

        // Respuesta correcta: calcular puntos base + tiempo
        const timeBonus = this.calculateTimeBonus(timeElapsed, timeLimit);
        const basePointsWithTime = this.basePoints + timeBonus;

        // Calcular bonus de racha
        const teamInStreak = this.isTeamInStreak(teamState);
        const streakInfo = this.calculateStreakBonus(
            currentStreak,
            teamInStreak,
            basePointsWithTime
        );

        const totalPoints = basePointsWithTime + streakInfo.bonusPoints;

        return {
            pointsEarned: this._round(totalPoints),
            details: {
                strategy: this.getName(),
                isCorrect: true,
                basePoints: this.basePoints,
                timeBonus,
                streakBonus: streakInfo.bonusPoints,
                totalBonusPercentage: streakInfo.totalBonusPercentage,
                playerBonusPercentage: streakInfo.playerBonusPercentage,
                teamBonusPercentage: streakInfo.teamBonusPercentage,
                currentStreak,
                streakThreshold: this.streakThreshold,
                playerInStreak: streakInfo.playerInStreak,
                teamInStreak: streakInfo.teamInStreak,
                timeElapsed,
                questionTimeLimit: timeLimit,
                formula: `${this.basePoints} (base) + ${timeBonus} (time) + ${streakInfo.bonusPoints} (streak) = ${this._round(totalPoints)}`
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
        if (config.streakThreshold !== undefined && config.streakThreshold < 1) {
            throw new Error('streakThreshold debe ser >= 1');
        }
        if (config.streakBonusPercentage !== undefined && config.streakBonusPercentage < 0) {
            throw new Error('streakBonusPercentage debe ser >= 0');
        }
        if (config.teamStreakBonusPercentage !== undefined && config.teamStreakBonusPercentage < 0) {
            throw new Error('teamStreakBonusPercentage debe ser >= 0');
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

module.exports = StreakBonusScoring;
