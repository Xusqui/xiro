/**
 * @fileoverview Redis Pub/Sub para sincronización cross-worker
 * @module sockets/sync/RedisSyncBus
 */

const { createClient } = require('redis');
const logger = require('../../config/logger');
const { addPlayerToLobby } = require('../utils/LobbyPlayerSync');
const { getWorkerContext } = require('../../config/log-context');
const { SCORING } = require('../../config/game-constants');
const { clearGameTimer, timerPausedState, roomPresenterMap } = require('../../state/globalState');
const runtimeConfig = require('../../config/runtime-config');

const DEFAULT_DOUBLE_STREAK_BONUS_PERCENTAGE = 1.00;

function firstDefined(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
}

function parseRedisMessage(message, channel) {
    try {
        return JSON.parse(message);
    } catch (error) {
        logger.warn('RedisSyncBus recibió mensaje JSON inválido', { channel, error: error.message });
        return null;
    }
}

function toSetOrEmpty(value) {
    if (value instanceof Set) {
        return value;
    }

    if (Array.isArray(value)) {
        return new Set(value);
    }

    return new Set();
}

function buildSyncedGameState(roomId, gameState, existing) {
    const gameStartTime = firstDefined(gameState.gameStartTime, gameState.startTime, Date.now());
    const questionStartTime = firstDefined(
        gameState.questionStartTime,
        gameState.gameStartTime,
        gameState.startTime,
        Date.now()
    );

    return {
        pin: gameState.pin,
        roomId: firstDefined(gameState.roomId, roomId),
        // Lo usa el autoguardado de la sesión (game_type), que puede ejecutarse en cualquier worker
        gameType: firstDefined(gameState.gameType, existing?.gameType, null),
        questions: firstDefined(gameState.questions, []),
        currentIndex: firstDefined(gameState.currentIndex, 0),
        scores: firstDefined(gameState.scores, {}),
        players: firstDefined(gameState.players, []),
        answerStats: firstDefined(gameState.answerStats, {}),
        isTrivial: firstDefined(gameState.isTrivial, false),
        playerAnswers: {},
        teamMode: firstDefined(gameState.teamMode, false),
        trivialMeta: firstDefined(gameState.trivialMeta, null),
        // Lo usa playerAnswerArchive para la columna "Categoría" del CSV de Trivial
        trivialCategoryName: gameState.trivialCategoryName ?? null,
        trivialLastCorrect: firstDefined(existing?.trivialLastCorrect, null),
        trivialQuestionEpoch: firstDefined(gameState.trivialQuestionEpoch, 0),
        canAnswer: firstDefined(gameState.canAnswer, true),
        revealedQuestions: new Set(),
        gameStartTime,
        questionStartTime,
        playerStreaks: firstDefined(gameState.playerStreaks, existing?.playerStreaks, {}),
        playerStreakInfos: firstDefined(gameState.playerStreakInfos, existing?.playerStreakInfos, {}),
        answeredCurrent: new Set(),
        use_streaks: firstDefined(gameState.use_streaks, existing?.use_streaks, false),
        streak_threshold: firstDefined(
            gameState.streak_threshold,
            existing?.streak_threshold,
            SCORING.STREAK.DEFAULT_THRESHOLD
        ),
        streak_bonus_percentage: firstDefined(
            gameState.streak_bonus_percentage,
            existing?.streak_bonus_percentage,
            SCORING.STREAK.DEFAULT_BONUS_PERCENTAGE
        ),
        use_double_streaks: firstDefined(gameState.use_double_streaks, existing?.use_double_streaks, false),
        double_streak_threshold: firstDefined(
            gameState.double_streak_threshold,
            existing?.double_streak_threshold,
            SCORING.STREAK.DEFAULT_DOUBLE_THRESHOLD
        ),
        double_streak_bonus_percentage: firstDefined(
            gameState.double_streak_bonus_percentage,
            existing?.double_streak_bonus_percentage,
            DEFAULT_DOUBLE_STREAK_BONUS_PERCENTAGE
        ),
        use_random_points: firstDefined(gameState.use_random_points, existing?.use_random_points, false),
        random_points_min: firstDefined(
            gameState.random_points_min,
            existing?.random_points_min,
            SCORING.RANDOM_POINTS.DEFAULT_MIN
        ),
        random_points_max: firstDefined(
            gameState.random_points_max,
            existing?.random_points_max,
            SCORING.RANDOM_POINTS.DEFAULT_MAX
        ),
        currentRandomPoints: firstDefined(gameState.currentRandomPoints, existing?.currentRandomPoints, null),
        _epoch: firstDefined(gameState._epoch, 1)
    };
}

