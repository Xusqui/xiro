/**
 * @fileoverview Payload del presentador al revelar una pregunta: tipo de pregunta, respuesta correcta,
 * porcentajes de encuesta, justificación, orden y parejas correctas. Lo usa GameEndManager.revealAnswer.
 */

const logger = require('../../config/logger');
const QuestionTypes = require('../../public/js/core/question-types');

// Soluciones con una opción que marcar. La numérica también calcula correctIndex
// (queda en -1) y aporta su valor aparte.
const SINGLE_INDEX_SOLUTIONS = new Set(['option', 'value']);
// Ordenar y emparejar: la solución es una secuencia o unas parejas, no una opción
const ARRANGED_SOLUTIONS = new Set(['order', 'pairs']);

/**
 * Obtiene la respuesta correcta según el tipo: índice de opción (tipos de una sola correcta), valor (numérico) o
 * índices (selección múltiple).
 * @param {Object} question - Pregunta
 * @returns {{correctIndex: number|null, correctAnswer: *, correctIndicesMultiple: number[]|null}} correctIndex es -1 si
 *   no hay opción marcada y null en tipos sin una única correcta
 */
function resolveCorrectAnswerData(question) {
    const solution = QuestionTypes.solutionOf(question.question_type);
    const hasSingleCorrectIndex = SINGLE_INDEX_SOLUTIONS.has(solution);

    const correctIndex = hasSingleCorrectIndex ? (question.options?.findIndex(option => option.isCorrect) ?? -1) : null;

    let correctAnswer = null;
    if (solution === 'value') {
        correctAnswer = question.correct_answer ?? null;
    } else if (hasSingleCorrectIndex) {
        correctAnswer = question.options?.[correctIndex]?.id || null;
    }

    const correctIndicesMultiple = solution === 'options'
        ? question.options
              ?.map((option, idx) => (option.isCorrect || option.is_correct ? idx : null))
              .filter(idx => idx !== null)
        : null;

    if (!ARRANGED_SOLUTIONS.has(solution)) {
        logger.debug('Respuesta correcta:', {
            correctIndex: solution === 'value' ? null : correctIndex,
            correctAnswer,
            questionId: question.id
        });
    }

    return { correctIndex, correctAnswer, correctIndicesMultiple };
}

/**
 * Calcula votos y porcentaje (un decimal) de cada opción de una encuesta.
 * @param {Object} question - Pregunta
 * @param {Object<string, number>} stats - Votos por opción
 * @param {boolean} isSurveyQuestion - Si es encuesta
 * @returns {{count: number, percentage: number}[]|null} null si no es encuesta
 */
function buildSurveyPercentages(question, stats, isSurveyQuestion) {
    if (!isSurveyQuestion) {
        return null;
    }

    const optionCount = question.options?.length || 0;
    const totalVotes = Object.values(stats).reduce((sum, count) => sum + (Number(count) || 0), 0);

    return Array.from({ length: optionCount }).map((_, index) => {
        const count = Number(stats[index]) || 0;
        const rawPercentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
        const percentage = Math.round(rawPercentage * 10) / 10;
        return { count, percentage };
    });
}

function buildCorrectOrderPayload(currentQuestion) {
    const OrderAnswerService = require('../../domain/services/OrderAnswerService');
    const indices = OrderAnswerService.buildCorrectOrderIndices(currentQuestion.options || []);
    return indices.map(index => {
        const option = currentQuestion.options?.[index];
        return {
            id: option?.id || null,
            text: option?.text || option?.optionText || option?.option_text || '',
            justification: option?.justification || null
        };
    });
}

function buildCorrectMatchesPayload(currentQuestion) {
    return (currentQuestion.options || []).map(option => ({
        leftText: option.optionText || option.option_text || option.text || '',
        rightText: option.match_value || ''
    }));
}

/**
 * Reúne la opción correcta, la justificación y, según el tipo, el orden correcto o las parejas correctas.
 * @param {Object} currentQuestion - Pregunta
 * @param {number|null} correctIndex - Índice de la opción correcta
 * @returns {{correctOption: Object|undefined, justificationText: string|null, correctOrder: Object[]|null,
 *   correctMatches: Object[]|null}}
 */
function buildJustificationData(currentQuestion, correctIndex) {
    const solution = QuestionTypes.solutionOf(currentQuestion.question_type);
    const isOrder = solution === 'order';
    const correctOption = ARRANGED_SOLUTIONS.has(solution) ? null : currentQuestion.options?.[correctIndex];

    const orderJustification = isOrder
        ? currentQuestion.justification ||
          currentQuestion.options?.find(option => option?.justification)?.justification ||
          null
        : null;

    const justificationText = isOrder ? orderJustification : correctOption?.justification || null;

    const correctOrder = isOrder ? buildCorrectOrderPayload(currentQuestion) : null;
    const correctMatches = solution === 'pairs' ? buildCorrectMatchesPayload(currentQuestion) : null;

    return {
        correctOption,
        justificationText,
        correctOrder,
        correctMatches
    };
}

/**
 * Monta el payload 'reveal-answer' del presentador.
 * @param {Object} input - correctIndex, correctOption, justificationText, stats, percentages, rankingFormatted,
 *   timeExpired, correctOrder, correctMatches, isSurveyQuestion
 * @returns {Object} Payload; correctAnswer es el texto de la opción correcta o null
 */
function buildPresenterPayload(input) {
    const {
        correctIndex,
        correctOption,
        justificationText,
        stats,
        percentages,
        rankingFormatted,
        timeExpired,
        correctOrder,
        correctMatches,
        isSurveyQuestion
    } = input;

    return {
        correctIndex,
        correctAnswer: correctOption?.text || correctOption?.optionText || correctOption?.option_text || null,
        justification: justificationText,
        stats,
        percentages,
        ranking: rankingFormatted,
        timeExpired,
        correctOrder,
        correctMatches,
        isSurvey: isSurveyQuestion
    };
}

module.exports = {
    resolveCorrectAnswerData,
    buildSurveyPercentages,
    buildJustificationData,
    buildPresenterPayload
};
