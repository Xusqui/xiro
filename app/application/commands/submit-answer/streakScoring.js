/**
 * @fileoverview Streak and score bonus orchestration.
 * @module application/commands/submit-answer/streakScoring
 *
 * Purpose:
 * - Compute streak transitions for all question types.
 * - Apply streak/double-streak bonus over base points.
 * - Register round progress and persist streak data to Redis.
 */

const logger = require('../../../config/logger');
const { STREAK_TTL_SECONDS } = require('../../../config/game-constants');
const { getRedisClient } = require('../../../config/redis');
const ScoringService = require('../../../domain/services/ScoringService');
const StreakTrackingService = require('../../../domain/services/StreakTrackingService');
const GameStreakApplicator = require('../../../domain/services/GameStreakApplicator');
const { registerAnswerAndGetProgress } = require('../../../sockets/utils/AtomicAnswerCounter');
const { getAnswerHandler } = require('../../question-types/AnswerHandlerRegistry');

function runWithRedisClient(action, onError = () => {}) {
    Promise.resolve()
        .then(() => getRedisClient())
        .then(action)
        .catch(onError);
}

/**
 * Compute streak effects and final points from base points.
 *
 * @param {Object} ctx - Streak context.
 * @returns {Object} Computed streak and points information.
 */
function computeStreakAndPoints(ctx) {
    const { game, nickname, flags, answerResult } = ctx;

    const { isCorrect, pointsEarned } = answerResult;
    const prevStreak = game.playerStreaks?.[nickname] || 0;

    // Tipos con acierto parcial: la racha sube (true), se mantiene (null) o se rompe (false)
    const { streakAction } = getAnswerHandler(flags.questionType);
    const partialStreak = streakAction ? streakAction(answerResult) : undefined;

    // Las encuestas no tocan la racha
    const isTrackedForStreak = !answerResult.isSurvey;
    const streakIsCorrect = streakAction ? partialStreak : isCorrect;

    const streakInfo = StreakTrackingService.processPlayerStreak({
        game,
        nickname,
        isCorrect: streakIsCorrect,
        isTracked: isTrackedForStreak
    });

    const effectiveCorrectForBonus = streakAction ? partialStreak === true : isCorrect;

    const streakBonus =
        isTrackedForStreak && effectiveCorrectForBonus
            ? GameStreakApplicator.applyStreakBonus(pointsEarned, prevStreak, game, nickname)
            : { bonusPoints: 0, bonusType: null, bonusPercentage: 0 };

    const finalPointsEarned = ScoringService.roundScore(pointsEarned + streakBonus.bonusPoints);
    const enrichedStreakInfo = GameStreakApplicator.enrichStreakInfo(streakInfo, game);

    logger.debug('Streak check', {
        roomId: ctx.sPin,
        nickname,
        prevStreak,
        newStreak: streakInfo.current,
        use_streaks: game.use_streaks,
        use_double_streaks: game.use_double_streaks,
        bonusType: streakBonus.bonusType,
        bonusPoints: streakBonus.bonusPoints,
        basePoints: pointsEarned,
        finalPoints: finalPointsEarned
    });

    return {
        isCorrect,
        pointsEarned,
        prevStreak,
        streakBonus,
        streakInfo,
        enrichedStreakInfo,
        finalPointsEarned
    };
}

/**
 * Register answer progress and persist streak snapshots in Redis.
 *
 * @param {Object} ctx - Registration context.
 * @returns {Promise<Object|null>} Atomic progress result or null.
 */
async function registerProgressAndPersistStreak(ctx) {
    const { game, sPin, roomId, nickname, io, enrichedStreakInfo } = ctx;

    if (!game.answeredCurrent) game.answeredCurrent = new Set();
    game.answeredCurrent.add(nickname);

    let atomicProgress = null;

    if (game?.isTrivial && game?.trivialQuestionEpoch) {
        const answeredKey = `game:answered:${sPin}:${game.trivialQuestionEpoch}`;
        runWithRedisClient(client => client.sAdd(answeredKey, nickname));
    } else {
        try {
            atomicProgress = await registerAnswerAndGetProgress({
                roomId: sPin,
                nickname,
                io
            });
        } catch (error) {
            logger.warn('Atomic answer progress failed, using legacy fallback', {
                roomId: sPin,
                nickname,
                error: error.message
            });
        }
    }

    const streakKey = game.isTrivial ? `trivial:streaks:${roomId}` : `game:streaks:${roomId}`;
    const streakInfoKey = game.isTrivial ? `trivial:streakinfos:${roomId}` : `game:streakinfos:${roomId}`;

    runWithRedisClient(
        client =>
            Promise.all([
                client.hSet(streakKey, nickname, String(game.playerStreaks[nickname] || 0)),
                client.hSet(streakInfoKey, nickname, JSON.stringify(enrichedStreakInfo)),
                client.expire(streakKey, STREAK_TTL_SECONDS),
                client.expire(streakInfoKey, STREAK_TTL_SECONDS)
            ]),
        error => {
            logger.warn('Failed to persist streak to Redis', { roomId, nickname, error: error.message });
        }
    );

    return atomicProgress;
}

module.exports = {
    computeStreakAndPoints,
    registerProgressAndPersistStreak
};
