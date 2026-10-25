'use strict';

/**
 * @fileoverview Cierre de una sesión de Trivial terminada (ganador o «Finalizar»)
 *
 * Misma limpieza que EndGameUseCase hace en el resto de juegos. Antes solo se borraba
 * activeGames: el presentador seguía en `<roomId>:presenter` y el lobby seguía vivo,
 * así que el `abandon-game` (reason 'concluded') del botón del podio se trataba como
 * un abandono real y el servidor desconectaba el socket del presentador. Socket.IO no
 * reconecta tras una desconexión hecha por el servidor, y la siguiente partida acababa
 * en «Error de conexión».
 *
 * Public API:
 *   closeTrivialSession({ io, roomId })
 */

const trivialGameState = require('./TrivialGameState');
const SessionStore = require('../../services/SessionStore');
const { removeAdapter } = require('../../domain/state/GameStateAdapter');
const {
    activeGames,
    lobbyPlayers,
    teamConfigs,
    players,
    socketToPlayer,
    roomPresenterMap,
    timerPausedState
} = require('../../state/globalState');
const logger = require('../../config/logger');

// Como en EndGameUseCase: tiempo para ver la posición final antes de «Juego concluido»
const PLAYER_REDIRECT_DELAY_MS = 15000;

/** Lo mismo que hacen los demás workers al recibir session-abandoned (RedisSyncBus). */
function cleanupLocalState(roomId) {
    activeGames.delete(roomId);
    lobbyPlayers.delete(roomId);
    teamConfigs.delete(roomId);
    roomPresenterMap.delete(roomId);
    timerPausedState.delete(roomId);
    removeAdapter(roomId);

    for (const [playerId, player] of players.entries()) {
        if (player.roomId === roomId) {
            if (player.socketId) {
                socketToPlayer.delete(player.socketId);
            }
            players.delete(playerId);
        }
    }
}

/**
 * Programa «Juego concluido» en los móviles. Los sockets se recogen ya porque enseguida
 * salen de la sala; los de otros workers llegan como RemoteSocket (sin `connected`).
 */
async function schedulePlayerRedirect(io, roomId) {
    try {
        const playerSockets = await io.in(roomId + ':players').fetchSockets();
        setTimeout(() => {
            playerSockets.forEach(socket => {
                socket.emit('game-abandoned', {
                    roomId,
                    reason: 'concluded',
                    message: 'Juego concluido.',
                    code: 'GAME_ENDED'
                });
            });
        }, PLAYER_REDIRECT_DELAY_MS);
    } catch (err) {
        logger.warn('TrivialSessionClose: no se pudo programar la redirección de jugadores', {
            roomId,
            error: err.message
        });
    }
}

function leaveRooms(io, roomId) {
    try {
        io.in(roomId).socketsLeave([roomId, roomId + ':players', roomId + ':presenter']);
    } catch (err) {
        logger.warn('TrivialSessionClose: no se pudo sacar a los sockets de las salas', {
            roomId,
            error: err.message
        });
    }
}

/** Lápida + invalidación, como EndGameUseCase: GetActiveSessionsQuery deja de listarla. */
async function markSessionEnded(roomId) {
    try {
        const SessionSaveDebouncer = require('../../services/SessionSaveDebouncer');
        await SessionSaveDebouncer.flush(roomId);
        SessionSaveDebouncer.markClosed(roomId);
    } catch (_) {
        // Best-effort flush and mark closed
    }

    try {
        await SessionStore.save(roomId, { ended: true, savedAt: Date.now() }, 60);
    } catch (_) {
        // Best-effort tombstone
    }

    try {
        await SessionStore.invalidate(roomId);
    } catch (_) {
        // Best-effort invalidate
    }
}

/** Los demás workers borran lobby, partida y jugadores de la sala. */
async function publishSessionClosed(roomId) {
    try {
        const { RedisSyncBus } = require('../sync/RedisSyncBus');
        await RedisSyncBus.getInstance().publishSessionAbandoned(roomId, 'game-ended');
    } catch (err) {
        logger.warn('TrivialSessionClose: no se pudo avisar a los demás workers', { roomId, error: err.message });
    }
}

/**
 * Cierra la sesión de Trivial que acaba de terminar: estado de Trivial, partida, lobby,
 * jugadores y salas, en este worker y en los demás. Va después de enviar el ranking.
 *
 * @param {{ io: Object, roomId: string }} params
 */
async function closeTrivialSession({ io, roomId }) {
    try {
        await trivialGameState.deleteTrivialState(roomId);
    } catch (err) {
        logger.warn('TrivialSessionClose: no se pudo borrar el estado de Trivial', { roomId, error: err.message });
    }
    cleanupLocalState(roomId);

    await schedulePlayerRedirect(io, roomId);
    leaveRooms(io, roomId);

    await markSessionEnded(roomId);
    await publishSessionClosed(roomId);
}

module.exports = { closeTrivialSession };
