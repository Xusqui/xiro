/**
 * @fileoverview Domain event emission and canonical score updates.
 * @module application/commands/submit-answer/eventsAndScore
 *
 * Purpose:
 * - Emit answer.submitted and player.scored domain events.
 * - Keep local score in sync with Redis atomic score increments.
 * - Preserve existing response/event payload semantics.
 */

const EventBus = require('../../../domain/events/EventBus');
const { AnswerSubmittedEvent, PlayerScoredEvent } = require('../../../domain/events/GameEvents');
const AnswerProcessingService = require('../../../domain/services/AnswerProcessingService');
const ScoringService = require('../../../domain/services/ScoringService');
const { getRedisClient } = require('../../../config/redis');
const logger = require('../../../config/logger');

/**
 * Emit answer-submitted domain event.
 *
 * @param {Object} ctx - Event context.
 * @returns {void}
 */
function emitAnswerSubmitted(ctx) {
    const {
        sPin,
        playerId,
        nickname,
        game,
        payload,
        flags,
        answerResult,
        isCorrect
    } = ctx;

    EventBus.emit('answer.submitted', new AnswerSubmittedEvent({
        gameId: sPin,
        playerId,
        nickname,
        questionIndex: game.currentIndex,
        answerIndex: (flags.isOrderQuestion
            || flags.isNumericQuestion
            || flags.isWordScrambleQuestion
            || flags.isMultipleChoiceQuestion)
            ? null
            : payload.index,
        isCorrect: answerResult.isSurvey ? null : isCorrect,
        timeElapsed: Date.now() - game.questionStartTime
    }));
}

/**
 * Update score and emit player-scored event when question is scoreable.
 *
 * @param {Object} ctx - Scoring context.
 * @returns {Promise<number>} Canonical total score after update.
 */
async function updateScoreAndEmitPlayerScored(ctx) {
    const {
        game,
        sPin,
        playerId,
        nickname,
        player,
        socket,
        isCorrect,
        answerResult,
        finalPointsEarned,
        streakBonus
    } = ctx;

    if (answerResult.isSurvey) {
        return game.scores[nickname] || 0;
    }

    AnswerProcessingService.updatePlayerScore({
        game,
        nickname,
        pointsEarned: finalPointsEarned,
        player,
        socket
    });

    let canonicalTotalScore = game.scores[nickname];

    try {
        const redisClient = await getRedisClient();
        const scoreKey = `game:scores:${sPin}`;
        const redisTotal = await redisClient.hIncrByFloat(scoreKey, nickname, finalPointsEarned);
        redisClient.expire(scoreKey, 7200).catch(() => { });

        if (redisTotal !== null && !isNaN(Number(redisTotal))) {
            canonicalTotalScore = ScoringService.roundScore(Number(redisTotal));
            game.scores[nickname] = canonicalTotalScore;
        }
    } catch (error) {
        logger.warn('Atomic score increment failed, using local score', {
            roomId: sPin,
            nickname,
            error: error.message
        });
    }

    EventBus.emit('player.scored', new PlayerScoredEvent({
        gameId: sPin,
        playerId,
        nickname,
        questionIndex: game.currentIndex,
        pointsEarned: finalPointsEarned,
        totalScore: canonicalTotalScore,
        isCorrect,
        scoringDetails: {
            ...(answerResult.details || {}),
            streakBonus: streakBonus.bonusPoints,
            streakBonusType: streakBonus.bonusType,
            streakBonusPercentage: streakBonus.bonusPercentage
        }
    }));

    return canonicalTotalScore;
}

module.exports = {
    emitAnswerSubmitted,
    updateScoreAndEmitPlayerScored
};
