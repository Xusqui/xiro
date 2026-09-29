/**
 * @fileoverview Lua script for atomic answer counter registration and counts query.
 */

const ANSWER_COUNTER_SCRIPT = `
    local expectedKey = KEYS[1]
    local answeredKey = KEYS[2]
    local nickname = ARGV[1]
    local ttlSeconds = tonumber(ARGV[2])

    if redis.call('EXISTS', expectedKey) == 0 then
        return {-1, -1}
    end

    redis.call('SADD', answeredKey, nickname)
    redis.call('EXPIRE', expectedKey, ttlSeconds)
    redis.call('EXPIRE', answeredKey, ttlSeconds)

    local expectedCount = redis.call('SCARD', expectedKey)
    local answeredCount = redis.call('SCARD', answeredKey)

    return { expectedCount, answeredCount }
`;

let scriptSha = null;

/**
 * Executes the Lua script to atomically register the answer and get progress.
 * If expectedKey doesn't exist, returns [-1, -1].
 * @param {object} redis Redis client
 * @param {string} expectedKey Redis expected players key
 * @param {string} answeredKey Redis answered players key
 * @param {string} nickname Player nickname
 * @param {number} ttlSeconds Expiry TTL in seconds
 * @returns {Promise<number[]>} [expectedCount, answeredCount]
 */
async function executeAnswerCounterScript(redis, expectedKey, answeredKey, nickname, ttlSeconds) {
    if (scriptSha) {
        try {
            return await redis.evalSha(scriptSha, {
                keys: [expectedKey, answeredKey],
                arguments: [nickname, String(ttlSeconds)]
            });
        } catch (err) {
            if (err.message && err.message.includes('NOSCRIPT')) {
                scriptSha = null;
            } else {
                throw err;
            }
        }
    }

    try {
        scriptSha = await redis.scriptLoad(ANSWER_COUNTER_SCRIPT);
        return await redis.evalSha(scriptSha, {
            keys: [expectedKey, answeredKey],
            arguments: [nickname, String(ttlSeconds)]
        });
    } catch (err) {
        // Fallback directly to eval if scriptLoad or evalSha fails
        return await redis.eval(ANSWER_COUNTER_SCRIPT, {
            keys: [expectedKey, answeredKey],
            arguments: [nickname, String(ttlSeconds)]
        });
    }
}

module.exports = {
    executeAnswerCounterScript
};
