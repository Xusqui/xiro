/**
 * @fileoverview Redis distributed lock for submit-answer idempotency cross-worker.
 * @module application/commands/submit-answer/distributedLock
 */

const logger = require('../../../config/logger');
const { getRedisClient } = require('../../../config/redis');
const { recordAnswerLockMetric } = require('./lockMetrics');

const LOCK_PREFIX = 'submit-answer-lock';
const DEFAULT_LOCK_SECONDS = 120;

function buildAnswerLockKey({ roomId, playerId, questionIndex, questionEpoch }) {
    return `${LOCK_PREFIX}:${roomId}:${questionIndex}:${questionEpoch}:${playerId}`;
}

function resolveQuestionEpoch(game) {
    if (Number.isInteger(game?.trivialQuestionEpoch)) {
        return game.trivialQuestionEpoch;
    }
    if (Number.isFinite(Number(game?.questionStartTime))) {
        return Number(game.questionStartTime);
    }
    return 0;
}

function resolveLockTtlSeconds(questionTimeLimit) {
    const parsed = Number(questionTimeLimit);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LOCK_SECONDS;
    return Math.max(30, Math.min(300, Math.ceil(parsed + 20)));
}

async function tryAcquireAnswerLock({ roomId, game, playerId, questionIndex, questionTimeLimit }) {
    const questionEpoch = resolveQuestionEpoch(game);
    const lockKey = buildAnswerLockKey({ roomId, playerId, questionIndex, questionEpoch });
    const ttlSeconds = resolveLockTtlSeconds(questionTimeLimit);

    try {
        const redis = await getRedisClient();
        const result = await redis.set(lockKey, String(Date.now()), { NX: true, EX: ttlSeconds });
        const acquired = result === 'OK';

        await recordAnswerLockMetric({
            roomId,
            acquired,
            degraded: false,
            redisClient: redis
        });

        return {
            acquired,
            lockKey,
            questionEpoch,
            ttlSeconds,
            degraded: false
        };
    } catch (error) {
        logger.warn('Submit-answer distributed lock unavailable, falling back to local checks', {
            roomId,
            playerId,
            questionIndex,
            error: error.message
        });

        await recordAnswerLockMetric({
            roomId,
            acquired: true,
            degraded: true
        });

        return {
            acquired: true,
            lockKey,
            questionEpoch,
            ttlSeconds,
            degraded: true
        };
    }
}

module.exports = {
    tryAcquireAnswerLock
};
