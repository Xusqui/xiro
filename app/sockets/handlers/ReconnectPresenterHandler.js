/**
 * @fileoverview Reconnect Presenter Handler
 */

const { validateSocket, schemas } = require('../../validation');
const ReconnectionService = require('../services/ReconnectionService');
const { validateAdminToken } = require('../utils/RemoteControlHelper');
const logger = require('../../config/logger');

function emitReconnectFailed(socket, payload) {
    socket.emit('reconnect-failed', payload);
}

function buildReconnectFailed(reason, message, extra = {}) {
    return { reason, message, ...extra };
}

function logReconnectRequest(socket, data, players) {
    logger.info('[DIAG] reconnect-presenter received', {
        socketId: socket.id,
        hasData: !!data,
        hasPlayerId: !!(data && data.playerId),
        playerIdPreview: data && data.playerId ? String(data.playerId).slice(0, 8) + '…' : null,
        hasToken: !!(data && data.token),
        tokenLength: data && data.token ? data.token.length : 0,
        playersMapSize: players.size,
        socketAuthPlayerId: socket.handshake?.auth?.playerId || null
    });
}

function validatePayload(data, socket) {
    // Joi da por válido un payload undefined; sin datos tiene que fallar por falta de playerId
    const validation = validateSocket(schemas.reconnectPresenter, data ?? {});
    if (!validation.valid) {
        logger.warn('[DIAG] reconnect-presenter invalid-data', {
            socketId: socket.id,
            error: validation.error,
            dataKeys: data ? Object.keys(data) : null
        });
        emitReconnectFailed(socket, buildReconnectFailed('invalid-data', validation.error, { sessionId: data?.sessionId }));
        return null;
    }

    return validation.value;
}

function validatePanelTokenIfPresent(token, socketId, playerId) {
    if (!token) {
        return;
    }

    const adminUser = validateAdminToken(token);
    if (!adminUser) {
        logger.warn('[DIAG] reconnect-presenter token inválido: continuando sin autenticación de panel', {
            socketId,
            playerId,
            tokenLength: token.length,
            tokenPreview: token.slice(0, 12) + '…'
        });
    }
}

function logPlayerNotFound(playerId, socketId, players) {
    const sampleIds = [];
    let i = 0;
    for (const [pid, player] of players.entries()) {
        if (i++ >= 10) {
            break;
        }
        sampleIds.push({
            idPreview: String(pid).slice(0, 8) + '…',
            nickname: player.nickname,
            role: player.role,
            status: player.status,
            roomId: player.roomId
        });
    }

    logger.warn('[DIAG] reconnect-presenter NOT FOUND in players Map', {
        playerId,
        socketId,
        playersMapSize: players.size,
        sample: sampleIds
    });
}

function logPlayerFound(playerId, player, socketId) {
    logger.info('[DIAG] reconnect-presenter player found', {
        playerId,
        nickname: player.nickname,
        role: player.role,
        status: player.status,
        roomId: player.roomId,
        oldSocketId: player.socketId,
        newSocketId: socketId,
        lastSeen: player.lastSeen ? new Date(player.lastSeen).toISOString() : null,
        expiresAt: player.expiresAt ? new Date(player.expiresAt).toISOString() : null
    });
}

function canPresenterReconnect(reconnectionManager, playerId, socket, sessionId) {
    const canReconnect = reconnectionManager.canReconnect(playerId);
    if (!canReconnect.allowed) {
        emitReconnectFailed(socket, buildReconnectFailed(
            canReconnect.reason,
            canReconnect.message,
            { waitTime: canReconnect.waitTime, sessionId }
        ));
        logger.warn('Presenter reconnection blocked', {
            playerId,
            reason: canReconnect.reason
        });
        return false;
    }
    return true;
}

function validatePresenterState(player, playerId, reconnectionManager, socket, sessionId) {
    if (player.role !== 'presenter') {
        reconnectionManager.recordAttempt(playerId, false);
        emitReconnectFailed(socket, buildReconnectFailed(
            'invalid-role',
            'Este playerId no corresponde a un presentador',
            { sessionId }
        ));
        logger.warn('Presenter reconnection failed - not a presenter', { playerId, role: player.role });
        return false;
    }

    const allowedStates = ['presenter_disconnected', 'presenter_lobby'];
    if (!allowedStates.includes(player.status)) {
        reconnectionManager.recordAttempt(playerId, false);
        logger.warn('[DIAG] reconnect-presenter invalid-state', {
            playerId,
            status: player.status,
            roomId: player.roomId,
            socketId: socket.id,
            oldSocketId: player.socketId
        });
        emitReconnectFailed(socket, buildReconnectFailed(
            'invalid-state',
            'Estado de presentador no válido para reconexión',
            { sessionId }
        ));
        return false;
    }

    return true;
}

async function joinPresenterRooms(socket, roomId) {
    await socket.join(roomId);
    await socket.join(roomId + ':presenter');
}

