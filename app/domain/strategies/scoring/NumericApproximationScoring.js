/**
 * @fileoverview Estrategia de puntuación para preguntas numéricas por aproximación
 * @module domain/strategies/scoring/NumericApproximationScoring
 */

const ScoringStrategy = require('./ScoringStrategy');
const { TIMING } = require('../../../config/game-constants');
const { normalizeToleranceConfig } = require('../../services/numeric/NumericToleranceConfig');
const {
    resolveToleranceWindow,
    calculateLinearPoints
} = require('../../services/numeric/NumericToleranceCalculator');

/**
 * Estrategia de respuesta numérica aproximada
 *
 * Penalización: Si se aleja más del 75% de la respuesta correcta, obtiene 0 puntos
 * Distribución lineal: Cuanto más se acerque al valor correcto, más puntos obtiene
 *
 * Ejemplo:
 * - Respuesta correcta: 12756
 * - Puntos máximos: 100
 * - Margen error: 12756 * 0.25 = 3189 (25%)
 * - Rango válido: [9567, 15945]
 *
 * Si jugador responde:
 * - 12756 → 100 puntos (exacta)
 * - 12100 → ~95 puntos (muy cercana)
 * - 9567 → 0 puntos (límite inferior)
 * - 15945 → 0 puntos (límite superior)
 * - 8000 → 0 puntos (fuera de rango, -76.8%)
 */
class NumericApproximationScoring extends ScoringStrategy {
    /**
     * Calcula puntos para respuesta numérica
     *
     * @param {Object} params - Parámetros
     * @param {number} params.playerAnswer - Respuesta del jugador
     * @param {number} params.correctAnswer - Respuesta correcta
     * @param {number} params.maxPoints - Puntos máximos
     * @param {number} params.timeElapsed - Tiempo transcurrido (segundos)
     * @param {number} params.questionTimeLimit - Límite de tiempo
     * @returns {Object} Resultado con puntos y detalles
     */
    calculatePoints({
        playerAnswer,
        correctAnswer,
        maxPoints,
        toleranceMode,
        toleranceValue,
        toleranceCap,
        timeElapsed = 0,
        questionTimeLimit = TIMING.DEFAULT_QUESTION_TIME
    }) {
        // Validar entrada
        const validatedAnswer = this._validateAndParseAnswer(playerAnswer);
        if (validatedAnswer === null) {
            return {
                pointsEarned: 0,
                details: {
                    strategy: this.getName(),
                    isCorrect: false,
                    playerAnswer,
                    validationError: 'Respuesta no numérica válida',
                    correctAnswer,
                    maxPoints,
                    timeElapsed,
                    questionTimeLimit
                }
            };
        }

        const validatedCorrectAnswer = Math.round(Number(correctAnswer));
        const toleranceConfig = normalizeToleranceConfig({
            tolerance_mode: toleranceMode,
            tolerance_value: toleranceValue,
            tolerance_cap: toleranceCap
        });

        const distance = Math.abs(validatedAnswer - validatedCorrectAnswer);
        const tolerance = resolveToleranceWindow({
            correctAnswer: validatedCorrectAnswer,
            mode: toleranceConfig.mode,
            value: toleranceConfig.value,
            cap: toleranceConfig.cap
        });

        const isCorrect = distance === 0;
        const withinRange = distance <= tolerance;

        const pointsEarned = calculateLinearPoints({
            distance,
            tolerance,
            maxPoints,
            isExact: isCorrect,
            exactBonus: toleranceConfig.exactBonus
        });

        const distancePercentage = validatedCorrectAnswer !== 0
            ? (distance / Math.abs(validatedCorrectAnswer)) * 100
            : 0;

        const formula = isCorrect
            ? `${pointsEarned} = ${maxPoints} + ${toleranceConfig.exactBonus}`
            : (tolerance > 0
                ? `${pointsEarned} = ${maxPoints} × (1 - (${distance} / ${tolerance}))`
                : `${pointsEarned} = 0 (tolerancia no positiva)`);

        return {
            pointsEarned: Math.max(0, pointsEarned),
            details: {
                strategy: this.getName(),
                isCorrect,
                playerAnswer: validatedAnswer,
                correctAnswer: validatedCorrectAnswer,
                maxPoints,
                distance,
                tolerance,
                withinRange,
                toleranceMode: toleranceConfig.mode,
                toleranceValue: toleranceConfig.value,
                toleranceCap: toleranceConfig.cap,
                exactBonus: toleranceConfig.exactBonus,
                distancePercentage: this._round(distancePercentage),
                formula
            }
        };
    }

    /**
     * Valida y parsea respuesta numérica
     * @private
     * @param {*} answer - Respuesta del jugador
     * @returns {number|null} Número parseado o null si es inválido
     */
    _validateAndParseAnswer(answer) {
        // Convertir a string y trimear
        const str = String(answer).trim();

        // Validar que sea un número válido
        if (!str || isNaN(str) || str === '') {
            return null;
        }

        // Parsear como número
        const num = Number(str);

        // Rechazar NaN o Infinity
        if (!Number.isFinite(num)) {
            return null;
        }

        // Redondear al entero más cercano (sólo números enteros)
        return Math.round(num);
    }

    /**
     * Redondea a 2 decimales
     * @private
     * @param {number} value - Valor a redondear
     * @returns {number} Valor redondeado
     */
    _round(value) {
        return Math.round(value * 100) / 100;
    }

    /**
     * @inheritdoc
     */
    getName() {
        return 'numeric_approximation';
    }

    /**
     * @inheritdoc
     */
    validateConfig(config) {
        if (!config.correctAnswer || config.maxPoints === undefined) {
            throw new Error(
                'NumericApproximationScoring requiere correctAnswer y maxPoints'
            );
        }
        if (config.maxPoints <= 0) {
            throw new Error('maxPoints debe ser mayor a 0');
        }
        return true;
    }

    /**
     * @inheritdoc
     */
    getConfig() {
        return {
            strategy: this.getName(),
            toleranceMode: 'hybrid',
            toleranceValue: 25,
            toleranceCap: 1000,
            exactBonus: 20
        };
    }
}

module.exports = NumericApproximationScoring;
