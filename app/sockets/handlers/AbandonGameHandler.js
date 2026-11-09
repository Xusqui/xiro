/**
 * @fileoverview Abandon Game Handler
 * Permite al presentador abandonar una sesion y expulsar a todos los jugadores.
 */

const { validateSocket, schemas } = require('../../validation');
const { saveGameSession } = require('../../services/db/game-session.service');
const { pushSessionLog } = require('../../services/game-logs.service');
const { getRedisClient } = require('../../config/redis');
const SessionStore = require('../../services/SessionStore');
const { bestEffort } = require('../../services/best-effort');
const logger = require('../../config/logger');

function resolveRoomId(roomIdOrPin, activeGames, lobbyPlayers) {
    const raw = String(roomIdOrPin || '').trim();

    if (!raw) {
        return null;
    }

    if (activeGames.has(raw) || lobbyPlayers.has(raw)) {
        return raw;
    }

    const normalized = raw.toUpperCase();

    // Aceptar sessionId completo (p.ej. PIN-UUID) aunque ya no exista en Maps.
    // Esto permite cerrar la sesión tras el podio final, cuando activeGames ya
    // se limpió, pero los sockets todavía siguen en la room.
    if (raw.includes('-') && raw.length >= 8) {
        return normalized;
    }

    const sessionIdPattern = /^[A-Z0-9]{4,10}-\d{4}$/;
    if (sessionIdPattern.test(normalized)) {
        return raw;
    }

    if (!raw.includes('-')) {
        const prefix = `${normalized}-`;
        for (const roomId of lobbyPlayers.keys()) {
            if (String(roomId).toUpperCase().startsWith(prefix)) return roomId;
        }
        for (const roomId of activeGames.keys()) {
            if (String(roomId).toUpperCase().startsWith(prefix)) return roomId;
        }
    }

    return null;
}

async function disconnectRoomSockets(io, roomId, payload) {
    const socketMaps = new Map();

    const roomSockets = await io.in(roomId).fetchSockets();
    roomSockets.forEach(socket => socketMaps.set(socket.id, socket));

    const playerSockets = await io.in(roomId + ':players').fetchSockets();
    playerSockets.forEach(socket => socketMaps.set(socket.id, socket));

    const presenterSockets = await io.in(roomId + ':presenter').fetchSockets();
    presenterSockets.forEach(socket => socketMaps.set(socket.id, socket));

    const sockets = Array.from(socketMaps.values());
    sockets.forEach(socket => socket.emit('game-abandoned', payload));

    setTimeout(() => {
        sockets.forEach(socket => socket.disconnect(true));
    }, 200);

    return sockets;
}

function cleanupRoomState(roomId, dependencies, sockets) {
    const { activeGames, lobbyPlayers, teamConfigs, players, socketToPlayer, clearGameTimer, timerPausedState } =
        dependencies;

    activeGames.delete(roomId);
    lobbyPlayers.delete(roomId);
    teamConfigs.delete(roomId);
    clearGameTimer(roomId);
    if (timerPausedState) {
        timerPausedState.delete(roomId);
    }

    if (sockets && sockets.length > 0) {
        sockets.forEach(socket => {
            if (socketToPlayer.has(socket.id)) {
                socketToPlayer.delete(socket.id);
            }
        });
    }

    for (const [playerId, player] of players.entries()) {
        if (player.roomId === roomId) {
            players.delete(playerId);
        }
    }
}

function buildAbandonPayload(roomId, reason) {
    return {
        roomId,
        reason,
        message:
            reason === 'concluded'
                ? 'Juego concluido, puede cerrar el navegador.'
                : 'El presentador ha abandonado la sesión.',
        ...(reason === 'concluded' && { code: 'GAME_ENDED' })
    };
}

async function resolveAbandonStartTime(roomId, game) {
    const fallbackStart = game.gameStartTime || null;

    const lookup = await bestEffort('lectura del inicio de partida en Redis', { roomId }, async () => {
        const redisClient = await getRedisClient();
        const redisStart = await redisClient.get(`game:started:${roomId}`);
        if (redisStart) {
            bestEffort('borrado del inicio de partida en Redis', { roomId }, () =>
                redisClient.del(`game:started:${roomId}`)
            );
        }
        return redisStart;
    });

    return lookup.ok && lookup.value ? Number(lookup.value) : fallbackStart;
}