function configurePresenterSocketData(socket, roomId, nickname, playerId) {
    socket.data.role = 'presenter';
    socket.data.pin = roomId.includes('-') ? roomId.split('-')[0] : roomId;
    socket.data.roomId = roomId;
    socket.data.nickname = nickname;
    socket.data.playerId = playerId;
}

function maybeRestoreRevealState(socket, roomId, game) {
    if (!game) {
        return;
    }

    const questionIndex = game.currentIndex ?? 0;
    if (game.revealedQuestions?.[questionIndex] && game.revealPayloads?.[questionIndex]) {
        logger.debug('Presenter reconnect: re-emitting reveal-answer to restore revealed state', {
            roomId,
            questionIndex
        });
        socket.emit('reveal-answer', game.revealPayloads[questionIndex]);
    }
}

async function runPresenterReconnectFlow({ socket, playerId, sessionId, dependencies }) {
    const { players, socketToPlayer, activeGames, teamConfigs, lobbyPlayers, reconnectionManager, io } = dependencies;
    const player = players.get(playerId);

    if (!player) {
        logPlayerNotFound(playerId, socket.id, players);
        emitReconnectFailed(socket, buildReconnectFailed(
            'not-found',
            'Sesión de presentador no encontrada o expirada.',
            { sessionId }
        ));
        return;
    }

    logPlayerFound(playerId, player, socket.id);

    if (!canPresenterReconnect(reconnectionManager, playerId, socket, sessionId)) {
        return;
    }

    if (!validatePresenterState(player, playerId, reconnectionManager, socket, sessionId)) {
        return;
    }

    const roomId = player.roomId;
    const nickname = player.nickname;
    const game = activeGames.get(roomId);

    ReconnectionService.disconnectOldSocket(player, socket, io, socketToPlayer);

    player.socketId = socket.id;
    player.status = game ? 'presenter_connected' : 'presenter_lobby';
    player.lastSeen = Date.now();
    player.disconnectedAt = null;
    player.expiresAt = null;
    socketToPlayer.set(socket.id, playerId);

    // Sync reset state to other workers so checkExpiredPlayers doesn't fire
    // on stale expiresAt still held in their local players Maps.
    const { RedisSyncBus } = require('../sync/RedisSyncBus');
    const syncBus = RedisSyncBus.getInstance();
    if (syncBus?.publishPlayerData) {
        try {
            await syncBus.publishPlayerData(playerId, {
                ...player,
                answeredQuestions: player.answeredQuestions instanceof Set
                    ? [...player.answeredQuestions]
                    : (player.answeredQuestions || []),
            });
        } catch (error) {
            // El sync cross-worker es best-effort: la reconexión local ya está
            // completa y no debe fallar por un error de pub/sub.
            logger.warn('publishPlayerData failed during presenter reconnect', {
                playerId,
                roomId,
                error: error.message
            });
        }
    }

    await joinPresenterRooms(socket, roomId);
    configurePresenterSocketData(socket, roomId, nickname, playerId);

    const snapshot = ReconnectionService.buildPresenterSnapshot(
        player,
        roomId,
        game,
        teamConfigs,
        lobbyPlayers
    );
    if (sessionId) {
        snapshot.sessionId = sessionId;
    }
    socket.emit('reconnected-success', snapshot);

    maybeRestoreRevealState(socket, roomId, game);

    io.to(roomId + ':players').emit('presenter-reconnected', {
        message: 'El presentador se ha reconectado',
        code: 'PRESENTER_RECONNECTED'
    });

    reconnectionManager.recordAttempt(playerId, true);
    logger.info('Presenter reconnected successfully', {
        nickname,
        playerId,
        roomId,
        hasGame: !!game
    });
}

function createReconnectPresenterHandler(dependencies) {
    const { players } = dependencies;

    return async function handleReconnectPresenter(socket, data) {
        logReconnectRequest(socket, data, players);

        try {
            const value = validatePayload(data, socket);
            if (!value) {
                return;
            }

            const { playerId, sessionId } = value;
            let token = value.token;

            if (!token) {
                const cookieHeader = socket.handshake?.headers?.cookie;
                if (cookieHeader) {
                    const match = cookieHeader.match(/(?:^|;\s*)adminToken=([^;]*)/);
                    if (match) {
                        token = decodeURIComponent(match[1]);
                    }
                }
            }

            validatePanelTokenIfPresent(token, socket.id, playerId);

            await runPresenterReconnectFlow({
                socket,
                playerId,
                sessionId,
                dependencies
            });

        } catch (error) {
            logger.error('Error in ReconnectPresenterHandler', {
                error: error.message,
                stack: error.stack,
                socketId: socket.id
            });
            emitReconnectFailed(socket, buildReconnectFailed(
                'server-error',
                'Error interno al reconectar presentador',
                { sessionId: data?.sessionId }
            ));
        }
    };
}

module.exports = createReconnectPresenterHandler;