function buildLightGameState(roomId, gameState) {
    const gameStartTime = firstDefined(gameState.gameStartTime, gameState.startTime, Date.now());
    const questionStartTime = firstDefined(
        gameState.questionStartTime,
        gameState.gameStartTime,
        gameState.startTime,
        Date.now()
    );

    return {
        pin: gameState.pin,
        roomId,
        gameType: gameState.gameType ?? null,
        questions: gameState.questions,
        currentIndex: gameState.currentIndex,
        scores: gameState.scores,
        players: gameState.players,
        answerStats: gameState.answerStats,
        isTrivial: firstDefined(gameState.isTrivial, false),
        teamMode: firstDefined(gameState.teamMode, false),
        canAnswer: firstDefined(gameState.canAnswer, false),
        trivialMeta: firstDefined(gameState.trivialMeta, null),
        trivialCategoryName: gameState.trivialCategoryName ?? null,
        trivialQuestionEpoch: firstDefined(gameState.trivialQuestionEpoch, 0),
        playerStreaks: firstDefined(gameState.playerStreaks, {}),
        playerStreakInfos: firstDefined(gameState.playerStreakInfos, {}),
        use_streaks: firstDefined(gameState.use_streaks, false),
        streak_threshold: firstDefined(gameState.streak_threshold, SCORING.STREAK.DEFAULT_THRESHOLD),
        streak_bonus_percentage: firstDefined(
            gameState.streak_bonus_percentage,
            SCORING.STREAK.DEFAULT_BONUS_PERCENTAGE
        ),
        use_double_streaks: firstDefined(gameState.use_double_streaks, false),
        double_streak_threshold: firstDefined(
            gameState.double_streak_threshold,
            SCORING.STREAK.DEFAULT_DOUBLE_THRESHOLD
        ),
        double_streak_bonus_percentage: firstDefined(
            gameState.double_streak_bonus_percentage,
            DEFAULT_DOUBLE_STREAK_BONUS_PERCENTAGE
        ),
        use_random_points: firstDefined(gameState.use_random_points, false),
        random_points_min: firstDefined(gameState.random_points_min, SCORING.RANDOM_POINTS.DEFAULT_MIN),
        random_points_max: firstDefined(gameState.random_points_max, SCORING.RANDOM_POINTS.DEFAULT_MAX),
        currentRandomPoints: firstDefined(gameState.currentRandomPoints, null),
        gameStartTime,
        questionStartTime,
        _epoch: 1
    };
}

class RedisSyncBus {
    constructor() {
        this.syncPub = null;
        this.syncSub = null;
        this.syncReady = null;
        this.syncAvailable = false;
        this.io = null;
        this.state = null;
    }

    static getInstance() {
        if (!RedisSyncBus._instance) {
            RedisSyncBus._instance = new RedisSyncBus();
        }
        return RedisSyncBus._instance;
    }

    /**
     * Inicializa Redis y suscripciones
     * @param {object} io - Socket.IO instance
     * @param {object} state - Global state { lobbyPlayers, activeGames, teamConfigs, players }
     */
    initialize(io, state = {}) {
        if (this.syncReady) return this.syncReady;

        this.io = io;
        this.state = state;

        const INIT_TIMEOUT_MS = 15000; // 15 s máx para conectar a Redis
        const connectPromise = (async () => {
            const url = process.env.REDIS_URL || 'redis://redis:6379';
            this.syncPub = createClient({ url, password: process.env.REDIS_PASSWORD || undefined });
            this.syncSub = this.syncPub.duplicate();

            this.syncPub.on('error', (err) => logger.error('syncPub redis error', err));
            this.syncSub.on('error', (err) => logger.error('syncSub redis error', err));

            await Promise.all([this.syncPub.connect(), this.syncSub.connect()]);

            // Setup subscriptions
            await this.setupSubscriptions();
            this.syncAvailable = true;
        })();

        let initTimer;
        const timeoutPromise = new Promise((_, reject) => {
            initTimer = setTimeout(() => reject(new Error('RedisSyncBus init timed out after ' + INIT_TIMEOUT_MS + 'ms')), INIT_TIMEOUT_MS);
        });

        this.syncReady = Promise.race([connectPromise, timeoutPromise]).catch((err) => {
            logger.error('RedisSyncBus initialization failed — cross-worker sync unavailable', { error: err.message });
            // No re-lanzar: las operaciones que llamen await this.syncReady continuarán
            // sin pub/sub (degraded mode). El fallo ya fue logueado.
        }).finally(() => {
            // Promise.race no cancela al perdedor: sin esto el temporizador seguía vivo 15 s
            clearTimeout(initTimer);
        });

        return this.syncReady;
    }

