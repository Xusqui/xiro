/**
 * @fileoverview Socket.IO handlers - Versión refactorizada
 * Toda la lógica extraída a módulos especializados
 */

const {
    players,
    socketToPlayer,
    activeGames,
    lobbyPlayers,
    teamConfigs,
    socketRateLimits,
    roomPresenterMap,
    timerPausedState,
    clearGameTimer,
    gameTimers
} = require('../state/globalState');

const metrics = require('../state/metrics');
const timerManager = require('../services/timer.manager');
const { TIMEOUTS, CLEANUP_INTERVAL } = require('../config/game-constants');
const logger = require('../config/logger');

// 🧹 REFACTORING: Módulos extraídos
const { RedisSyncBus } = require('./sync/RedisSyncBus');
const { cleanupInactiveGames, cleanupEmptyLobbies, checkExpiredPlayers } = require('./utils/GameUtils');
const { createSocketRoleMiddleware } = require('./utils/SocketRoleMiddleware');
const HeartbeatService = require('../domain/services/HeartbeatService');
const ReconnectionManager = require('../domain/services/ReconnectionManager');
const { getWorkerContext } = require('../config/log-context');
const {
    createJoinLobbyHandler,
    createJoinPresenterLobbyHandler,
    createStartGameHandler,
    createDisconnectHandler,
    createSubmitAnswerHandler,
    createPauseTimerHandler,
    createResumeTimerHandler,
    createSelectTeamHandler,
    createReconnectPlayerHandler,
    createReconnectPresenterHandler,
    createGetCurrentStateHandler,
    createNextQuestionHandler,
    createRevealAnswerHandler,
    createManualPointsHandler,
    createLeaveLobbyHandler,
    createEndGameHandler,
    createAbandonGameHandler,
    createValidateSessionHandler,
    createErrorHandler
} = require('./handlers');

const syncBus = RedisSyncBus.getInstance();
let io = null;
const GLOBAL_ROOM = 'partida_global';

// Servicios de conexión
const heartbeatService = new HeartbeatService();
const reconnectionManager = new ReconnectionManager();

// Control remoto admin
const { createJoinRemotePresenterHandler, removeRemotePresenter } = require('./utils/RemoteControlHelper');

// Servicios de broadcast y notificaciones (WEEK 18)
const TrivialSocketHandler = require('./handlers/TrivialSocketHandler');
const AnswerBatchService = require('./services/AnswerBatchService');
const PresenterNotificationService = require('./services/PresenterNotificationService');
let answerBatchService = null;
let presenterNotificationService = null;

async function initSyncBus() {
    await syncBus.initialize(io, { lobbyPlayers, activeGames, teamConfigs, players });
}

function injectIO(ioInstance) {
    io = ioInstance;
}

/**
 * Cleanup de rate limits
 */
function cleanupRateLimits() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [socketId, data] of socketRateLimits.entries()) {
        if (now > data.resetTime + TIMEOUTS.RATE_LIMIT_CLEANUP) {
            socketRateLimits.delete(socketId);
            cleanedCount++;
        }
    }

    if (socketRateLimits.size > 5000) {
        const toDelete = socketRateLimits.size - 5000;
        let deleted = 0;
        for (const [socketId] of socketRateLimits.entries()) {
            if (deleted >= toDelete) break;
            socketRateLimits.delete(socketId);
            deleted++;
        }
        const logger = require('../config/logger');
        logger.warn('Forced rate limit cleanup', { deleted, threshold: 5000 });
    }

    if (cleanedCount > 0) {
        const logger = require('../config/logger');
        logger.debug('Rate limit cleanup', { cleaned: cleanedCount, remaining: socketRateLimits.size });
    }
}

function initializeBroadcastServices() {
    answerBatchService = new AnswerBatchService(io);
    presenterNotificationService = new PresenterNotificationService(io, answerBatchService);
}

function setupCleanupIntervals() {
    timerManager.setInterval(cleanupInactiveGames, 3600000, 'cleanup-inactive-games');
    timerManager.setInterval(cleanupEmptyLobbies, TIMEOUTS.CLEANUP_EMPTY_LOBBIES, 'cleanup-empty-lobbies');
    timerManager.setInterval(() => {
        checkExpiredPlayers(io).catch((error) => {
            logger.error('cleanup-expired-players failed', { error: error.message });
        });
    }, CLEANUP_INTERVAL, 'cleanup-expired-players');
    timerManager.setInterval(cleanupRateLimits, 300000, 'cleanup-rate-limits');
}

