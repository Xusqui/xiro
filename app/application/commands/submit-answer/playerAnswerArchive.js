/**
 * @fileoverview Post-game answer snapshot persistence.
 * @module application/commands/submit-answer/playerAnswerArchive
 *
 * Purpose:
 * - Build a human-readable answer record per player/question.
 * - Keep records in memory and in Redis for cross-worker reads.
 * - Preserve the existing export payload shape.
 */

const { getRedisClient } = require('../../../config/redis');
const OrderAnswerService = require('../../../domain/services/OrderAnswerService');

function runWithRedisClient(action) {
    Promise.resolve()
        .then(() => getRedisClient())
        .then(action)
        .catch(() => { });
}

function ensurePlayerAnswerSlot(game) {
    const slot = game.isTrivial ? (game.trivialQuestionEpoch || 0) : game.currentIndex;

    if (!game.playerAnswers) game.playerAnswers = {};
    if (!game.playerAnswers[slot]) game.playerAnswers[slot] = {};

    return slot;
}

function optionText(option, fallbackValue) {
    return option?.option_text || option?.optionText || option?.text || String(fallbackValue);
}

function buildOrderAnswer({ payload, options }) {
    if (!Array.isArray(payload.order)) {
        return { answerGiven: String(payload.order) };
    }

    const correctOrder = OrderAnswerService.buildCorrectOrderIndices(options);
    const orderItems = payload.order.map((optIdx, pos) => ({
        text: optionText(options[optIdx], optIdx),
        correct: optIdx === correctOrder[pos]
    }));

    return {
        answerGiven: orderItems.map((item) => item.text).join(' → '),
        orderItems
    };
}

function buildMatchingAnswer({ payload, options }) {
    if (!Array.isArray(payload.matches)) {
        return { answerGiven: String(payload.matches) };
    }

    const matchingPairs = payload.matches.map((matchIdx, idx) => ({
        left: optionText(options[idx], idx),
        right: options[matchIdx]?.match_value || String(matchIdx),
        correct: matchIdx === idx
    }));

    return {
        answerGiven: matchingPairs.map((pair) => `${pair.left} → ${pair.right}`).join(' | '),
        matchingPairs
    };
}

function buildMultipleChoiceAnswer({ payload, options }) {
    if (!Array.isArray(payload.selectedIndices)) {
        return { answerGiven: String(payload.selectedIndices) };
    }

    const correctSet = new Set(
        options
            .map((opt, idx) => (opt.is_correct || opt.isCorrect) ? idx : null)
            .filter((idx) => idx !== null)
    );

    const multipleChoiceItems = payload.selectedIndices.map((idx) => ({
        text: optionText(options[idx], idx),
        correct: correctSet.has(idx)
    }));

    return {
        answerGiven: multipleChoiceItems.map((item) => item.text).join(', '),
        multipleChoiceItems
    };
}

function buildSingleIndexAnswer({ payload, options }) {
    const option = options[payload.index];
    return { answerGiven: optionText(option, payload.index) };
}

function buildAnswerDetails({ flags, payload, options }) {
    if (flags.isOrderQuestion) {
        return buildOrderAnswer({ payload, options });
    }
    if (flags.isMatchingQuestion) {
        return buildMatchingAnswer({ payload, options });
    }
    if (flags.isNumericQuestion || flags.isWordScrambleQuestion) {
        return { answerGiven: String(payload.playerAnswer) };
    }
    if (flags.isMultipleChoiceQuestion) {
        return buildMultipleChoiceAnswer({ payload, options });
    }
    return buildSingleIndexAnswer({ payload, options });
}

function persistSnapshotToRedis({ sPin, slot, nickname, snapshot }) {
    const key = `game:playeranswers:${sPin}`;
    const field = `${slot}:${nickname}`;

    runWithRedisClient((redisClient) => Promise.all([
        redisClient.hSet(key, field, JSON.stringify(snapshot)),
        redisClient.expire(key, 7200)
    ]));
}

function persistRawSocketAnswer({ sPin, slot, nickname, socketAnswer }) {
    const key = `game:rawsocketanswers:${sPin}:${slot}`;
    const field = nickname;

    runWithRedisClient((redisClient) => Promise.all([
        redisClient.hSet(key, field, JSON.stringify(socketAnswer)),
        redisClient.expire(key, 7200)
    ]));
}

/**
 * Construye el registro que se guarda por jugador y pregunta.
 *
 * @param {Object} ctx
 * @returns {Object}
 */
function buildSnapshot(ctx) {
    const { game, currentQuestion, answerDetails, answerResult, finalPointsEarned, isCorrect, randomPoints } = ctx;

    return {
        answer: answerDetails.answerGiven,
        isCorrect: answerResult.isSurvey ? null : isCorrect,
        pointsEarned: answerResult.isSurvey ? 0 : finalPointsEarned,
        responseTimeMs: Date.now() - game.questionStartTime,
        questionText: currentQuestion?.question_text || currentQuestion?.text || null,
        categoryName: game.isTrivial ? (game.trivialCategoryName || null) : null,
        matchingPairs: answerDetails.matchingPairs || undefined,
        orderItems: answerDetails.orderItems || undefined,
        multipleChoiceItems: answerDetails.multipleChoiceItems || undefined,
        randomPoints: randomPoints ?? undefined
    };
}

/**
 * Persist answer details used by end-of-game exports.
 *
 * @param {Object} ctx - Archive context.
 * @returns {void}
 */
function persistPlayerAnswerSnapshot(ctx) {
    const {
        game,
        sPin,
        nickname,
        currentQuestion,
        payload,
        flags,
        answerResult,
        finalPointsEarned,
        isCorrect,
        randomPoints,
        socket
    } = ctx;

    const slot = ensurePlayerAnswerSlot(game);
    const options = currentQuestion.options || [];
    const answerDetails = buildAnswerDetails({ flags, payload, options });

    const snapshot = buildSnapshot({
        game,
        currentQuestion,
        answerDetails,
        answerResult,
        finalPointsEarned,
        isCorrect,
        randomPoints
    });

    game.playerAnswers[slot][nickname] = snapshot;
    persistSnapshotToRedis({ sPin, slot, nickname, snapshot });

    if (socket && socket.data && socket.data.answers) {
        const socketAnswer = socket.data.answers[game.currentIndex];
        if (socketAnswer) {
            persistRawSocketAnswer({ sPin, slot, nickname, socketAnswer });
        }
    }
}

module.exports = {
    persistPlayerAnswerSnapshot
};
