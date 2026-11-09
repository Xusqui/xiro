/**
 * @fileoverview Estado del temporizador de una sala en Redis (hash `timer:state:<sala>`) y su copia local
 * en cada worker (`timerPausedState`). Lo comparten los handlers de pausa y reanudación.
 */

const logger = require('../../config/logger');

/**
 * Lee el estado del temporizador desde Redis y alinea la copia local del worker.
 * Se refresca siempre desde Redis para no usar un estado obsoleto de otro worker o de otra pregunta.
 * @param {string} roomId - Sala
 * @param {Map<string, {isPaused: boolean, startTime: number, remainingTime: number}>} timerPausedState - Copia local
 * @param {'pause'|'resume'} action - Operación que lo pide (para el log)
 * @returns {Promise<{isPaused: boolean, startTime: number, remainingTime: number}|null>} null si no hay estado
 */
async function loadTimerState(roomId, timerPausedState, action) {
    try {
        const { getRedisClient } = require('../../config/redis');
        const redis = await getRedisClient();
        const redisState = await redis.hGetAll(`timer:state:${roomId}`);

        if (!redisState || !redisState.startTime) {
            // Evitar reutilizar valores viejos si Redis no tiene estado para esta sala
            timerPausedState.delete(roomId);
            return null;
        }

        const timerState = {
            isPaused: redisState.isPaused === '1',
            startTime: Number(redisState.startTime),
            remainingTime: Number(redisState.remainingTime)
        };
        timerPausedState.set(roomId, timerState);
        logger.info('Timer state loaded from Redis', { sPin: roomId, action, isPaused: timerState.isPaused });
        return timerState;
    } catch (err) {
        logger.warn('Failed to load timer state from Redis', { error: err.message });
        // Fallback a local solo si Redis falla
        return timerPausedState.get(roomId) || null;
    }
}

/**
 * Guarda el estado del temporizador en Redis. Un fallo se registra y no se relanza.
 * @param {string} roomId - Sala
 * @param {{isPaused: boolean, startTime: number, remainingTime: number}} timerState - Estado a guardar
 * @param {'pause'|'resume'} action - Operación que lo pide (para el log)
 * @returns {Promise<void>}
 */
async function saveTimerState(roomId, timerState, action) {
    try {
        const { getRedisClient } = require('../../config/redis');
        const redis = await getRedisClient();
        await redis.hSet(`timer:state:${roomId}`, {
            isPaused: timerState.isPaused ? '1' : '0',
            startTime: String(timerState.startTime),
            remainingTime: String(timerState.remainingTime)
        });
        logger.debug('Timer state saved to Redis', {
            sPin: roomId,
            action,
            isPaused: timerState.isPaused,
            remainingTime: timerState.remainingTime
        });
    } catch (err) {
        logger.warn('Failed to save timer state to Redis', { action, error: err.message });
    }
}

/**
 * Avisa a los demás workers de la pausa o la reanudación. Un fallo se registra y no se relanza.
 * @param {string} roomId - Sala
 * @param {'pause'|'resume'} action - Pausa o reanudación
 * @returns {Promise<void>}
 */
async function publishTimerChange(roomId, action) {
    const isPause = action === 'pause';
    try {
        const { RedisSyncBus } = require('../sync/RedisSyncBus');
        const bus = RedisSyncBus.getInstance();
        await (isPause ? bus.publishTimerPaused(roomId) : bus.publishTimerResumed(roomId));
    } catch (err) {
        logger.warn(`Failed to publish timer ${isPause ? 'paused' : 'resumed'} event`, { error: err.message });
    }
}

module.exports = { loadTimerState, saveTimerState, publishTimerChange };
