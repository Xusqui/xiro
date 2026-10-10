/**
 * @fileoverview Player/socket answer state persistence.
 * @module application/commands/submit-answer/playerState
 *
 * Purpose:
 * - Persist raw submitted answer into player and socket.data.
 * - Keep per-question answer metadata used by reveal/ranking.
 * - Update option statistics for classic single-choice questions.
 */

const AnswerStateService = require('../../../domain/services/AnswerStateService');
const OrderAnswerStateService = require('../../../domain/services/OrderAnswerStateService');
const MatchingAnswerStateService = require('../../../domain/services/MatchingAnswerStateService');
const MultipleChoiceAnswerStateService = require('../../../domain/services/MultipleChoiceAnswerStateService');
const AnswerProcessingService = require('../../../domain/services/AnswerProcessingService');
const answerStatsStore = require('../../../services/AnswerStatsStore');

/**
 * Persist the submitted answer in player and socket state.
 *
 * @param {Object} ctx - Persistence context.
 * @returns {void}
 */
function persistPlayerAnswerState(ctx) {
    const {
        payload,
        flags,
        player,
        socket,
        game,
        currentQuestion,
        questionTimeLimit
    } = ctx;

    const {
        index,
        order,
        matches,
        playerAnswer,
        selectedIndices
    } = payload;

    if (flags.isOrderQuestion) {
        const answerState = OrderAnswerStateService.buildOrderAnswerState({
            order,
            gameStartTime: game.questionStartTime,
            currentTime: Date.now(),
            questionTimeLimit
        });

        OrderAnswerStateService.updatePlayerState({ player, socket, game, answerState });
        return;
    }

    if (flags.isMatchingQuestion) {
        const answerState = MatchingAnswerStateService.buildMatchingAnswerState({
            matches,
            gameStartTime: game.questionStartTime,
            currentTime: Date.now(),
            questionTimeLimit
        });

        MatchingAnswerStateService.updatePlayerState({ player, socket, game, answerState });
        return;
    }

    if (flags.isNumericQuestion || flags.isWordScrambleQuestion || flags.isWordSearchQuestion) {
        const normalizedAnswer = flags.isNumericQuestion
            ? Number(playerAnswer)
            : flags.isWordSearchQuestion ? [...(payload.found || [])] : String(playerAnswer);

        if (player) {
            player.answeredQuestions.add(game.currentIndex);
            player.lastSeen = Date.now();
            if (!player.answers) player.answers = {};
            player.answers[game.currentIndex] = {
                playerAnswer: normalizedAnswer,
                timestamp: Date.now(),
                timeLeft: Math.max(0, questionTimeLimit - ((Date.now() - game.questionStartTime) / 1000)),
                pointsEarned: 0,
                isCorrect: false
            };
        }

        if (!socket.data.answeredQuestions) socket.data.answeredQuestions = [];
        if (!socket.data.answeredQuestions.includes(game.currentIndex)) {
            socket.data.answeredQuestions.push(game.currentIndex);
        }
        if (!socket.data.answers) socket.data.answers = {};
        socket.data.answers[game.currentIndex] = {
            playerAnswer: normalizedAnswer,
            timestamp: Date.now(),
            pointsEarned: 0,
            isCorrect: false
        };
        return;
    }

    if (flags.isMultipleChoiceQuestion) {
        const answerState = MultipleChoiceAnswerStateService.buildMultipleChoiceAnswerState({
            selectedIndices,
            gameStartTime: game.questionStartTime,
            currentTime: Date.now(),
            questionTimeLimit
        });

        MultipleChoiceAnswerStateService.updatePlayerState({ player, socket, game, answerState });
        return;
    }

    const optionSelected = currentQuestion.options[index];
    AnswerProcessingService.updatePlayerState({
        player,
        socket,
        game,
        answerIndex: index,
        optionSelected,
        currentQuestion
    });
}

/**
 * Update answer stats for classic option-based questions only.
 *
 * @param {Object} ctx - Stats context.
 * @returns {Promise<void>}
 */
async function updateOptionAnswerStats(ctx) {
    const { flags, game, sPin, index } = ctx;

    if (flags.isOrderQuestion
        || flags.isMatchingQuestion
        || flags.isNumericQuestion
        || flags.isWordScrambleQuestion
        || flags.isWordSearchQuestion
        || flags.isMultipleChoiceQuestion) {
        return;
    }

    if (!game.answerStats) game.answerStats = {};
    if (!game.answerStats[game.currentIndex]) game.answerStats[game.currentIndex] = {};

    game.answerStats[game.currentIndex] = AnswerStateService.updateAnswerStats(
        game.answerStats[game.currentIndex],
        index
    );

    await answerStatsStore.increment(sPin, game.currentIndex, index);
}

module.exports = {
    persistPlayerAnswerState,
    updateOptionAnswerStats
};
