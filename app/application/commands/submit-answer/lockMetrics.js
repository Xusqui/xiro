/**
 * @fileoverview Distributed metrics for submit-answer lock behavior.
 * @module application/commands/submit-answer/lockMetrics
 */

const logger = require('../../../config/logger');
const { getRedisClient } = require('../../../config/redis');
const metrics = require('../../../state/metrics');

const METRICS_PREFIX = 'metrics:submit-answer-lock:v1';
const METRICS_TTL_SECONDS = 7 * 24 * 60 * 60;

const COUNTERS = {
    attempts: 'attempts',
    acquired: 'acquired',
    lockMiss: 'lock_miss',
    degradedFallback: 'degraded_fallback'
};

function normalizeRoomId(roomId) {
    return typeof roomId === 'string' ? roomId.trim() : '';
}

function getGlobalMetricsKey() {
    return `${METRICS_PREFIX}:global`;
}

function getRoomMetricsKey(roomId) {
    return `${METRICS_PREFIX}:room:${normalizeRoomId(roomId)}`;
}

function buildCounterPatch({ acquired, degraded }) {
    return {
        [COUNTERS.attempts]: 1,
        [COUNTERS.acquired]: acquired ? 1 : 0,
        [COUNTERS.lockMiss]: acquired ? 0 : 1,
        [COUNTERS.degradedFallback]: degraded ? 1 : 0
    };
}

function zeroMetrics() {
    return {
        attempts: 0,
        acquired: 0,
        lock_miss: 0,
        degraded_fallback: 0,
        miss_rate: 0
    };
}

function parseHashCounters(hash) {
    const base = zeroMetrics();
    const attempts = Number.parseInt(hash?.[COUNTERS.attempts] || '0', 10);
    const acquired = Number.parseInt(hash?.[COUNTERS.acquired] || '0', 10);
    const lockMiss = Number.parseInt(hash?.[COUNTERS.lockMiss] || '0', 10);
    const degradedFallback = Number.parseInt(hash?.[COUNTERS.degradedFallback] || '0', 10);

    const safeAttempts = Number.isFinite(attempts) ? attempts : 0;
    const safeAcquired = Number.isFinite(acquired) ? acquired : 0;
    const safeLockMiss = Number.isFinite(lockMiss) ? lockMiss : 0;
    const safeDegradedFallback = Number.isFinite(degradedFallback) ? degradedFallback : 0;

    const missRate = safeAttempts > 0
        ? Number(((safeLockMiss / safeAttempts) * 100).toFixed(2))
        : 0;

    return {
        ...base,
        attempts: safeAttempts,
        acquired: safeAcquired,
        lock_miss: safeLockMiss,
        degraded_fallback: safeDegradedFallback,
        miss_rate: missRate
    };
}

async function applyPatchToKey(redisClient, key, patch) {
    const tx = redisClient.multi();
    Object.entries(patch).forEach(([field, value]) => {
        if (value > 0) {
            tx.hIncrBy(key, field, value);
        }
    });
    tx.expire(key, METRICS_TTL_SECONDS);
    await tx.exec();
}

async function recordAnswerLockMetric({ roomId, acquired, degraded, redisClient = null }) {
    const patch = buildCounterPatch({ acquired, degraded });

    // Local per-worker snapshot.
    metrics.recordAnswerLockAttempt({ acquired, degraded });

    try {
        const redis = redisClient || await getRedisClient();
        await applyPatchToKey(redis, getGlobalMetricsKey(), patch);

        const normalizedRoom = normalizeRoomId(roomId);
        if (normalizedRoom) {
            await applyPatchToKey(redis, getRoomMetricsKey(normalizedRoom), patch);
        }
    } catch (error) {
        logger.warn('Submit-answer lock metrics unavailable', {
            roomId,
            acquired,
            degraded,
            error: error.message
        });
    }
}

async function getDistributedAnswerLockMetrics({ roomId } = {}) {
    try {
        const redis = await getRedisClient();
        const globalHash = await redis.hGetAll(getGlobalMetricsKey());

        let room = null;
        const normalizedRoom = normalizeRoomId(roomId);
        if (normalizedRoom) {
            const roomHash = await redis.hGetAll(getRoomMetricsKey(normalizedRoom));
            room = parseHashCounters(roomHash);
        }

        return {
            global: parseHashCounters(globalHash),
            room
        };
    } catch (error) {
        logger.warn('Could not read distributed submit-answer lock metrics', {
            roomId,
            error: error.message
        });

        return {
            global: zeroMetrics(),
            room: null
        };
    }
}

module.exports = {
    recordAnswerLockMetric,
    getDistributedAnswerLockMetrics,
    zeroMetrics
};