function createSocketDependencies(ackManager) {
    return {
        players,
        socketToPlayer,
        activeGames,
        lobbyPlayers,
        teamConfigs,
        socketRateLimits,
        roomPresenterMap,
        timerPausedState,
        clearGameTimer,
        gameTimers,
        metrics,
        syncBus,
        presenterNotification: presenterNotificationService,
        heartbeatService,
        reconnectionManager,
        io,
        ackManager
    };
}

function createHandlerSet(dependencies) {
    return {
        handleJoinLobby: createJoinLobbyHandler(dependencies),
        handleJoinPresenterLobby: createJoinPresenterLobbyHandler(dependencies),
        handleStartGame: createStartGameHandler(dependencies),
        handleDisconnect: createDisconnectHandler(dependencies),
        handleSubmitAnswer: createSubmitAnswerHandler(dependencies),
        handlePauseTimer: createPauseTimerHandler(dependencies),
        handleResumeTimer: createResumeTimerHandler(dependencies),
        handleSelectTeam: createSelectTeamHandler(dependencies),
        handleReconnectPlayer: createReconnectPlayerHandler(dependencies),
        handleReconnectPresenter: createReconnectPresenterHandler(dependencies),
        handleValidateSession: createValidateSessionHandler(dependencies),
        handleGetCurrentState: createGetCurrentStateHandler(dependencies),
        handleNextQuestion: createNextQuestionHandler(dependencies),
        handleRevealAnswer: createRevealAnswerHandler(dependencies),
        handleManualPoints: createManualPointsHandler(dependencies),
        handleLeaveLobby: createLeaveLobbyHandler(dependencies),
        handleEndGame: createEndGameHandler(dependencies),
        handleAbandonGame: createAbandonGameHandler(dependencies),
        handleError: createErrorHandler(dependencies),
        handleJoinRemotePresenter: createJoinRemotePresenterHandler({ activeGames, lobbyPlayers, teamConfigs }),
        trivialHandler: TrivialSocketHandler({ io, lobbyPlayers })
    };
}

function assertIsPresenter(socket, roomIdOrPin, errorEvent) {
    const roomId = String(roomIdOrPin);
    if (socket.rooms.has(roomId + ':presenter')) {
        return true;
    }

    logger.warn('Presenter-only event rejected: socket not in presenter room', {
        socketId: socket.id,
        roomId,
        event: errorEvent,
        role: socket.data.role
    });

    socket.emit(errorEvent, { message: 'No autorizado: se requiere rol de presentador.', code: 'PRESENTER_ROLE_REQUIRED' });
    return false;
}

function resolveRoomId(data, keys = []) {
    for (const key of keys) {
        if (data?.[key]) {
            return String(data[key]);
        }
    }
    return String(data);
}

function registerGeneralSocketEvents(socket, handlers) {
    socket.on('validate-session', (data) => handlers.handleValidateSession(socket, data));
    socket.on('join-lobby', (data) => handlers.handleJoinLobby(socket, data));
    socket.on('join-presenter-lobby', (data) => handlers.handleJoinPresenterLobby(socket, data));
    socket.on('submit-answer', (data, callback) => handlers.handleSubmitAnswer(socket, data, callback));
    socket.on('select-team', (data) => handlers.handleSelectTeam(socket, data));
    socket.on('reconnect-player', (data) => handlers.handleReconnectPlayer(socket, data));
    socket.on('reconnect-presenter', (data) => handlers.handleReconnectPresenter(socket, data));
    socket.on('get-current-state', (data) => handlers.handleGetCurrentState(socket, data));
    socket.on('leave-lobby', (data) => handlers.handleLeaveLobby(socket, data));
    socket.on('join-remote-presenter', (data) => handlers.handleJoinRemotePresenter(socket, data));
}