async function resolveDbSessionId(roomId, game) {
    if (game.dbSessionId) {
        return game.dbSessionId;
    }
    try {
        const SessionStore = require('../../services/SessionStore');
        const redisSession = await SessionStore.load(roomId);
        if (redisSession && redisSession.dbSessionId) {
            return redisSession.dbSessionId;
        }
    } catch (err) {
        logger.debug('Failed to resolve dbSessionId from Redis in abandon handler', { roomId, error: err.message });
    }
    return null;
}

async function saveAbortedSession(roomId, reason, activeGames) {
    if (reason === 'concluded') {
        return;
    }

    const game = activeGames.get(roomId);
    if (!game) {
        return;
    }

    const pin = game.roomId || game.pin || roomId;
    const gamePlayers = game.players || [];
    const playerCount = Array.isArray(gamePlayers) ? gamePlayers.length : Object.keys(gamePlayers).length;
    const abandonStart = await resolveAbandonStartTime(roomId, game);
    const dbSessionId = await resolveDbSessionId(roomId, game);

    saveGameSession({
        pin,
        sessionId: roomId,
        dbId: dbSessionId,
        gameType: game.isTrivial ? 'trivial' : game.gameType || null,
        startedAt: abandonStart,
        durationMs: abandonStart ? Date.now() - abandonStart : null,
        playerCount,
        questionCount: game.currentIndex || 0,
        reason: 'aborted',
        finalRanking: [],
        questionsSnapshot: [],
        playerAnswers: game.playerAnswers || {}
    }).catch(err => logger.error('AbandonGameHandler: failed to save session', { roomId, error: err.message }));
}

async function markSessionEnded(roomId) {
    await bestEffort('flush y cierre del guardado de sesión', { roomId }, async () => {
        const SessionSaveDebouncer = require('../../services/SessionSaveDebouncer');
        await SessionSaveDebouncer.flush(roomId);
        SessionSaveDebouncer.markClosed(roomId);
    });
    await bestEffort('lápida de sesión en Redis', { roomId }, () =>
        SessionStore.save(roomId, { ended: true, savedAt: Date.now() }, 60)
    );
    await bestEffort('invalidación de sesión en Redis', { roomId }, () => SessionStore.invalidate(roomId));
}

async function publishAbandonSync(syncBus, roomId, reason) {
    if (!syncBus || !syncBus.publishSessionAbandoned) {
        return;
    }
    await syncBus.publishSessionAbandoned(roomId, reason);
}

/**
 * Crea el handler del evento 'abandon-game'. Cierra la sesión sin terminar la partida y lo propaga al resto de workers.
 * @param {Object} dependencies - Maps de globalState, io y servicios (ver socket.handlers.js)
 * @returns {function(socket, data): Promise<void>} Handler
 */
function createAbandonGameHandler(dependencies) {
    const { activeGames, lobbyPlayers, io, syncBus } = dependencies;

    return async function handleAbandonGame(socket, data) {
        const validation = validateSocket(schemas.abandonGame, data);
        if (!validation.valid) {
            socket.emit('error', { message: validation.error });
            return;
        }

        const { roomIdOrPin, reason } = validation.value;
        const roomId = resolveRoomId(roomIdOrPin, activeGames, lobbyPlayers);

        if (!roomId) {
            socket.emit('error', { message: 'Sesion no encontrada para abandonar', code: 'ABANDON_SESSION_NOT_FOUND' });
            return;
        }

        logger.warn('Presenter abandoned game', {
            roomId,
            reason,
            socketId: socket.id
        });

        await pushSessionLog(roomId, {
            level: 'warn',
            event: 'game-abandoned',
            actor: 'presenter',
            message: 'Presenter abandoned session',
            data: { reason }
        });

        const payload = buildAbandonPayload(roomId, reason);

        const sockets = await disconnectRoomSockets(io, roomId, payload);

        // Only save session for true mid-game aborts.
        // When reason='concluded' the game already ended cleanly and was saved
        // by EndGameUseCase / TrivialEndGameService / TrivialFinalize.
        await saveAbortedSession(roomId, reason, activeGames);

        // Tombstone + invalidate: same pattern as EndGameUseCase so that
        // GetActiveSessionsQuery filters the key out even if invalidate() fails.
        await markSessionEnded(roomId);

        cleanupRoomState(roomId, dependencies, sockets);

        await publishAbandonSync(syncBus, roomId, reason);
    };
}

module.exports = createAbandonGameHandler;
