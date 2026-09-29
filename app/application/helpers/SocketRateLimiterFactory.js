/**
 * @fileoverview Socket Rate Limiter Factory
 * @module application/helpers/SocketRateLimiterFactory
 *
 * Creates rate limiter instances compatible with the Chain of Responsibility
 * RateLimitHandler. Eliminates copy-pasted rate-limit logic across use cases.
 *
 * Two implementations are provided:
 * - createSocketRateLimiter: local in-process Map (per-worker, legacy)
 * - createRedisRateLimiter: Redis-backed distributed limiter (shared across workers)
 *   Falls back to local counting if Redis is unavailable.
 */

const logger = require('../../config/logger');

/**
 * Creates a rate limiter using the shared socketRateLimits Map
 * @param {Map} socketRateLimits - Shared rate limits map from dependencies
 * @param {Object} [options] - Configuration
 * @param {number} [options.windowMs=10000] - Rate limit window in ms
 * @param {number} [options.maxAttempts=5] - Max attempts per window
 * @returns {Object|null} Rate limiter with checkLimit(socketId, operation) method
 */
function createSocketRateLimiter(socketRateLimits, options = {}) {
    if (!socketRateLimits) return null;

    const { windowMs = 10000, maxAttempts = 5 } = options;

    return {
        checkLimit(socketId, _operation) {
            const now = Date.now();

            if (!socketRateLimits.has(socketId)) {
                socketRateLimits.set(socketId, {
                    firstAttempt: now,
                    attempts: 1
                });
                return true;
            }

            const limitData = socketRateLimits.get(socketId);

            if (now - limitData.firstAttempt > windowMs) {
                socketRateLimits.set(socketId, {
                    firstAttempt: now,
                    attempts: 1
                });
                return true;
            }

            limitData.attempts++;
            return limitData.attempts <= maxAttempts;
        }
    };
}

/**
 * Creates a distributed rate limiter backed by Redis.
 * Key: `ratelimit:{operation}:{socketId}` — TTL = windowMs / 1000 seconds.
 * Falls back to local Map counting if Redis is unavailable.
 *
 * @param {Object} options
 * @param {Function} options.getRedisClient - async fn that returns the shared Redis client
 * @param {number} [options.windowMs=10000] - Rate limit window in ms
 * @param {number} [options.maxAttempts=5] - Max attempts per window
 * @returns {Object} Rate limiter with async checkLimit(socketId, operation) method
 */
function createRedisRateLimiter(options = {}) {
    const { getRedisClient, windowMs = 10000, maxAttempts = 5 } = options;
    const windowSec = Math.ceil(windowMs / 1000);

    // Local fallback map used when Redis is unavailable
    const localFallback = new Map();

    function checkLocal(socketId, operation) {
        const key = `${operation}:${socketId}`;
        const now = Date.now();
        const entry = localFallback.get(key);
        if (!entry || now - entry.firstAttempt > windowMs) {
            localFallback.set(key, { firstAttempt: now, attempts: 1 });
            return true;
        }
        entry.attempts++;
        return entry.attempts <= maxAttempts;
    }

    return {
        async checkLimit(socketId, operation) {
            const redisKey = `ratelimit:${operation}:${socketId}`;
            try {
                const redis = await getRedisClient();
                // INCR returns the new value; set expiry only on first hit
                const count = await redis.incr(redisKey);
                if (count === 1) {
                    // First request in this window — set TTL
                    await redis.expire(redisKey, windowSec);
                }
                return count <= maxAttempts;
            } catch (err) {
                logger.warn('Redis rate limiter unavailable, falling back to local', {
                    error: err.message,
                    socketId,
                    operation
                });
                return checkLocal(socketId, operation);
            }
        }
    };
}

module.exports = { createSocketRateLimiter, createRedisRateLimiter };
