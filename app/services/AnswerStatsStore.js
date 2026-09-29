/**
 * @fileoverview Answer Stats Store - Conteo de respuestas por pregunta en Redis
 * @module services/AnswerStatsStore
 */

const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

class AnswerStatsStore {
    constructor() {
        this.keyPrefix = 'answerstats:';
        this.defaultTTL = 6 * 60 * 60; // 6 horas en segundos
    }

    _getKey(sessionId, questionIndex) {
        return `${this.keyPrefix}${sessionId}:${questionIndex}`;
    }

    async increment(sessionId, questionIndex, answerIndex, ttl = this.defaultTTL) {
        try {
            const client = await getRedisClient();
            const key = this._getKey(sessionId, questionIndex);
            // Pipeline increment and TTL using MULTI/EXEC
            await client.multi()
                .hIncrBy(key, String(answerIndex), 1)
                .expire(key, ttl)
                .exec();
            return true;
        } catch (error) {
            logger.warn('Failed to increment answer stats', {
                sessionId,
                questionIndex,
                answerIndex,
                error: error.message
            });
            return false;
        }
    }

    async getStats(sessionId, questionIndex) {
        try {
            const client = await getRedisClient();
            const key = this._getKey(sessionId, questionIndex);
            const raw = await client.hGetAll(key);

            const stats = {};
            Object.keys(raw || {}).forEach((k) => {
                const count = Number(raw[k]);
                if (Number.isFinite(count)) {
                    stats[k] = count;
                }
            });
            return stats;
        } catch (error) {
            logger.warn('Failed to get answer stats', {
                sessionId,
                questionIndex,
                error: error.message
            });
            return {};
        }
    }

    async clearQuestion(sessionId, questionIndex) {
        try {
            const client = await getRedisClient();
            const key = this._getKey(sessionId, questionIndex);
            await client.del(key);
            return true;
        } catch (error) {
            logger.warn('Failed to clear answer stats', {
                sessionId,
                questionIndex,
                error: error.message
            });
            return false;
        }
    }
}

module.exports = new AnswerStatsStore();
module.exports.AnswerStatsStore = AnswerStatsStore;
