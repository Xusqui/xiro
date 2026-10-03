/**
 * @fileoverview Gestión de temporizadores de juego
 * @module sockets/utils/TimerManager
 */

const { activeGames, gameTimers, timerPausedState } = require('../../state/globalState');
const { isLastQuestion, revealAnswer } = require('./GameEndManager');
const timerManager = require('../../services/timer.manager');
const EventBus = require('../../domain/events/EventBus');
const { TimerStartedEvent } = require('../../domain/events/GameEvents');
const logger = require('../../config/logger');
const StreakTrackingService = require('../../domain/services/StreakTrackingService');
const { getRedisClient } = require('../../config/redis');
const { RedisSyncBus } = require('../sync/RedisSyncBus');
const { SCORING } = require('../../config/game-constants');

/**
 * Limpiar timer de una sala
 */
async function clearTimer(roomId) {
    if (gameTimers.has(roomId)) {
        timerManager.clear(gameTimers.get(roomId));
        gameTimers.delete(roomId);
    }
    // Limpiar estado de pausa en memoria
    timerPausedState.delete(roomId);

    // Limpiar estado de pausa en Redis — awaited con un reintento si falla
    try {
        const redis = await getRedisClient();
        await redis.del(`timer:state:${roomId}`);
    } catch (err) {
        logger.warn('Failed to delete timer state from Redis (1st attempt), retrying', { error: err.message });
        try {
            await new Promise(r => setTimeout(r, 500));
            const redis = await getRedisClient();
            await redis.del(`timer:state:${roomId}`);
        } catch (err2) {
            logger.error('Failed to delete timer state from Redis (2nd attempt)', { error: err2.message, roomId });
        }
    }
}

/**
 * Iniciar temporizador para una pregunta
 */
async function startTimer(roomId, timeLimit, io) {
    logger.info('🟢 startTimer CALLED', {
        roomId,
        timeLimit,
        workerId: process.env.INSTANCE_ID || 'unknown'
    });

    await clearTimer(roomId);

    const game = activeGames.get(roomId);
    const currentIndex = game?.currentIndex || 0;

    const timerState = {
        isPaused: false,
        startTime: Date.now(),
        remainingTime: timeLimit
    };

    // Inicializar estado de pausa en memoria local
    timerPausedState.set(roomId, timerState);

    // Guardar también en Redis para compartir entre workers
    // IMPORTANTE: Siempre guardar isPaused: '0' al iniciar un nuevo timer
    try {
        const redis = await getRedisClient();
        await redis.hSet(`timer:state:${roomId}`, {
            isPaused: '0',  // Siempre false al iniciar
            startTime: String(timerState.startTime),
            remainingTime: String(timeLimit)
        });
        logger.debug('Timer state saved to Redis', { roomId, isPaused: false });
    } catch (err) {
        logger.warn('Failed to save timer state to Redis', { error: err.message });
    }

    if (typeof logger.isDebugEnabled !== 'function' || logger.isDebugEnabled()) {
        logger.debug('🟢 timerPausedState SET', {
            roomId,
            stateCount: timerPausedState.size,
            allKeys: Array.from(timerPausedState.keys())
        });
    }

    // Emitir evento de dominio
    EventBus.emit('timer.started', new TimerStartedEvent({
        gameId: roomId,
        questionIndex: currentIndex,
        timeLimit
    }));

    // USAR timerManager para tracking correcto
    const timerId = timerManager.setTimeout(
        () => revelarResultadosAutomatico(roomId, io),
        timeLimit * 1000,
        'game-countdown',
        roomId
    );

    gameTimers.set(roomId, timerId);
}

async function claimRevealLock(roomId) {
    try {
        const redis = await getRedisClient();
        const CLAIM_REVEAL_SCRIPT = `
            local v = redis.call('HGET', KEYS[1], 'isPaused')
            if v == '0' then
                redis.call('HSET', KEYS[1], 'isPaused', '2')
                return 1
            end
            return 0
        `;
        const claimed = await redis.eval(CLAIM_REVEAL_SCRIPT, {
            keys: [`timer:state:${roomId}`],
            arguments: []
        });

        if (claimed !== 1) {
            logger.warn('revelarResultadosAutomatico: Timer pausado o ya reclamado (Lua), abortando reveal', {
                roomId,
                claimResult: claimed
            });
            return false;
        }

        return true;
    } catch (err) {
        const localState = timerPausedState.get(roomId);
        if (localState?.isPaused) {
            logger.warn('revelarResultadosAutomatico: Timer pausado localmente (fallback), abortando reveal', { roomId });
            return false;
        }
        return true;
    }
}

