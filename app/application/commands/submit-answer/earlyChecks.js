/**
 * @fileoverview Early guards before mutating player/game state.
 * @module application/commands/submit-answer/earlyChecks
 *
 * Purpose:
 * - Keep idempotency and anti-cheat checks together.
 * - Exit early for ended games and duplicate answers.
 * - Reuse previous duplicate handling behavior unchanged.
 */

const logger = require('../../../config/logger');
const AnswerStateService = require('../../../domain/services/AnswerStateService');
const AnswerProcessingService = require('../../../domain/services/AnswerProcessingService');
const { clearStaleAnswers } = require('../../../sockets/handlers/trivial/TrivialAnswerGuard');
const { tryAcquireAnswerLock } = require('./distributedLock');

const MIN_RESPONSE_MS = 300;

/**
 * Run all early checks that can short-circuit execution.
 *
 * @param {Object} ctx - Required execution context.
 * @returns {Promise<{shouldStop: boolean, result?: Object}>}
 */
async function runEarlyChecks(ctx) {
    const {
        game,
        player,
        playerId,
        socket,
        currentQuestion,
        nickname,
        sPin
    } = ctx;

    // If game ended, answer is accepted but ignored for scoring.
    if (game?.ended) {
        return { shouldStop: true, result: { success: true, late: true } };
    }

    // Trivial mode cleanup for stale round answers.
    clearStaleAnswers(player, socket, game);

    // Idempotency: do not process same question twice for a player.
    if (AnswerStateService.hasAnswered(player?.answers, game.currentIndex)) {
        await AnswerProcessingService.handleDuplicateAnswer({
            socket,
            player,
            game,
            currentQuestion,
            callback: null
        });
        return { shouldStop: true, result: { success: true, duplicate: true } };
    }

    // Anti-cheat: reject impossible human reaction times.
    const questionStart = game.questionStartTime;
    if (questionStart && currentQuestion?.question_type !== 'survey') {
        const responseMs = Date.now() - questionStart;
        if (responseMs < MIN_RESPONSE_MS) {
            logger.warn('Anti-cheat: respuesta rechazada por latencia minima', {
                roomId: sPin,
                nickname,
                responseMs,
                threshold: MIN_RESPONSE_MS,
                questionIndex: game.currentIndex
            });
            return { shouldStop: true, result: { success: false, reason: 'too-fast' } };
        }
    }

    // Cross-worker idempotency lock: prevent scoring race conditions.
    const lock = await tryAcquireAnswerLock({
        roomId: sPin,
        game,
        playerId,
        questionIndex: game.currentIndex,
        questionTimeLimit: currentQuestion?.time_limit
    });

    if (!lock.acquired) {
        logger.warn('Submit-answer duplicate blocked by distributed lock', {
            roomId: sPin,
            nickname,
            playerId,
            questionIndex: game.currentIndex,
            lockKey: lock.lockKey,
            questionEpoch: lock.questionEpoch
        });

        return { shouldStop: true, result: { success: true, duplicate: true } };
    }

    return { shouldStop: false };
}

module.exports = {
    runEarlyChecks
};
