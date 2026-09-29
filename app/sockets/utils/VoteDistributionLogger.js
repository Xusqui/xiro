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

function buildVoteDistribution({ question, stats }) {
    const optionCount = question?.options?.length || 0;
    const normalizedStats = stats && typeof stats === 'object' ? stats : {};

    const totalVotes = Object.values(normalizedStats)
        .reduce((sum, count) => sum + (Number(count) || 0), 0);

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
