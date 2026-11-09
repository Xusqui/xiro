/**
 * @fileoverview Vote Distribution Logger - Logs detallados de votos por pregunta
 * @module sockets/utils/VoteDistributionLogger
 */

const logger = require('../../config/logger');

function roundToSingleDecimal(value) {
    return Math.round(value * 10) / 10;
}

function sanitizeOptionText(option) {
    if (!option) return '';
    return option.text || option.optionText || option.option_text || '';
}

/**
 * Calcula votos, porcentaje (un decimal) y corrección de cada opción.
 * @param {Object} input
 * @param {Object} input.question - Pregunta con `options`
 * @param {Object<string, number>} input.stats - Votos por índice de opción
 * @returns {{totalVotes: number, options: {index: number, id: *, text: string, votes: number, percentage: number,
 *   isCorrect: boolean}[]}}
 */
function buildVoteDistribution({ question, stats }) {
    const optionCount = question?.options?.length || 0;
    const normalizedStats = stats && typeof stats === 'object' ? stats : {};

    const totalVotes = Object.values(normalizedStats).reduce((sum, count) => sum + (Number(count) || 0), 0);

    const options = Array.from({ length: optionCount }).map((_, index) => {
        const count = Number(normalizedStats[index]) || 0;
        const rawPercentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;

        return {
            index,
            id: question.options?.[index]?.id || null,
            text: sanitizeOptionText(question.options?.[index]),
            votes: count,
            percentage: roundToSingleDecimal(rawPercentage),
            isCorrect: question.options?.[index]?.isCorrect === true
        };
    });

    return {
        totalVotes,
        options
    };
}

/**
 * Registra el reparto de votos de la pregunta revelada. No aplica a preguntas sin opciones ni de ordenar.
 * @param {Object} input
 * @param {string} input.roomId - ID de sesión
 * @param {number} input.questionIndex - Pregunta (base 0)
 * @param {Object} input.question - Pregunta
 * @param {Object<string, number>} input.stats - Votos por opción
 * @param {string} input.trigger - Motivo del revelado
 * @returns {Object|null} Resultado de buildVoteDistribution, o null si no aplica
 */
function logVoteDistribution({ roomId, questionIndex, question, stats, trigger }) {
    if (!question || !Array.isArray(question.options) || question.options.length === 0) {
        logger.info('Question vote distribution skipped (no options)', {
            roomId,
            questionIndex: questionIndex + 1,
            trigger
        });
        return null;
    }

    // Order questions don't track per-option vote stats
    if (question.question_type === 'order') {
        logger.info('Question vote distribution skipped (order type)', {
            roomId,
            questionIndex: questionIndex + 1,
            questionId: question.id || null,
            questionType: 'order',
            trigger
        });
        return null;
    }

    const distribution = buildVoteDistribution({ question, stats });

    logger.info('Question vote distribution', {
        roomId,
        questionIndex: questionIndex + 1,
        questionId: question.id || null,
        questionType: question.question_type || 'unknown',
        trigger,
        totalVotes: distribution.totalVotes,
        options: distribution.options
    });

    return distribution;
}

module.exports = {
    buildVoteDistribution,
    logVoteDistribution
};
