/**
 * @fileoverview Servicio para validar y puntuar respuestas tipo "order"
 * Funciones puras sin dependencias de infraestructura.
 */

const { SCORING } = require('../../config/game-constants');

const POINTS_PER_POSITION = SCORING.BASE_POINTS;

function buildCorrectOrderIndices(options) {
    if (!Array.isArray(options)) return [];

    const hasOrderIndex = options.some(opt => Number.isInteger(opt.order_index));
    if (!hasOrderIndex) {
        return options.map((_, index) => index);
    }

    return options
        .map((opt, index) => ({
            index,
            orderIndex: Number.isInteger(opt.order_index) ? opt.order_index : index
        }))
        .sort((a, b) => a.orderIndex - b.orderIndex || a.index - b.index)
        .map(item => item.index);
}

function buildCorrectOrderOptionIds(options) {
    const indices = buildCorrectOrderIndices(options);
    return indices.map(index => options[index]?.id || null);
}

function calculateOrderScore(order, options) {
    const correctOrder = buildCorrectOrderIndices(options);
    const positionsCorrect = correctOrder.map((correctIndex, position) => order[position] === correctIndex);
    const correctCount = positionsCorrect.filter(Boolean).length;

    return {
        pointsEarned: correctCount * POINTS_PER_POSITION,
        details: {
            correctCount,
            totalOptions: correctOrder.length,
            positionsCorrect,
            correctOrderIndices: correctOrder,
            correctOrderOptionIds: buildCorrectOrderOptionIds(options)
        }
    };
}

function processOrderAnswer({ question, order }) {
    const options = question?.options || [];
    const result = calculateOrderScore(order, options);
    const isCorrect = result.details.correctCount === result.details.totalOptions;

    return {
        isCorrect,
        pointsEarned: result.pointsEarned,
        details: result.details
    };
}

/**
 * Determina la acción de racha para una respuesta de tipo order.
 *   - true  → acierto total (todas las posiciones correctas)  → racha +1
 *   - null  → acierto parcial (≥ mitad de posiciones)         → racha se mantiene
 *   - false → fallo (< mitad de posiciones correctas)         → racha a 0
 *
 * @param {number} correctCount  Posiciones acertadas
 * @param {number} totalOptions  Total de opciones de la pregunta
 * @returns {true|null|false}
 */
function getOrderStreakAction(correctCount, totalOptions) {
    if (totalOptions === 0) return null;
    if (correctCount === totalOptions) return true;
    if (correctCount < totalOptions / 2) return false;
    return null;
}

module.exports = {
    buildCorrectOrderIndices,
    buildCorrectOrderOptionIds,
    calculateOrderScore,
    processOrderAnswer,
    getOrderStreakAction
};
