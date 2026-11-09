/**
 * @fileoverview Handlers de mensajes Redis entrantes sobre rachas, temporizador y configuración en caliente.
 * Son métodos de RedisSyncBus (usan this.state): RedisSyncBus.js los añade a su prototipo.
 */

const logger = require('../../config/logger');
const { getWorkerContext } = require('../../config/log-context');
const { SCORING } = require('../../config/game-constants');
const { clearGameTimer, timerPausedState } = require('../../state/globalState');
const runtimeConfig = require('../../config/runtime-config');
const { parseRedisMessage } = require('./redis-sync-payloads');

module.exports = {
    /**
     * `streak-reset-sync`: pone a cero la racha de los jugadores indicados. Ignora los mensajes de este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleStreakResetSync(message) {
        const data = parseRedisMessage(message, 'streak-reset-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const game = this.state.activeGames.get(data.roomId);
        if (!game) {
            return;
        }

        if (!game.playerStreaks) {
            game.playerStreaks = {};
        }
        if (!game.playerStreakInfos) {
            game.playerStreakInfos = {};
        }

        for (const nickname of data.nicknames) {
            const prevStreak = game.playerStreaks[nickname] || 0;
            game.playerStreaks[nickname] = 0;
            game.playerStreakInfos[nickname] = {
                current: 0,
                previous: prevStreak,
                threshold: game.streak_threshold ?? SCORING.STREAK.DEFAULT_THRESHOLD,
                isInStreak: false,
                justLost: false,
                justEntered: false,
                isInDoubleStreak: false,
                justEnteredDoubleStreak: false
            };
        }

        logger.debug('Streak reset cross-worker aplicado', { roomId: data.roomId, nicknames: data.nicknames });
    },

    /**
     * `streak-restored-sync`: restaura la racha de un jugador. Ignora los mensajes de este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleStreakRestoredSync(message) {
        const data = parseRedisMessage(message, 'streak-restored-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const game = this.state.activeGames.get(data.roomId);
        if (!game) {
            return;
        }

        if (!game.playerStreaks) {
            game.playerStreaks = {};
        }
        if (!game.playerStreakInfos) {
            game.playerStreakInfos = {};
        }

        game.playerStreaks[data.nickname] = data.streak;
        game.playerStreakInfos[data.nickname] = data.streakInfo;

        logger.debug('Streak restored cross-worker', {
            roomId: data.roomId,
            nickname: data.nickname,
            streak: data.streak
        });
    },

    /**
     * `timer-paused-sync`: cancela el temporizador local; lo retoma el worker que reanude. Ignora los mensajes de este
     * mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleTimerPausedSync(message) {
        const data = parseRedisMessage(message, 'timer-paused-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        try {
            clearGameTimer(data.roomId);
            if (timerPausedState) {
                timerPausedState.delete(data.roomId);
            }
            logger.debug('Timer cleared cross-worker after pause', {
                roomId: data.roomId,
                originWorkerId: data.originWorkerId
            });
        } catch (err) {
            logger.warn('Failed to clear timer after pause sync', { roomId: data.roomId, error: err.message });
        }
    },

    /**
     * `timer-resumed-sync`: solo lo registra; el temporizador corre en el worker que reanudó. Ignora los mensajes de
     * este mismo worker.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleTimerResumedSync(message) {
        const data = parseRedisMessage(message, 'timer-resumed-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        logger.debug('Timer resumed notification received', {
            roomId: data.roomId,
            originWorkerId: data.originWorkerId
        });
    },

    /**
     * `config-updated`: recarga la configuración en caliente y, si cambió `LOG_LEVEL`, el nivel del logger. Se aplica
     * también en el worker de origen.
     * @param {string} message - Mensaje JSON recibido del canal
     * @returns {void}
     */
    handleConfigUpdatedSync(message) {
        runtimeConfig.reload();

        const data = parseRedisMessage(message, 'config-updated');
        const keys = data?.keys;
        if (Array.isArray(keys) && keys.includes('LOG_LEVEL')) {
            const newLevel = runtimeConfig.get('LOG_LEVEL');
            logger.setLogLevel(newLevel);
        }

        logger.info('Runtime config reloaded from Redis notification', getWorkerContext());
    }
};