function registerPresenterSocketEvents(socket, handlers) {
    socket.on('start-game', (roomIdOrPin) => {
        if (assertIsPresenter(socket, roomIdOrPin, 'start-game-error')) {
            handlers.handleStartGame(socket, roomIdOrPin);
        }
    });

    socket.on('pause-timer', (roomIdOrPin) => {
        if (assertIsPresenter(socket, roomIdOrPin, 'pause-timer-error')) {
            handlers.handlePauseTimer(socket, roomIdOrPin);
        }
    });

    socket.on('resume-timer', (roomIdOrPin) => {
        if (assertIsPresenter(socket, roomIdOrPin, 'resume-timer-error')) {
            handlers.handleResumeTimer(socket, roomIdOrPin);
        }
    });

    socket.on('next-question', async (roomIdOrPin) => {
        if (!assertIsPresenter(socket, roomIdOrPin, 'next-question-error')) {
            return;
        }

        const roomId = String(roomIdOrPin);
        const game = activeGames.get(roomId);
        if (game?.isTrivial) {
            await handlers.trivialHandler.handleNextTurn(roomId);
            return;
        }

        handlers.handleNextQuestion(socket, roomIdOrPin);
    });

    socket.on('reveal-answer', async (roomIdOrPin) => {
        if (!assertIsPresenter(socket, roomIdOrPin, 'reveal-answer-error')) {
            return;
        }

        await handlers.handleRevealAnswer(socket, roomIdOrPin);
        const roomId = String(roomIdOrPin);
        const game = activeGames.get(roomId);
        await handlers.trivialHandler.handlePostReveal(roomId, game);
    });

    socket.on('manual-points', (data) => {
        const roomId = resolveRoomId(data, ['roomId', 'sessionId', 'pin']);
        if (assertIsPresenter(socket, roomId, 'manual-points-error')) {
            handlers.handleManualPoints(socket, data);
        }
    });

    socket.on('end-game', (data) => {
        const roomId = resolveRoomId(data, ['roomId', 'roomIdOrPin', 'pin']);
        if (assertIsPresenter(socket, roomId, 'end-game-error')) {
            handlers.handleEndGame(socket, data);
        }
    });

    socket.on('abandon-game', (data) => {
        const roomId = resolveRoomId(data, ['roomId', 'roomIdOrPin', 'pin']);
        if (assertIsPresenter(socket, roomId, 'abandon-game-error')) {
            handlers.handleAbandonGame(socket, data);
        }
    });
}

function registerTrivialSocketEvents(socket, handlers) {
    socket.on('trivial-start', (data) => handlers.trivialHandler.handleStart(socket, data));
    socket.on('trivial-roll-dice', (data) => handlers.trivialHandler.handleRollDice(socket, data));
    socket.on('trivial-move', (data) => handlers.trivialHandler.handleMove(socket, data));
    socket.on('trivial-category-chosen', (data) => handlers.trivialHandler.handleCategoryChosen(socket, data));
    socket.on('trivial-end-game', (data) => {
        const roomId = resolveRoomId(data, ['roomId', 'sessionId', 'pin']);
        if (assertIsPresenter(socket, roomId, 'trivial-error')) {
            handlers.trivialHandler.handleEndGame(socket, data);
        }
    });
}

function registerDisconnectAndErrorEvents(socket, handlers, ackManager) {
    socket.on('disconnect', (reason) => {
        if (ackManager && typeof ackManager.cleanupSocket === 'function') {
            ackManager.cleanupSocket(socket.id);
        }

        if (socket.data.isRemote && socket.data.roomId) {
            removeRemotePresenter(socket.data.roomId, socket.id);
        }

        handlers.handleDisconnect(socket, reason);
    });

    socket.on('error', (error) => handlers.handleError(socket, error));
}

function onSocketConnection(socket, handlers, ackManager) {
    socket.join(GLOBAL_ROOM);
    logger.info('Connection joined global room', {
        socketId: socket.id,
        role: socket.data.role,
        pid: process.pid,
        room: GLOBAL_ROOM
    });

    heartbeatService.startMonitoring(socket);
    metrics.incrementPlayers();

    registerGeneralSocketEvents(socket, handlers);
    registerPresenterSocketEvents(socket, handlers);
    registerTrivialSocketEvents(socket, handlers);
    registerDisconnectAndErrorEvents(socket, handlers, ackManager);
}

function logConfiguredSocketHandlers() {
    logger.info('Socket handlers configured', {
        handlers: [
            'validate-session', 'join-lobby', 'start-game', 'submit-answer',
            'join-presenter-lobby',
            'pause-timer', 'resume-timer', 'select-team',
            'reconnect-player', 'reconnect-presenter', 'get-current-state',
            'next-question', 'reveal-answer', 'manual-points', 'end-game', 'leave-lobby',
            'disconnect', 'error'
        ],
        ...getWorkerContext()
    });
}

/**
 * Configura todos los manejadores de eventos de Socket.io
 * @param {Server} ioInstance - Instancia de Socket.io
 * @param {AckManager} ackManager - Gestor de ACKs para mensajes críticos
 */
function setupSocketHandlers(ioInstance, ackManager = null) {
    injectIO(ioInstance);
    void initSyncBus();

    initializeBroadcastServices();
    io.use(createSocketRoleMiddleware());

    setupCleanupIntervals();

    const dependencies = createSocketDependencies(ackManager);
    const handlers = createHandlerSet(dependencies);

    io.on('connection', (socket) => onSocketConnection(socket, handlers, ackManager));

    logConfiguredSocketHandlers();
}

module.exports = {
    setupSocketHandlers,
    injectIO
};
