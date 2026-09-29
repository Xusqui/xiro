/**
 * @fileoverview Servicio para validar y puntuar respuestas tipo "matching" (Emparejar)
 * Funciones puras sin dependencias de infraestructura.
 *
 * Lógica de pares: options[i].option_text es el item izquierdo (fijo).
 * El jugador envía matches[i] = índice del par derecho asignado al item i.
 * El par correcto para el item i es el que tiene order_index === i.
 * Como los items se cargan ordenados por order_index, la respuesta correcta
 * es siempre matches = [0, 1, 2, ..., N-1].
 */

const { SCORING } = require('../../config/game-constants');

const POINTS_PER_PAIR = SCORING.BASE_POINTS;

/**
 * Devuelve el array de índices correctos para preguntas matching.
 * Las opciones se cargan desde la BD ordenadas por order_index ASC,
 * por lo que el orden correcto es siempre 0, 1, 2, … N-1.
 * @param {Array} options
 * @returns {number[]}
 */
function buildCorrectMatchIndices(options) {
    if (!Array.isArray(options)) return [];
    return options.map((_, index) => index);
}

/**
 * Calcula la puntuación de una respuesta matching.
 * @param {number[]} matches - Array de índices enviado por el jugador
 * @param {Array}    options - Opciones de la pregunta (con option_text y match_value)
 * @returns {{ pointsEarned: number, details: Object }}
 */
function calculateMatchingScore(matches, options) {
    const correctOrder = buildCorrectMatchIndices(options);
    const pairsCorrect = correctOrder.map(
        (correctIndex, pos) => matches[pos] === correctIndex
    );
    const correctCount = pairsCorrect.filter(Boolean).length;

    return {
        pointsEarned: correctCount * POINTS_PER_PAIR,
        details: {
            correctCount,
            totalPairs: correctOrder.length,
            pairsCorrect,
            correctMatchIndices: correctOrder
        }
    };
}

/**
 * Procesa una respuesta matching completa.
 * @param {{ question: Object, matches: number[] }} param
 */
function processMatchingAnswer({ question, matches }) {
    const options = question?.options || [];
    const result = calculateMatchingScore(matches, options);
    const isCorrect = result.details.correctCount === result.details.totalPairs;

    return {
        isCorrect,
        pointsEarned: result.pointsEarned,
        details: result.details
    };
}

/**
 * Determina la acción de racha para una respuesta tipo matching.
 *   - true  → todos los pares correctos          → racha +1
 *   - null  → ≥ mitad de pares correctos         → racha se mantiene
 *   - false → < mitad de pares correctos         → racha a 0
 *
 * @param {number} correctCount  Pares acertados
 * @param {number} totalPairs    Total de pares de la pregunta
 * @returns {true|null|false}
 */
function getMatchingStreakAction(correctCount, totalPairs) {
    if (totalPairs === 0) return null;
    if (correctCount === totalPairs) return true;
    if (correctCount < totalPairs / 2) return false;
    return null;
}

module.exports = {
    buildCorrectMatchIndices,
    calculateMatchingScore,
    processMatchingAnswer,
    getMatchingStreakAction
};