async function loadAnsweredSet(roomId, game) {
    // En Trivial las respuestas se registran por ronda (streakScoring/TrivialAnswerGuard);
    // la clave sin época estaría vacía y se reiniciaría la racha de todos los jugadores.
    // TrivialMoveHandler borra la de la ronda anterior, así que aquí no se borra.
    if (game?.isTrivial && game.trivialQuestionEpoch !== undefined) {
        try {
            const redis = await getRedisClient();
            return new Set(await redis.sMembers(`game:answered:${roomId}:${game.trivialQuestionEpoch}`));
        } catch (err) {
            logger.warn('TimerManager: no se pudo leer answeredCurrent de Redis, usando Set local', { error: err.message });
            return game.answeredCurrent || new Set();
        }
    }

    try {
        const redis = await getRedisClient();
        const members = await redis.sMembers(`game:answered:${roomId}`);
        await redis.del(`game:answered:${roomId}`);
        return new Set(members);
    } catch (err) {
        logger.warn('TimerManager: no se pudo leer answeredCurrent de Redis, usando Set local', { error: err.message });
        return game.answeredCurrent || new Set();
    }
}

function buildLostStreakInfo(game, previous) {
    return {
        current: 0,
        previous,
        threshold: game.streak_threshold ?? SCORING.STREAK.DEFAULT_THRESHOLD,
        isInStreak: false,
        justLost: false,
        justEntered: false,
        isInDoubleStreak: false,
        justEnteredDoubleStreak: false
    };
}

async function persistStreakReset(roomId, game, nonAnswering, previousStreaks) {
    try {
        const redis = await getRedisClient();
        const streakKey = game.isTrivial ? `trivial:streaks:${roomId}` : `game:streaks:${roomId}`;
        const streakInfoKey = game.isTrivial ? `trivial:streakinfos:${roomId}` : `game:streakinfos:${roomId}`;

        for (const nickname of nonAnswering) {
            await redis.hSet(streakKey, nickname, '0');
            await redis.hSet(streakInfoKey, nickname, JSON.stringify(buildLostStreakInfo(game, previousStreaks[nickname])));
        }
    } catch (err) {
        logger.warn('TimerManager: no se pudo persistir streak reset en Redis', { error: err.message });
    }
}

async function resetNonAnsweringStreaks(roomId, game, nonAnswering) {
    if (nonAnswering.length === 0) {
        return;
    }

    logger.debug('Streak reset por tiempo agotado', { roomId, nonAnswering });

    // Se guarda antes de reiniciar: después todas valen 0.
    const previousStreaks = Object.fromEntries(
        nonAnswering.map(nickname => [nickname, game.playerStreaks?.[nickname] || 0])
    );

    for (const nickname of nonAnswering) {
        StreakTrackingService.processPlayerStreak({ game, nickname, isCorrect: false, isTracked: true });
    }

    try {
        await RedisSyncBus.getInstance().publishStreakReset(roomId, nonAnswering);
    } catch (err) {
        logger.warn('TimerManager: no se pudo publicar streak-reset-sync', { error: err.message });
    }

    await persistStreakReset(roomId, game, nonAnswering, previousStreaks);
}

/**
 * Tras revelar una pregunta, quien no respondió pierde la racha (como si hubiera
 * fallado). Lo usan el tiempo agotado y la revelación manual del presentador.
 * Llamar solo si la revelación se ha hecho ahora: lee y borra el conjunto de
 * respuestas de la pregunta, así que una segunda llamada vería a todos sin responder.
 */
async function resetStreaksOfNonAnswering(roomId, game) {
    // Leer desde Redis para tener visibilidad cross-worker (las respuestas se procesan en cualquier worker)
    const allPlayers = (game.players || []).filter(p => p !== 'HOST');
    const answeredSet = await loadAnsweredSet(roomId, game);
    const nonAnswering = allPlayers.filter(p => !answeredSet.has(p));

    await resetNonAnsweringStreaks(roomId, game, nonAnswering);

    // Limpiar el set de respuestas en memoria local
    game.answeredCurrent = new Set();
}

/**
 * Revelar resultados automáticamente al acabar el tiempo
 */
async function revelarResultadosAutomatico(roomId, io) {
    const game = activeGames.get(roomId);
    if (!game) return;

    if (!(await claimRevealLock(roomId))) {
        return;
    }

    // Llamar a la función centralizada de revelación con timeExpired=true
    await revealAnswer({
        roomId,
        game,
        io,
        timeExpired: true
    });

    await resetStreaksOfNonAnswering(roomId, game);

    // Si es la última pregunta, NO terminar automáticamente aquí
    // El juego terminará cuando todos respondan (via checkAllPlayersAnswered)
    // o cuando se llame manualmente desde el presentador
    if (isLastQuestion(game)) {
        logger.debug(`Última pregunta - esperando a que todos respondan para finalizar`);
        // No llamar endGameAutomatically aquí
        return;
    }
}

module.exports = {
    startTimer,
    clearTimer,
    revelarResultadosAutomatico,
    resetStreaksOfNonAnswering
};
