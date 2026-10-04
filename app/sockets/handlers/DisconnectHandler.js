/**
 * @fileoverview Handler para disconnect event
 */

const runtimeConfig = require('../../config/runtime-config');
const EventBus = require('../../domain/events/EventBus');
const { PlayerDisconnectedEvent } = require('../../domain/events/GameEvents');
const { applyTeamMembership, emitLocalTeamUpdate } = require('../utils/TeamMembershipSync');

function serializeAnsweredQuestions(answeredQuestions) {
    if (answeredQuestions instanceof Set) {
        return Array.from(answeredQuestions);
    }
    if (Array.isArray(answeredQuestions)) {
        return answeredQuestions;
    }
    return [];
}

// El presentador tiene su propia ventana (más larga): si su equipo entra en reposo,
// la sesión entera se cierra al expirar, no solo un jugador.
function getReconnectionWindow(isPresenter) {
    return runtimeConfig.get(isPresenter ? 'PRESENTER_RECONNECTION_TIMEOUT' : 'RECONNECTION_TIMEOUT');
}

function markPlayerAsDisconnected(player, isPresenter) {
    player.status = isPresenter ? 'presenter_disconnected' : 'disconnected';
    player.lastSeen = Date.now();
    player.expiresAt = Date.now() + getReconnectionWindow(isPresenter);
}

async function publishPlayerDisconnected(playerId, player) {
    const { RedisSyncBus } = require('../sync/RedisSyncBus');
    const syncBus = RedisSyncBus.getInstance();

    await syncBus.publishPlayerDisconnected(playerId, {
        id: playerId,
        nickname: player.nickname,
        roomId: player.roomId,
        role: player.role,
        status: player.status,
        lastSeen: player.lastSeen,
        expiresAt: player.expiresAt,
        socketId: null,
        score: player.score,
        answeredQuestions: serializeAnsweredQuestions(player.answeredQuestions),
        teamIndex: player.teamIndex,
        teamName: player.teamName
    });
}

function findPresenterInRoom({ roomPresenterMap, players, roomId }) {
    let presenterPlayerId = roomPresenterMap?.get(roomId) || null;
    let presenterPlayer = presenterPlayerId ? players.get(presenterPlayerId) : null;

    if (presenterPlayer) {
        return { presenterPlayerId, presenterPlayer };
    }

    for (const [pid, player] of players.entries()) {
        const isPresenter = player.role === 'presenter' || player.nickname === 'HOST';
        const isActivePresenterStatus = player.status === 'presenter_lobby' || player.status === 'presenter_connected';
        if (player.roomId === roomId && isPresenter && isActivePresenterStatus) {
            presenterPlayerId = pid;
            presenterPlayer = player;
            break;
        }
    }

    return { presenterPlayerId, presenterPlayer };
}

function emitPresenterDisconnected(io, roomId) {
    io.to(roomId + ':players').emit('presenter-disconnected', {
        message: 'El presentador se ha desconectado temporalmente',
        code: 'PRESENTER_DISCONNECTED_TEMP'
    });
}

async function removeDisconnectedPlayerFromTeamsIfLobby(context) {
    const { roomId, nickname, activeGames, teamConfigs, io, logger } = context;

    if (!roomId || !nickname || !teamConfigs || activeGames?.has(roomId)) {
        return;
    }

    const teamConfig = teamConfigs.get(roomId);
    if (!teamConfig) {
        return;
    }

    const changed = applyTeamMembership(teamConfig, { nickname, teamIndex: null });
    if (!changed) {
        return;
    }

    try {
        const { RedisSyncBus } = require('../sync/RedisSyncBus');
        const syncBus = RedisSyncBus.getInstance();
        await syncBus.publishTeamMembership(roomId, nickname, null);
        emitLocalTeamUpdate(io, roomId, teamConfig);

        logger.debug('Disconnected player removed from team config (lobby)', {
            roomId,
            nickname
        });
    } catch (error) {
        logger.warn('Failed to sync team cleanup on disconnect', {
            roomId,
            nickname,
            error: error.message
        });
    }
}

async function handleFallbackPresenterDisconnect(context) {
    const { socket, fallbackRoomId, players, roomPresenterMap, io, logger } = context;
    const { presenterPlayerId, presenterPlayer } = findPresenterInRoom({
        roomPresenterMap,
        players,
        roomId: fallbackRoomId
    });

    if (!presenterPlayer || !presenterPlayerId) {
        logger.debug('Presenter fallback disconnect: no active presenter found for room', {
            socketId: socket.id,
            fallbackRoomId
        });
        return;
    }

    markPlayerAsDisconnected(presenterPlayer, true);
    emitPresenterDisconnected(io, fallbackRoomId);
    await publishPlayerDisconnected(presenterPlayerId, presenterPlayer);

    logger.warn('[DIAG] Presenter disconnect via fallback path — state fixed', {
        socketId: socket.id,
        fallbackRoomId,
        presenterPlayerId,
        expiresAt: new Date(presenterPlayer.expiresAt).toISOString()
    });
}

