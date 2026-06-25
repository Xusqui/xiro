/**
 * @fileoverview Distributed metrics for reconnect-failed reasons.
 * @module sockets/handlers/reconnectMetrics
 */

const logger = require('../../config/logger');
const { getRedisClient } = require('../../config/redis');
const metrics = require('../../state/metrics');

const METRICS_PREFIX = 'metrics:reconnect-failed:v1';
const METRICS_TTL_SECONDS = 7 * 24 * 60 * 60;

const COUNTERS = {
    total: 'total',
    reasonPrefix: 'reason:'
};

function normalizeReason(reason) {
    if (typeof reason !== 'string') return 'unknown';
    const normalized = reason.trim().toLowerCase();
    return normalized || 'unknown';
}

function normalizeActor(actor) {
    if (typeof actor !== 'string') return 'player';
    const normalized = actor.trim().toLowerCase();
    return normalized || 'player';
}

function getGlobalMetricsKey() {
    return `${METRICS_PREFIX}:global`;
}

function getActorMetricsKey(actor) {
    return `${METRICS_PREFIX}:actor:${normalizeActor(actor)}`;
}

function zeroReconnectMetrics() {
    return {
        total: 0,
        invalid_secret: 0,
        reasons: {}
    };
}

function parseReconnectHash(hash) {
    const snapshot = zeroReconnectMetrics();
    const total = Number.parseInt(hash?.[COUNTERS.total] || '0', 10);
    snapshot.total = Number.isFinite(total) ? total : 0;

    Object.entries(hash || {}).forEach(([field, value]) => {
        if (!field.startsWith(COUNTERS.reasonPrefix)) return;
        const reason = field.slice(COUNTERS.reasonPrefix.length);
        const count = Number.parseInt(value || '0', 10);
        snapshot.reasons[reason] = Number.isFinite(count) ? count : 0;
    });

    snapshot.invalid_secret = snapshot.reasons['invalid-secret'] || 0;
    return snapshot;
}

async function incrementReconnectKey(redisClient, key, reason) {
    const tx = redisClient.multi();
    tx.hIncrBy(key, COUNTERS.total, 1);
    tx.hIncrBy(key, `${COUNTERS.reasonPrefix}${reason}`, 1);
    tx.expire(key, METRICS_TTL_SECONDS);
    await tx.exec();
}

async function recordReconnectFailedMetric({ reason, actor = 'player', redisClient = null }) {
    const normalizedReason = normalizeReason(reason);
    const normalizedActor = normalizeActor(actor);

    metrics.recordReconnectFailedAttempt({
        reason: normalizedReason,
        actor: normalizedActor
    });

    try {
        const redis = redisClient || await getRedisClient();
        await incrementReconnectKey(redis, getGlobalMetricsKey(), normalizedReason);
        await incrementReconnectKey(redis, getActorMetricsKey(normalizedActor), normalizedReason);
    } catch (error) {
        logger.warn('Reconnect metrics unavailable', {
            reason: normalizedReason,
            actor: normalizedActor,
            error: error.message
        });
    }
}

async function getDistributedReconnectFailedMetrics({ actor } = {}) {
    try {
        const redis = await getRedisClient();
        const globalHash = await redis.hGetAll(getGlobalMetricsKey());

        let actorSnapshot = null;
        if (actor) {
            const actorHash = await redis.hGetAll(getActorMetricsKey(actor));
            actorSnapshot = parseReconnectHash(actorHash);
        }

        return {
            global: parseReconnectHash(globalHash),
            actor: actorSnapshot
        };
    } catch (error) {
        logger.warn('Could not read distributed reconnect metrics', {
            actor,
            error: error.message
        });

        return {
            global: zeroReconnectMetrics(),
            actor: null
        };
    }
}

module.exports = {
    recordReconnectFailedMetric,
    getDistributedReconnectFailedMetrics,
    zeroReconnectMetrics
};
