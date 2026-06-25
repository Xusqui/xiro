/**
 * @fileoverview Question context and per-type validation helpers.
 * @module application/commands/submit-answer/questionContext
 *
 * Purpose:
 * - Resolve game/session context from payload.
 * - Derive current question flags used throughout execution.
 * - Validate answer payload with the same services and rules as before.
 */

const { isLastQuestion } = require('../../../sockets/utils/GameEndManager');
const AnswerStateService = require('../../../domain/services/AnswerStateService');
const OrderAnswerStateService = require('../../../domain/services/OrderAnswerStateService');
const MatchingAnswerStateService = require('../../../domain/services/MatchingAnswerStateService');
const MultipleChoiceAnswerStateService = require('../../../domain/services/MultipleChoiceAnswerStateService');

/**
 * Resolve room and game references from submit payload.
 *
 * @param {Object} payload - Command payload.
 * @param {Map} activeGames - In-memory active games map.
 * @returns {{roomId: string, sPin: string, game: Object|null}}
 */
function resolveGameContext(payload, activeGames) {
    const roomId = payload.sessionId || payload.pin;
    const sPin = String(roomId);
    const game = activeGames.get(sPin) || null;

    return { roomId, sPin, game };
}

/**
 * Build question metadata that the execution flow reuses.
 *
 * @param {Object} game - Active game state.
 * @returns {Object} Question context flags.
 */
function buildQuestionContext(game) {
    const currentQuestion = game.questions?.[game.currentIndex];
    const lastQuestion = !!(game && isLastQuestion(game));

    const isOrderQuestion = currentQuestion?.question_type === 'order';
    const isMatchingQuestion = currentQuestion?.question_type === 'matching';
    const isNumericQuestion = currentQuestion?.question_type === 'numeric_approximation';
    const isWordScrambleQuestion = currentQuestion?.question_type === 'word_scramble';
    const isMultipleChoiceQuestion = currentQuestion?.question_type === 'multiple_choice';

    const questionTimeLimit = currentQuestion?.time_limit || 30;
    const elapsedMs = Date.now() - (game.questionStartTime || Date.now());
    const graceMs = 800;

    return {
        currentQuestion,
        lastQuestion,
        isOrderQuestion,
        isMatchingQuestion,
        isNumericQuestion,
        isWordScrambleQuestion,
        isMultipleChoiceQuestion,
        questionTimeLimit,
        canAnswerOrEnded: game?.canAnswer || game?.ended || lastQuestion,
        allowOrderAfterClose: isOrderQuestion && elapsedMs <= (questionTimeLimit * 1000 + graceMs),
        allowMatchingAfterClose: isMatchingQuestion && elapsedMs <= (questionTimeLimit * 1000 + graceMs)
    };
}

/**
 * Validate the current answer according to question type.
 *
 * @param {Object} ctx - Validation context.
 * @param {Object} ctx.payload - Command payload.
 * @param {Object} ctx.question - Current question.
 * @param {Object} ctx.flags - Question metadata flags.
 * @returns {{valid: boolean, reason: string|null}}
 */
function validateAnswerByType({ payload, question, flags }) {
    const {
        index,
        order,
        matches,
        playerAnswer,
        selectedIndices
    } = payload;

    const {
        canAnswerOrEnded,
        lastQuestion,
        isOrderQuestion,
        isMatchingQuestion,
        isNumericQuestion,
        isWordScrambleQuestion,
        isMultipleChoiceQuestion,
        allowOrderAfterClose,
        allowMatchingAfterClose
    } = flags;

    if (isOrderQuestion) {
        return OrderAnswerStateService.validateOrderAnswer({
            question,
            order,
            gameCanAnswer: canAnswerOrEnded,
            allowWhenClosed: lastQuestion || allowOrderAfterClose
        });
    }

    if (isMatchingQuestion) {
        return MatchingAnswerStateService.validateMatchingAnswer({
            question,
            matches,
            gameCanAnswer: canAnswerOrEnded,
            allowWhenClosed: lastQuestion || allowMatchingAfterClose
        });
    }

    if (isNumericQuestion) {
        if (!canAnswerOrEnded && !lastQuestion) return { valid: false, reason: 'game-closed' };
        if (!Number.isFinite(Number(playerAnswer))) return { valid: false, reason: 'invalid-payload' };
        return { valid: true, reason: null };
    }

    if (isWordScrambleQuestion) {
        if (!canAnswerOrEnded && !lastQuestion) return { valid: false, reason: 'game-closed' };
        if (typeof playerAnswer !== 'string' || playerAnswer.trim().length === 0) {
            return { valid: false, reason: 'invalid-payload' };
        }
        return { valid: true, reason: null };
    }

    if (isMultipleChoiceQuestion) {
        return MultipleChoiceAnswerStateService.validateMultipleChoiceAnswer({
            question,
            selectedIndices,
            gameCanAnswer: canAnswerOrEnded,
            allowWhenClosed: lastQuestion
        });
    }

    return AnswerStateService.validateAnswer({
        question,
        answerIndex: index,
        gameCanAnswer: canAnswerOrEnded,
        allowWhenClosed: lastQuestion
    });
}

module.exports = {
    resolveGameContext,
    buildQuestionContext,
    validateAnswerByType
};