    async setupSubscriptions() {
        await this.registerLobbySubscriptions();
        await this.registerGameSubscriptions();
        await this.registerSessionAndPlayerSubscriptions();
        await this.registerRevealSubscriptions();
        await this.registerStreakTimerAndConfigSubscriptions();

        logger.info('✅ RedisSyncBus subscriptions initialized', getWorkerContext());
    }

    async registerLobbySubscriptions() {
        await this.syncSub.subscribe('lobby-created', (roomId) => {
            const { lobbyPlayers } = this.state;
            if (!lobbyPlayers.has(roomId)) {
                lobbyPlayers.set(roomId, []);
            }
        });

        await this.syncSub.subscribe('lobby-player-joined', (message) => {
            this.handleLobbyPlayerJoined(message);
        });

        await this.syncSub.subscribe('lobby-player-left', (message) => {
            this.handleLobbyPlayerLeft(message);
        });
    }

    async registerGameSubscriptions() {
        await this.syncSub.subscribe('game-started', (message) => {
            this.handleGameStartedSync(message);
        });

        await this.syncSub.subscribe('game-state-updated', (message) => {
            this.handleGameStateUpdatedSync(message);
        });

        await this.syncSub.subscribe('next-question-sync', (message) => {
            this.handleNextQuestionSync(message);
        });

        await this.syncSub.subscribe('team-config-sync', (message) => {
            const data = parseRedisMessage(message, 'team-config-sync');
            if (!data) {
                return;
            }
            this.state.teamConfigs.set(data.roomId, data.teamConfig);
        });
    }

    async registerSessionAndPlayerSubscriptions() {
        await this.syncSub.subscribe('session-abandoned', (message) => {
            this.handleSessionAbandonedSync(message);
        });

        await this.syncSub.subscribe('player-data-sync', (message) => {
            this.handlePlayerDataSync(message);
        });

        await this.syncSub.subscribe('player-answered-sync', (_message) => {
            // Redis adapter auto-propagates io.to(room).emit().
        });

        await this.syncSub.subscribe('player-disconnected-sync', (message) => {
            this.handlePlayerDisconnectedSync(message);
        });
    }

    async registerRevealSubscriptions() {
        await this.syncSub.subscribe('reveal-answer-sync', (message) => {
            const data = parseRedisMessage(message, 'reveal-answer-sync');
            if (!data) {
                return;
            }

            this.io.to(data.roomId + ':presenter').emit('reveal-answer', data.presenterPayload);
            this.io.to(data.roomId + ':players').emit('reveal-answer', data.playerPayload);
        });

        await this.syncSub.subscribe('question-revealed', (message) => {
            this.handleQuestionRevealedSync(message);
        });
    }

    async registerStreakTimerAndConfigSubscriptions() {
        await this.syncSub.subscribe('streak-reset-sync', (message) => {
            this.handleStreakResetSync(message);
        });

        await this.syncSub.subscribe('streak-restored-sync', (message) => {
            this.handleStreakRestoredSync(message);
        });

        await this.syncSub.subscribe('timer-paused-sync', (message) => {
            this.handleTimerPausedSync(message);
        });

        await this.syncSub.subscribe('timer-resumed-sync', (message) => {
            this.handleTimerResumedSync(message);
        });

        await this.syncSub.subscribe('config-updated', (message) => {
            this.handleConfigUpdatedSync(message);
        });
    }

    handleLobbyPlayerJoined(message) {
        const data = parseRedisMessage(message, 'lobby-player-joined');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const added = addPlayerToLobby(this.state.lobbyPlayers, data.roomId, data.nickname);
        if (added) {
            logger.debug(`Jugador ${data.nickname} añadido al lobby ${data.roomId} (desde worker ${data.originWorkerId})`);
        }
    }

