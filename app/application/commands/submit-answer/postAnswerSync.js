/**
 * @fileoverview Cross-worker synchronization after processing an answer.
 * @module application/commands/submit-answer/postAnswerSync
 *
 * Purpose:
 * - Publish score updates through Redis sync bus.
 * - Persist only mutable game slices needed by reveal handlers.
 */

const SessionSaveDebouncer = require('../../../services/SessionSaveDebouncer');
const GameStateUpdateService = require('../../../domain/services/GameStateUpdateService');

/**
 * Synchronize score/session state after a successful answer process.
 *
 * @param {Object} ctx - Synchronization context.
 * @returns {Promise<void>}
 */
async function syncPostAnswerState(ctx) {
    const {
        sPin,
        nickname,
        game,
        syncBus,
        logger
    } = ctx;

    await GameStateUpdateService.publishScoreUpdate({
        roomId: sPin,
        nickname,
        score: game.scores[nickname],
        currentIndex: game.currentIndex,
        allScores: game.scores,
        syncBus,
        logger
    });

    SessionSaveDebouncer.save(sPin, {
        scores: game.scores,
        answerStats: game.answerStats
    }).catch(err => {
        logger.error('Failed to save session in background', {
            sPin,
            error: err.message
        });
    });
}

module.exports = {
    syncPostAnswerState
};
