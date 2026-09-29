/**
 * @fileoverview Cálculo de tolerancia y puntuación lineal para numéricas
 */

const { NUMERIC_TOLERANCE_MODES } = require('./NumericToleranceConfig');

function resolveToleranceWindow({ correctAnswer, mode, value, cap }) {
    const absCorrect = Math.abs(correctAnswer);
    const percentageTolerance = absCorrect * (value / 100);

    if (mode === NUMERIC_TOLERANCE_MODES.ABSOLUTE) {
        return value;
    }

    if (mode === NUMERIC_TOLERANCE_MODES.PERCENTAGE) {
        return cap ? Math.min(percentageTolerance, cap) : percentageTolerance;
    }

    return cap ? Math.min(percentageTolerance, cap) : percentageTolerance;
}

function calculateLinearPoints({ distance, tolerance, maxPoints, isExact, exactBonus }) {
    if (isExact) {
        return Math.max(0, Math.round(maxPoints + exactBonus));
    }

    if (tolerance <= 0 || distance > tolerance) {
        return 0;
    }

    const basePoints = maxPoints * (1 - (distance / tolerance));
    return Math.max(0, Math.round(basePoints));
}

module.exports = {
    resolveToleranceWindow,
    calculateLinearPoints
};