    handleLobbyPlayerLeft(message) {
        const data = parseRedisMessage(message, 'lobby-player-left');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const lobby = this.state.lobbyPlayers.get(data.roomId);
        if (!lobby) {
            return;
        }

        const idx = lobby.indexOf(data.nickname);
        if (idx === -1) {
            return;
        }

        lobby.splice(idx, 1);
        logger.debug(`Jugador ${data.nickname} eliminado del lobby ${data.roomId} (desde worker ${data.originWorkerId})`);
    }

    handleGameStartedSync(message) {
        const data = parseRedisMessage(message, 'game-started');
        if (!data) {
            return;
        }

        const { roomId, gameState = {} } = data;
        const existing = this.state.activeGames.get(roomId);
        if (existing && !gameState.isTrivial) {
            return;
        }

        this.state.activeGames.set(roomId, buildSyncedGameState(roomId, gameState, existing));
    }

    handleGameStateUpdatedSync(message) {
        const data = parseRedisMessage(message, 'game-state-updated');
        if (!data) {
            return;
        }

        const { roomId, nickname, score, currentIndex, originWorkerId, _epoch: incomingEpoch } = data;
        const game = this.state.activeGames.get(roomId);
        if (!game) {
            logger.debug(`Redis sync para juego inexistente: worker=${process.pid}, room=${roomId}`);
            return;
        }

        const localEpoch = game._epoch || 0;
        if (incomingEpoch !== undefined && incomingEpoch < localEpoch) {
            logger.debug(`Redis sync ignorado (stale epoch): incoming=${incomingEpoch} < local=${localEpoch}, room=${roomId}`);
            return;
        }

        if (incomingEpoch !== undefined) {
            game._epoch = incomingEpoch;
        }

        const debugEnabled = typeof logger.isDebugEnabled !== 'function' || logger.isDebugEnabled();
        let scoresBefore = '';
        if (debugEnabled) {
            scoresBefore = JSON.stringify(game.scores);
        }
        const oldScore = game.scores[nickname] || 0;
        if (nickname && score !== undefined) {
            game.scores[nickname] = score;
        }
        game.currentIndex = currentIndex;

        if (debugEnabled) {
            logger.debug(`Redis sync recibido: worker=${process.pid}, origin=${originWorkerId}, room=${roomId}, player=${nickname}, oldScore=${oldScore}, newScore=${score}, epoch=${incomingEpoch}, allScoresBefore=${scoresBefore}, allScoresAfter=${JSON.stringify(game.scores)}`);
        }
    }

    handleNextQuestionSync(message) {
        const data = parseRedisMessage(message, 'next-question-sync');
        if (!data) {
            return;
        }

        const { roomId, currentIndex, startTime, randomPoints, _epoch: incomingEpoch } = data;
        const game = this.state.activeGames.get(roomId);
        if (!game) {
            return;
        }

        const localEpoch = game._epoch || 0;
        if (incomingEpoch !== undefined && incomingEpoch >= localEpoch) {
            game._epoch = incomingEpoch;
        }

        game.currentIndex = currentIndex;
        game.questionStartTime = startTime || Date.now();
        game.answerStats = {};
        game.canAnswer = true;
        // Valor sorteado de la puntuación aleatoria: se genera una sola vez en el
        // worker que avanza la pregunta y viaja aquí para que cualquier worker
        // que procese una respuesta use el MISMO valor.
        game.currentRandomPoints = randomPoints ?? null;
    }

    handleSessionAbandonedSync(message) {
        const data = parseRedisMessage(message, 'session-abandoned');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const { roomId } = data;
        const { activeGames, lobbyPlayers, teamConfigs, players } = this.state;
        activeGames.delete(roomId);
        lobbyPlayers.delete(roomId);
        teamConfigs.delete(roomId);
        roomPresenterMap.delete(roomId);

        for (const [playerId, player] of players.entries()) {
            if (player.roomId === roomId) {
                players.delete(playerId);
            }
        }

        try {
            clearGameTimer(roomId);
            if (timerPausedState) {
                timerPausedState.delete(roomId);
            }
        } catch (err) {
            logger.warn('Failed to clear timers for abandoned session', { roomId, error: err.message });
        }
    }

