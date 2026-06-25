/**
 * @fileoverview Utilidades de gestión de juego
 * @module sockets/utils/GameUtils
 */

const { players, activeGames, lobbyPlayers, teamConfigs, clearGameTimer, timerPausedState } = require('../../state/globalState');
const runtimeConfig = require('../../config/runtime-config');
const logger = require('../../config/logger');

/**
 * Obtener jugadores en una sala (cross-worker)
 */
async function getPlayersInRoom(roomId, io) {
    if (!io) return [];

    const sockets = await io.in(roomId).fetchSockets();
    const allPlayers = sockets
        .map(s => s.data?.nickname)
        .filter(nickname => typeof nickname === 'string' && nickname.trim().length > 0 && nickname !== 'HOST');

    return allPlayers;
}

/**
 * Termina la sesión completa cuando el Presentador expira sin reconectarse.
 * Replica el flujo de AbandonGameHandler para limpiar estado local + cross-worker.
 * @param {string} roomId
 * @param {Object} [io]
 */
async function terminateExpiredPresenterSession(roomId, io) {
    logger.warn('Presenter expired without reconnecting — terminating session', { roomId });

    const payload = {
        roomId,
        reason: 'presenter_expired',
        message: 'El presentador no volvió a conectarse. La sesión ha terminado.',
        code: 'PRESENTER_EXPIRED'
    };

    const SessionSaveDebouncer = require('../../services/SessionSaveDebouncer');
    await SessionSaveDebouncer.flush(roomId);
    SessionSaveDebouncer.markClosed(roomId);

    // Notificar y desconectar todos los sockets de la sala
    if (io) {
        const roomSockets = await io.in(roomId).fetchSockets();
        roomSockets.forEach(s => s.emit('game-abandoned', payload));
        
        try {
            if (typeof io.in === 'function') {
                io.in(roomId).socketsLeave([roomId, roomId + ':players', roomId + ':presenter']);
            }
        } catch (err) {
            logger.warn('Failed to make sockets leave rooms on presenter expiration', { roomId, error: err.message });
        }

        setTimeout(() => roomSockets.forEach(s => s.disconnect(true)), 200);
    }

    // Tombstone en Redis para que GetActiveSessionsQuery lo filtre en todos los workers
    const SessionStore = require('../../services/SessionStore');
    try { await SessionStore.save(roomId, { ended: true, savedAt: Date.now() }, 60); } catch (_) { /* best-effort tombstone */ }
    try { await SessionStore.invalidate(roomId); } catch (_) { /* best-effort invalidate */ }

    // Limpiar estado local
    activeGames.delete(roomId);
    lobbyPlayers.delete(roomId);
    teamConfigs.delete(roomId);
    clearGameTimer(roomId);
    if (timerPausedState) timerPausedState.delete(roomId);

    // Limpiar players del roomId en este worker
    for (const [pid, p] of players.entries()) {
        if (p.roomId === roomId) players.delete(pid);
    }

    // Sincronizar con otros workers via pub/sub
    const { RedisSyncBus } = require('../sync/RedisSyncBus');
    const syncBus = RedisSyncBus.getInstance();
    if (syncBus?.publishSessionAbandoned) {
        await syncBus.publishSessionAbandoned(roomId, 'presenter_expired');
    }
}

/**
 * Expirar un jugador tras inactividad
 * @param {string} playerId - ID del jugador
 * @param {Object} [io] - Socket.IO instance (opcional)
 */
async function expirePlayer(playerId, io = null) {
    const player = players.get(playerId);
    if (!player) return;

    const now = Date.now();
    if (now - player.lastSeen > runtimeConfig.get('RECONNECTION_TIMEOUT')) {
        const { nickname, roomId } = player;
        const isPresenter = player.role === 'presenter' || nickname === 'HOST';

        logger.debug(`${isPresenter ? 'Presentador' : 'Jugador'} ${nickname} expirado por inactividad`);

        players.delete(playerId);

        if (isPresenter && roomId) {
            // Terminar la sesión entera: notificar jugadores, limpiar Maps, sync cross-worker
            await terminateExpiredPresenterSession(roomId, io);
            return;
        }

        const { removePlayerFromLobby } = require('./LobbyManager');
        const removed = await removePlayerFromLobby(lobbyPlayers, roomId, nickname);
        if (removed) {
            logger.debug(`${nickname} eliminado del lobby ${roomId} (expirado)`);
        }

        if (roomId && io) {
            const { removePlayerFromActiveGame } = require('./GamePlayerRemover');
            await removePlayerFromActiveGame({
                roomId,
                nickname,
                activeGames,
                players,
                io
            });
        }
    }
}

/**
 * Transicionar jugadores a estado "connected" al iniciar juego
 */
function transitionPlayersToConnected(roomId) {
    const game = activeGames.get(roomId);
    if (!game || !game.players) return;

    for (const player of game.players) {
        player.connected = true;
    }
}

/**
 * Limpiar juegos inactivos (>4 horas)
 */
function cleanupInactiveGames() {
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    const now = Date.now();

    for (const [pin, game] of activeGames.entries()) {
        // Accept both canonical name and legacy alias during migration
        const startTs = game.gameStartTime;
        if (!startTs) continue;

        const gameAge = now - startTs;
        if (gameAge > FOUR_HOURS) {
            logger.debug(`Limpiando juego inactivo (>4h): ${pin}`);
            activeGames.delete(pin);
            clearGameTimer(pin);
            lobbyPlayers.delete(pin);
            teamConfigs.delete(pin);
        }
    }
}

/**
 * Limpiar lobbies vacíos
 */
function cleanupEmptyLobbies() {
    for (const [roomId, lobby] of lobbyPlayers.entries()) {
        if (!Array.isArray(lobby) || lobby.length === 0) {
            const hasActiveGame = activeGames.has(roomId);

            if (!hasActiveGame) {
                logger.debug(`Limpiando lobby vacío: ${roomId}`);
                lobbyPlayers.delete(roomId);
                teamConfigs.delete(roomId);
            }
        }
    }
}

/**
 * Verificar jugadores expirados
 */
async function checkExpiredPlayers(io = null) {
    const now = Date.now();
    const expiredPlayers = [];

    for (const [playerId, player] of players.entries()) {
        // Use expiresAt (set by DisconnectHandler) instead of lastSeen
        // to avoid inconsistencies.
        if ((player.status === 'disconnected' || player.status === 'presenter_disconnected') && player.expiresAt && now > player.expiresAt) {
            logger.debug(`Marcando jugador como expirado: ${player.nickname} (playerId: ${playerId})`);
            expiredPlayers.push(playerId);
        }
    }

    for (const playerId of expiredPlayers) {
        await expirePlayer(playerId, io);
    }

    if (expiredPlayers.length > 0) {
        logger.debug(`${expiredPlayers.length} jugadores expirados eliminados`);
    }
}

module.exports = {
    getPlayersInRoom,
    expirePlayer,
    terminateExpiredPresenterSession,
    transitionPlayersToConnected,
    cleanupInactiveGames,
    cleanupEmptyLobbies,
    checkExpiredPlayers
};
