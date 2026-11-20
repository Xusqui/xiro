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
const { normalizeSelection } = require('../../../domain/services/SurveyMultipleAnswerService');
const { getAnswerHandler } = require('../../question-types/AnswerHandlerRegistry');
const { normalizeTap } = require('../../../public/js/core/hotspot-area');

// Respuesta libre tal cual se guarda, según lo que envía el jugador (answerShape)
const FREE_INPUT_VALUES = Object.freeze({
    number: payload => Number(payload.playerAnswer),
    text: payload => String(payload.playerAnswer),
    found: payload => [...(payload.found || [])],
    words: payload => [...(payload.words || [])],
    tap: payload => normalizeTap(payload.tap)
});

function persistFreeInputAnswer({ player, socket, game, questionTimeLimit }, normalizedAnswer) {
    if (player) {
        player.answeredQuestions.add(game.currentIndex);
        player.lastSeen = Date.now();
        if (!player.answers) player.answers = {};
        player.answers[game.currentIndex] = {
            playerAnswer: normalizedAnswer,
            timestamp: Date.now(),
            timeLeft: Math.max(0, questionTimeLimit - (Date.now() - game.questionStartTime) / 1000),
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
}

/**
 * Persist the submitted answer in player and socket state.
 *
 * @param {Object} ctx - Persistence context.
 * @returns {void}
 */
function persistPlayerAnswerState(ctx) {
    const { payload, flags, player, socket, game, currentQuestion, questionTimeLimit } = ctx;

    const { index, order, matches, selectedIndices } = payload;
    const timing = { gameStartTime: game.questionStartTime, currentTime: Date.now(), questionTimeLimit };
    const { answerShape } = getAnswerHandler(flags.questionType);

    if (answerShape === 'order') {
        const answerState = OrderAnswerStateService.buildOrderAnswerState({ order, ...timing });

        OrderAnswerStateService.updatePlayerState({ player, socket, game, answerState });
        return;
    }

    if (answerShape === 'matching') {
        const answerState = MatchingAnswerStateService.buildMatchingAnswerState({ matches, ...timing });

        MatchingAnswerStateService.updatePlayerState({ player, socket, game, answerState });
        return;
    }

    if (Object.prototype.hasOwnProperty.call(FREE_INPUT_VALUES, answerShape)) {
        persistFreeInputAnswer(ctx, FREE_INPUT_VALUES[answerShape](payload));
        return;
    }

    // Selección múltiple y su encuesta: mismo estado (la encuesta puede ir vacía y se normaliza)
    if (answerShape === 'selection') {
        const answerState = MultipleChoiceAnswerStateService.buildMultipleChoiceAnswerState({
            selectedIndices: flags.questionType === 'survey_multiple' ? normalizeSelection(selectedIndices) : selectedIndices,
            ...timing
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

    // Solo quiz y encuesta responden con una opción
    if (getAnswerHandler(flags.questionType).answerShape !== 'option') return;

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
