/**
 * @fileoverview Game Cleanup Manager - Handles player notifications and cleanup
 * 
 * Separado de GameEndManager para evitar dependencias circulares con EndGameUseCase
 */

const { decrementGames } = require('../../state/metrics');
const { removeAdapter } = require('../../domain/state/GameStateAdapter');
const { roomPresenterMap } = require('../../state/globalState');
const logger = require('../../config/logger');

/**
 * Send final positions to players
 * @param {Object} params - Parameters
 */
async function sendFinalPositions({ io, roomId, ranking, teamConfig }) {
    const isTeamMode = teamConfig && teamConfig.isTeamMode;

    logger.debug(`Enviando posiciones finales - Modo: ${isTeamMode ? 'EQUIPOS' : 'INDIVIDUAL'}`, {
        ranking: ranking.map(r => ({ name: r.name, position: r.position, pts: r.pts }))
    });

    if (isTeamMode) {
        // Team mode - send team position to all members
        const sockets = await io.in(`${roomId}:players`).fetchSockets();
        logger.debug(`Sockets en room '${roomId}:players': ${sockets.length}`);
        const socketByNickname = new Map(sockets.map(s => [s.data?.nickname, s]));

        ranking.forEach(team => {
            const teamData = teamConfig.teams.find(t => t.name === team.name);
            if (teamData) {
                logger.debug(`Procesando equipo: ${team.name}, miembros:`, teamData.players);
                teamData.players.forEach(playerNick => {
                    const playerSocket = socketByNickname.get(playerNick);
                    if (playerSocket) {
                        logger.debug(`Enviando posición a ${playerNick} (${playerSocket.id}) - Pos: ${team.position}`);
                        io.to(playerSocket.id).emit('player-final-position', {
                            position: team.position,
                            totalPlayers: ranking.length,
                            score: team.pts,
                            nickname: team.name,
                            isTeam: true,
                            teamName: team.name
                        });
                    } else {
                        logger.warn(`No se encontró socket para jugador: ${playerNick}`);
                    }
                });
            } else {
                logger.warn(`No se encontró configuración para equipo: ${team.name}`);
            }
        });
    } else {
        // Individual mode
        const sockets = await io.in(`${roomId}:players`).fetchSockets();
        logger.debug(`Sockets en room '${roomId}:players': ${sockets.length}`);
        logger.debug(`Nicknames en sockets:`, sockets.map(s => s.data?.nickname || 'NO_NICKNAME'));
        const socketByNickname = new Map(sockets.map(s => [s.data?.nickname, s]));

        ranking.forEach(player => {
            const playerSocket = socketByNickname.get(player.name);
            if (playerSocket) {
                logger.debug(`Enviando posición a ${player.name} (${playerSocket.id}) - Pos: ${player.position}, Score: ${player.pts}`);
                io.to(playerSocket.id).emit('player-final-position', {
                    position: player.position,
                    totalPlayers: ranking.length,
                    score: player.pts,
                    nickname: player.name,
                    isTeam: false
                });
            } else {
                logger.warn(`No se encontró socket para jugador: ${player.name}`);
                logger.debug(`Sockets disponibles:`, sockets.map(s => `${s.id}:${s.data?.nickname}`));
            }
        });
    }

    logger.info(`Envío de posiciones finales completado para ${roomId}`);
}

/**
 * Clean up game resources (delayed cleanup for last-minute answers)
 * @param {Object} params - Cleanup parameters
 */
function cleanupGame({ roomId, activeGames, players, socketToPlayer, lobbyPlayers, clearGameTimer, redis }) {
    // Mark game as ended (but keep it in memory briefly)
    const game = activeGames.get(roomId);
    if (game) {
        game.ended = true;
        game.canAnswer = false;

        // Idempotency guard — avoid double cleanup
        if (game.cleanupAttempts > 0) {
            logger.warn(`cleanupGame: duplicate cleanup attempt for ${roomId}, skipping`);
            return;
        }
        game.cleanupAttempts = (game.cleanupAttempts || 0) + 1;
    }

    // Reduced delay: 500 ms (was 3 s) — minimises rejoin-to-ended-room window
    setTimeout(async () => {
        // Clean up players
        for (const [playerId, player] of players.entries()) {
            if (player.roomId === roomId) {
                if (player.socketId) {
                    socketToPlayer.delete(player.socketId);
                }
                players.delete(playerId);
            }
        }

        // Clean up game state
        activeGames.delete(roomId);
        decrementGames(); // Update metrics
        lobbyPlayers.delete(roomId);
        roomPresenterMap.delete(roomId);
        clearGameTimer(roomId);
        removeAdapter(roomId); // Liberar actor XState

        // Awaitable Redis cleanup
        if (redis) {
            try {
                await redis.del(`timer:state:${roomId}`);
                logger.debug(`Limpieza Redis completada: ${roomId}`);
            } catch (err) {
                logger.error('cleanupGame: Redis cleanup failed', { roomId, error: err.message });
            }
        }

        logger.debug(`Limpieza diferida completada: ${roomId}`);
    }, 500);
}

module.exports = {
    sendFinalPositions,
    cleanupGame
};
