/**
 * @fileoverview Cálculo de tolerancia y puntuación lineal para numéricas
 */

const { NUMERIC_TOLERANCE_MODES } = require('./NumericToleranceConfig');

/**
 * Margen de error admitido: `value` en modo absoluto; en porcentaje e híbrido, el porcentaje de la respuesta correcta
 * limitado por `cap` si lo hay.
 * @param {Object} input
 * @param {number} input.correctAnswer - Respuesta correcta
 * @param {string} input.mode - Modo de tolerancia
 * @param {number} input.value - Valor absoluto o porcentaje
 * @param {number|null} [input.cap] - Tope
 * @returns {number}
 */
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

/**
 * Puntos según la distancia a la respuesta: bajan en línea recta hasta 0 en el borde del margen. El acierto exacto suma
 * el bonus.
 * @param {Object} input
 * @param {number} input.distance - Distancia a la respuesta correcta
 * @param {number} input.tolerance - Margen admitido
 * @param {number} input.maxPoints - Puntos máximos
 * @param {boolean} input.isExact - Si es exacta
 * @param {number} input.exactBonus - Bonus por exacta
 * @returns {number} Entero, nunca negativo
 */
function calculateLinearPoints({ distance, tolerance, maxPoints, isExact, exactBonus }) {
    if (isExact) {
        return Math.max(0, Math.round(maxPoints + exactBonus));
    }

    if (tolerance <= 0 || distance > tolerance) {
        return 0;
    }

    const basePoints = maxPoints * (1 - distance / tolerance);
    return Math.max(0, Math.round(basePoints));
}

module.exports = {
    resolveToleranceWindow,
    calculateLinearPoints
};
