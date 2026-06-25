/**
 * @fileoverview Answer evaluation and canonical timing helpers.
 * @module application/commands/submit-answer/answerEvaluation
 *
 * Purpose:
 * - Resolve canonical question start time from Redis when local epoch is stale.
 * - Dispatch answer scoring to the service matching the question type.
 * - Build rich multiple-choice details for downstream consumers.
 */

const { getRedisClient } = require('../../../config/redis');
const logger = require('../../../config/logger');
const OrderAnswerService = require('../../../domain/services/OrderAnswerService');
const MatchingAnswerService = require('../../../domain/services/MatchingAnswerService');
const MultipleChoiceAnswerService = require('../../../domain/services/MultipleChoiceAnswerService');
const ScoringService = require('../../../domain/services/ScoringService');
const { processWordScrambleAnswer } = require('../../../domain/services/WordScrambleService');

/**
 * Resolve canonical question start time across cluster workers.
 *
 * @param {Object} ctx - Timing context.
 * @returns {Promise<number>} Start time in milliseconds.
 */
async function resolveCanonicalQuestionStartTime(ctx) {
    const { game, sPin, nickname, questionTimeLimit } = ctx;

    let resolvedStartTime = game.questionStartTime;
    const maxAgeMs = (questionTimeLimit + 60) * 1000;
    const localAge = Date.now() - resolvedStartTime;

    if (!resolvedStartTime || isNaN(localAge) || localAge > maxAgeMs) {
        try {
            const redisClient = await getRedisClient();
            const redisStart = await redisClient.get(`game:questionstart:${sPin}`);

            if (redisStart && !isNaN(Number(redisStart))) {
                const redisStartMs = Number(redisStart);

                if (resolvedStartTime && !isNaN(localAge) && localAge > maxAgeMs) {
                    logger.warn('Stale game.questionStartTime detected on non-originating worker — using Redis canonical epoch', {
                        roomId: sPin,
                        nickname,
                        localStartTime: resolvedStartTime,
                        redisStartTime: redisStartMs,
                        localAgeMs: localAge,
                        maxAgeMs: maxAgeMs
                    });
                }

                resolvedStartTime = redisStartMs;
                game.questionStartTime = redisStartMs;
            }
        } catch (error) {
            logger.warn('Could not read canonical questionStartTime from Redis, using local value', {
                roomId: sPin,
                nickname,
                error: error.message
            });
        }
    }

    return resolvedStartTime;
}

/**
 * Evaluate an answer with the appropriate domain service.
 *
 * @param {Object} ctx - Evaluation context.
 * @returns {Object} Service result with correctness and points.
 */
function evaluateAnswer(ctx) {
    const {
        flags,
        payload,
        currentQuestion,
        resolvedStartTime,
        questionTimeLimit
    } = ctx;

    if (flags.isOrderQuestion) {
        return OrderAnswerService.processOrderAnswer({
            question: currentQuestion,
            order: payload.order
        });
    }

    if (flags.isMatchingQuestion) {
        return MatchingAnswerService.processMatchingAnswer({
            question: currentQuestion,
            matches: payload.matches
        });
    }

    if (flags.isWordScrambleQuestion) {
        return processWordScrambleAnswer({
            correctWord: currentQuestion.correct_word || '',
            playerAnswer: String(payload.playerAnswer),
            gameStartTime: resolvedStartTime,
            currentTime: Date.now(),
            questionTimeLimit
        });
    }

    if (flags.isMultipleChoiceQuestion) {
        return MultipleChoiceAnswerService.processMultipleChoiceAnswer({
            question: currentQuestion,
            selectedIndices: payload.selectedIndices,
            gameStartTime: resolvedStartTime,
            currentTime: Date.now()
        });
    }

    return ScoringService.processAnswer({
        question: currentQuestion,
        answerIndex: payload.index,
        playerAnswer: flags.isNumericQuestion ? Number(payload.playerAnswer) : undefined,
        gameStartTime: resolvedStartTime,
        currentTime: Date.now()
    });
}

/**
 * Build complete multiple-choice details to store in answer snapshots.
 *
 * @param {Object} ctx - Detail context.
 * @returns {Object|null} Enriched details or null for non-MC questions.
 */
function buildMultipleChoiceDetails(ctx) {
    const { flags, answerResult, currentQuestion } = ctx;

    if (!flags.isMultipleChoiceQuestion) {
        return null;
    }

    return {
        ...(answerResult.details || {}),
        selectedIndices: answerResult.selectedIndices || [],
        correctIndices: answerResult.correctIndices || [],
        pointsPerCorrect: currentQuestion.mc_points_per_correct || 10,
        penaltyPerIncorrect: currentQuestion.mc_penalty_per_incorrect || 10,
        perfectBonus: currentQuestion.mc_perfect_bonus || 20,
        options: (currentQuestion.options || []).map((opt, idx) => ({
            index: idx,
            text: opt.optionText || opt.option_text || opt.text || '',
            isCorrect: opt.isCorrect || opt.is_correct || false
        }))
    };
}

module.exports = {
    resolveCanonicalQuestionStartTime,
    evaluateAnswer,
    buildMultipleChoiceDetails
};