async function handleFallbackPlayerDisconnect(context) {
    const {
        fallbackNickname,
        fallbackRoomId,
        lobbyPlayers,
        activeGames,
        teamConfigs,
        players,
        io,
        logger
    } = context;
    const { removePlayerFromLobby } = require('../utils/LobbyManager');
    const { getPlayersInRoom } = require('../utils/GameUtils');
    const { removePlayerFromActiveGame } = require('../utils/GamePlayerRemover');

    logger.debug('Socket disconnected without playerId - fallback cleanup', {
        nickname: fallbackNickname,
        roomId: fallbackRoomId
    });

    await removePlayerFromLobby(lobbyPlayers, fallbackRoomId, fallbackNickname);
    await removeDisconnectedPlayerFromTeamsIfLobby({
        roomId: fallbackRoomId,
        nickname: fallbackNickname,
        activeGames,
        teamConfigs,
        io,
        logger
    });

    const playersInRoom = await getPlayersInRoom(fallbackRoomId, io);

    io.to(fallbackRoomId).emit('player-left', {
        nickname: fallbackNickname,
        players: playersInRoom
    });

    await removePlayerFromActiveGame({
        roomId: fallbackRoomId,
        nickname: fallbackNickname,
        activeGames,
        players,
        io
    });
}

async function handleDisconnectWithoutPlayerId(context) {
    const {
        socket,
        lobbyPlayers,
        activeGames,
        teamConfigs,
        players,
        roomPresenterMap,
        metrics,
        io,
        logger
    } = context;

    const fallbackNickname = socket.data?.nickname;
    const fallbackRoomId = socket.data?.roomId;
    const isPresenterFallback = fallbackNickname === 'HOST';

    if (!fallbackNickname || !fallbackRoomId) {
        logger.debug('Socket disconnected without playerId', { socketId: socket.id });
        metrics.decrementPlayers();
        return;
    }

    if (isPresenterFallback) {
        await handleFallbackPresenterDisconnect({
            socket,
            fallbackRoomId,
            players,
            roomPresenterMap,
            io,
            logger
        });
        metrics.decrementPlayers();
        return;
    }

    await handleFallbackPlayerDisconnect({
        fallbackNickname,
        fallbackRoomId,
        lobbyPlayers,
        activeGames,
        teamConfigs,
        players,
        io,
        logger
    });

    metrics.decrementPlayers();
}

async function handleKnownPlayerDisconnect(context) {
    const {
        socket,
        playerId,
        player,
        lobbyPlayers,
        activeGames,
        teamConfigs,
        metrics,
        io,
        logger
    } = context;

    const { nickname, roomId } = player;
    const isPresenter = player.role === 'presenter' || nickname === 'HOST';

    if (!isPresenter) {
        const { removePlayerFromLobby } = require('../utils/LobbyManager');
        const { getPlayersInRoom } = require('../utils/GameUtils');

        await removePlayerFromLobby(lobbyPlayers, roomId, nickname);
        await removeDisconnectedPlayerFromTeamsIfLobby({
            roomId,
            nickname,
            activeGames,
            teamConfigs,
            io,
            logger
        });

        if (roomId) {
            const playersInRoom = await getPlayersInRoom(roomId, io);
            io.to(roomId).emit('player-left', {
                nickname,
                players: playersInRoom
            });
        }
    } else if (roomId) {
        emitPresenterDisconnected(io, roomId);
        logger.info('[DIAG] Presenter disconnected — keeping lobby/game intact', {
            nickname,
            roomId,
            playerId,
            reason: context.reason,
            oldSocketId: socket.id,
            previousStatus: player.status,
            willExpireAt: new Date(Date.now() + getReconnectionWindow(true)).toISOString()
        });
    }

    markPlayerAsDisconnected(player, isPresenter);

    logger.debug('Jugador marcado como desconectado:', {
        playerId,
        nickname,
        roomId,
        role: isPresenter ? 'presenter' : 'player',
        status: player.status,
        expiresAt: new Date(player.expiresAt).toISOString(),
        reconnectionWindowMinutes: getReconnectionWindow(isPresenter) / 60000
    });

    await publishPlayerDisconnected(playerId, player);

    EventBus.emit('player.disconnected', new PlayerDisconnectedEvent({
        gameId: roomId,
        playerId,
        nickname,
        reason: 'connection_lost'
    }));

    logger.info('Player disconnected', {
        playerId,
        nickname,
        roomId,
        expiresAt: new Date(player.expiresAt).toISOString()
    });

    context.socketToPlayer.delete(socket.id);
    metrics.decrementPlayers();
}

module.exports = function createDisconnectHandler(dependencies) {
    const {
        players,
        socketToPlayer,
        lobbyPlayers,
        activeGames,
        teamConfigs,
        roomPresenterMap,
        metrics,
        io
    } = dependencies;

    return async function handleDisconnect(socket, reason) {
        const logger = require('../../config/logger');
        const playerId = socketToPlayer.get(socket.id);

        // [DIAG] Always log every disconnect with reason + socket role so we can correlate
        logger.info('[DIAG] socket disconnect', {
            socketId: socket.id,
            reason,
            hasPlayerId: !!playerId,
            playerIdPreview: playerId ? String(playerId).slice(0, 8) + '…' : null,
            socketDataRole: socket.data?.role || null,
            socketDataNickname: socket.data?.nickname || null,
            socketDataRoomId: socket.data?.roomId || null
        });

        if (!playerId) {
            await handleDisconnectWithoutPlayerId({
                socket,
                lobbyPlayers,
                activeGames,
                teamConfigs,
                players,
                roomPresenterMap,
                metrics,
                io,
                logger
            });
            return;
        }

        const player = players.get(playerId);
        if (!player) {
            socketToPlayer.delete(socket.id);
            logger.debug('Socket disconnected but player not found', { socketId: socket.id, playerId });
            metrics.decrementPlayers();
            return;
        }

        await handleKnownPlayerDisconnect({
            socket,
            reason,
            playerId,
            player,
            socketToPlayer,
            lobbyPlayers,
            activeGames,
            teamConfigs,
            metrics,
            io,
            logger
        });
    };
};