    handlePlayerDataSync(message) {
        const data = parseRedisMessage(message, 'player-data-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const { playerId, playerData, originWorkerId } = data;
        const normalizedPlayer = { ...playerData, answeredQuestions: toSetOrEmpty(playerData.answeredQuestions) };

        const existing = this.state.players.get(playerId);
        if (!existing || (normalizedPlayer.lastSeen && normalizedPlayer.lastSeen >= (existing.lastSeen || 0))) {
            this.state.players.set(playerId, normalizedPlayer);
            logger.debug(`Player data synced: ${normalizedPlayer.nickname} (playerId: ${playerId}, from worker ${originWorkerId})`);
        }
    }

    handlePlayerDisconnectedSync(message) {
        const data = parseRedisMessage(message, 'player-disconnected-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const { playerId, playerData, originWorkerId } = data;
        const existingPlayer = this.state.players.get(playerId);
        const canOverwrite = !existingPlayer ||
            (existingPlayer.status !== 'disconnected' && existingPlayer.status !== 'presenter_disconnected');

        if (!canOverwrite) {
            return;
        }

        const normalizedPlayer = { ...playerData, answeredQuestions: toSetOrEmpty(playerData.answeredQuestions) };
        const mergedPlayer = existingPlayer
            ? { ...existingPlayer, ...normalizedPlayer }
            : normalizedPlayer;

        this.state.players.set(playerId, mergedPlayer);
        logger.debug(`${mergedPlayer.nickname} marcado como ${mergedPlayer.status} (playerId: ${playerId}, desde worker ${originWorkerId})`);
    }

    handleQuestionRevealedSync(message) {
        const data = parseRedisMessage(message, 'question-revealed');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        const { roomId, questionIndex, trigger, allowLateAnswers = false } = data;
        const game = this.state.activeGames.get(roomId);

        if (game) {
            if (!game.revealedQuestions || typeof game.revealedQuestions !== 'object') {
                game.revealedQuestions = {};
            }

            game.revealedQuestions[questionIndex] = {
                trigger: trigger || 'sync',
                revealedAt: Date.now()
            };
            game.canAnswer = Boolean(allowLateAnswers);

            if (data.presenterPayload) {
                game.revealPayloads = game.revealPayloads || {};
                game.revealPayloads[questionIndex] = data.presenterPayload;
            }
        }

        try {
            clearGameTimer(roomId);
        } catch (err) {
            logger.warn('Failed to clear timer after question-revealed sync', {
                roomId,
                questionIndex,
                error: err.message
            });
        }
    }

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
    }

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
    }

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
    }

    handleTimerResumedSync(message) {
        const data = parseRedisMessage(message, 'timer-resumed-sync');
        if (!data || data.originWorkerId === process.pid) {
            return;
        }

        logger.debug('Timer resumed notification received', {
            roomId: data.roomId,
            originWorkerId: data.originWorkerId
        });
    }

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

    async publish(channel, data) {
        await this.syncReady;
        // Modo degradado (Redis no conectó o aún no se inicializó): sin pub/sub,
        // cada worker sigue con su estado local en lugar de fallar.
        if (!this.syncAvailable) {
            logger.debug('RedisSyncBus sin conexión: publicación omitida', { channel });
            return;
        }
        await this.syncPub.publish(channel, typeof data === 'string' ? data : JSON.stringify(data));
    }

    async subscribe(channel, handler) {
        await this.syncReady;
        if (!this.syncAvailable) {
            logger.debug('RedisSyncBus sin conexión: suscripción omitida', { channel });
            return;
        }
        await this.syncSub.subscribe(channel, handler);
    }

    // Domain-specific methods
    async publishGameStarted(roomId, gameState) {
        // Set initial epoch on the origin worker's game object
        const localGame = this.state?.activeGames?.get(roomId);
        if (localGame) {
            localGame._epoch = 1;
        }

        const lightGameState = buildLightGameState(roomId, gameState);
        await this.publish('game-started', { roomId, gameState: lightGameState, originWorkerId: process.pid });
        logger.debug(`game-started publicado: ${roomId} (worker ${process.pid})`);
    }

    async publishGameStateUpdate(roomId, nickname, score, currentIndex) {
        const localGame = this.state?.activeGames?.get(roomId);
        const epoch = localGame?._epoch;
        logger.debug(`Publicando delta: worker=${process.pid}, room=${roomId}, player=${nickname}, score=${score}, index=${currentIndex}, epoch=${epoch}`);
        await this.publish('game-state-updated', { roomId, nickname, score, currentIndex, originWorkerId: process.pid, _epoch: epoch });
        logger.debug(`Delta publicado exitosamente: ${roomId} - ${nickname}: ${score} pts (worker ${process.pid})`);
    }

    async publishNextQuestion(roomId, currentIndex, startTime, randomPoints = null) {
        // Increment epoch on origin worker for each question transition
        const localGame = this.state?.activeGames?.get(roomId);
        if (localGame) {
            localGame._epoch = (localGame._epoch || 0) + 1;
        }
        const epoch = localGame?._epoch;
        await this.publish('next-question-sync', { roomId, currentIndex, startTime, randomPoints, originWorkerId: process.pid, _epoch: epoch });
        logger.debug(`next-question-sync publicado: ${roomId} pregunta ${currentIndex + 1} epoch=${epoch} (worker ${process.pid})`);
    }

    async publishTeamConfig(roomId, teamConfig) {
        await this.publish('team-config-sync', { roomId, teamConfig, originWorkerId: process.pid });
        logger.debug(`team-config-sync publicado: ${roomId} (worker ${process.pid})`);
    }

    async publishSessionAbandoned(roomId, reason = 'abandoned') {
        await this.publish('session-abandoned', { roomId, reason, originWorkerId: process.pid });
        logger.debug(`session-abandoned publicado: ${roomId} (worker ${process.pid})`);
    }

    async publishPlayerAnswered(roomId, nickname, correct) {
        await this.publish('player-answered-sync', { roomId, nickname, correct, originWorkerId: process.pid });
    }

    async publishRevealAnswer(roomId, presenterPayload, playerPayload) {
        await this.publish('reveal-answer-sync', { roomId, presenterPayload, playerPayload, originWorkerId: process.pid });
    }

    async publishQuestionRevealed(roomId, questionIndex, metadata = {}) {
        await this.publish('question-revealed', {
            roomId,
            questionIndex,
            ...metadata,
            originWorkerId: process.pid
        });
    }

    async publishLobbyPlayerJoined(roomId, nickname) {
        await this.publish('lobby-player-joined', { roomId, nickname, originWorkerId: process.pid });
        logger.debug(`lobby-player-joined publicado: ${roomId} - ${nickname} (worker ${process.pid})`);
    }

    async publishLobbyPlayerLeft(roomId, nickname) {
        await this.publish('lobby-player-left', { roomId, nickname, originWorkerId: process.pid });
        logger.debug(`lobby-player-left publicado: ${roomId} - ${nickname} (worker ${process.pid})`);
    }

    async publishStreakReset(roomId, nicknames) {
        await this.publish('streak-reset-sync', { roomId, nicknames, originWorkerId: process.pid });
    }

    async publishStreakRestored(roomId, nickname, streak, streakInfo) {
        await this.publish('streak-restored-sync', { roomId, nickname, streak, streakInfo, originWorkerId: process.pid });
        logger.debug(`streak-restored-sync publicado: ${roomId} - ${nickname} streak=${streak} (worker ${process.pid})`);
    }

    async publishTimerPaused(roomId) {
        await this.publish('timer-paused-sync', { roomId, originWorkerId: process.pid });
        logger.debug(`timer-paused-sync publicado: ${roomId} (worker ${process.pid})`);
    }

    async publishTimerResumed(roomId) {
        await this.publish('timer-resumed-sync', { roomId, originWorkerId: process.pid });
        logger.debug(`timer-resumed-sync publicado: ${roomId} (worker ${process.pid})`);
    }

    async publishPlayerDisconnected(playerId, playerData) {
        await this.publish('player-disconnected-sync', { playerId, playerData, originWorkerId: process.pid });
        logger.debug(`player-disconnected-sync publicado: ${playerData.nickname} (playerId: ${playerId}, worker ${process.pid})`);
    }

    /**
     * Publish full player data to all workers so cross-worker reconnection works.
     * Called on join-lobby and after a successful reconnect.
     */
    async publishPlayerData(playerId, playerData) {
        await this.publish('player-data-sync', { playerId, playerData, originWorkerId: process.pid });
        logger.debug(`player-data-sync publicado: ${playerData.nickname} (playerId: ${playerId}, worker ${process.pid})`);
    }
}

// Singleton
RedisSyncBus._instance = null;

module.exports = { RedisSyncBus };
