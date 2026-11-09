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
const { isSurveyType } = require('../../../domain/services/SurveyMultipleAnswerService');
const { clearStaleAnswers } = require('../../../sockets/handlers/trivial/TrivialAnswerGuard');
const { tryAcquireAnswerLock } = require('./distributedLock');

const MIN_RESPONSE_MS = 300;

/**
 * Run all early checks that can short-circuit execution.
 *
 * @param {Object} ctx - Required execution context.
 * @returns {Promise<{shouldStop: boolean, result?: Object}>}
 */
// Anti-cheat: reject impossible human reaction times.
function isImpossiblyFast({ game, currentQuestion, nickname, sPin }) {
    const questionStart = game.questionStartTime;
    if (!questionStart || isSurveyType(currentQuestion?.question_type)) return false;

    const responseMs = Date.now() - questionStart;
    if (responseMs >= MIN_RESPONSE_MS) return false;

    logger.warn('Anti-cheat: respuesta rechazada por latencia minima', {
        roomId: sPin,
        nickname,
        responseMs,
        threshold: MIN_RESPONSE_MS,
        questionIndex: game.currentIndex
    });
    return true;
}

// Cross-worker idempotency lock: prevent scoring race conditions.
async function isBlockedByAnswerLock({ game, playerId, currentQuestion, nickname, sPin }) {
    const lock = await tryAcquireAnswerLock({
        roomId: sPin,
        game,
        playerId,
        questionIndex: game.currentIndex,
        questionTimeLimit: currentQuestion?.time_limit
    });
    if (lock.acquired) return false;

    logger.warn('Submit-answer duplicate blocked by distributed lock', {
        roomId: sPin,
        nickname,
        playerId,
        questionIndex: game.currentIndex,
        lockKey: lock.lockKey,
        questionEpoch: lock.questionEpoch
    });
    return true;
}

async function runEarlyChecks(ctx) {
    const { game, player, socket, currentQuestion } = ctx;

    // If game ended, answer is accepted but ignored for scoring.
    if (game?.ended) {
        return { shouldStop: true, result: { success: true, late: true } };
    }

    // Juegos personalizados: una diapositiva revisada ya se jugó y no se vuelve a jugar
    if (game?.reviewMode) {
        return { shouldStop: true, result: { success: false, reason: 'review-mode' } };
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

    if (isImpossiblyFast(ctx)) {
        return { shouldStop: true, result: { success: false, reason: 'too-fast' } };
    }

    if (await isBlockedByAnswerLock(ctx)) {
        return { shouldStop: true, result: { success: true, duplicate: true } };
    }

    return { shouldStop: false };
}

module.exports = {
    runEarlyChecks
};
