/**
 * @fileoverview Handler para join-presenter-lobby
 * Flujo separado para presentador; token JWT de panel opcional.
 */

const { validateSocket, schemas } = require('../../validation');
const JoinGameUseCase = require('../../application/use-cases/JoinGameUseCase');
const { validatePanelToken } = require('../utils/RemoteControlHelper');
const logger = require('../../config/logger');

module.exports = function createJoinPresenterLobbyHandler(dependencies) {
    const {
        players,
        socketToPlayer,
        lobbyPlayers,
        teamConfigs,
        activeGames,
        socketRateLimits,
        roomPresenterMap,
        io
    } = dependencies;

    const joinGameUseCase = new JoinGameUseCase({
        players,
        socketToPlayer,
        lobbyPlayers,
        teamConfigs,
        activeGames,
        socketRateLimits,
        roomPresenterMap,
        io
    });

    return async function handleJoinPresenterLobby(socket, data) {
        // Joi da por válido un payload undefined; sin datos tiene que fallar la validación
        const validation = validateSocket(schemas.joinPresenterLobby, data ?? {});
        if (!validation.valid) {
            socket.emit('join-error', { message: validation.error, reason: 'invalid-data' });
            return;
        }

        const { pin, sessionId, playerId, sessionSecret, isTeamMode, teamConfig } = validation.value;
        let token = validation.value.token;

        if (!token) {
            const cookieHeader = socket.handshake?.headers?.cookie;
            if (cookieHeader) {
                const match = cookieHeader.match(/(?:^|;\s*)adminToken=([^;]*)/);
                if (match) {
                    token = decodeURIComponent(match[1]);
                }
            }
        }

        let panelUser = null;
        if (token) {
            panelUser = validatePanelToken(token, ['admin', 'editor']);
            if (!panelUser) {
                logger.warn('join-presenter-lobby token inválido: continuando sin autenticación de panel', {
                    socketId: socket.id,
                    playerId
                });
            }
        }

        try {
            const result = await joinGameUseCase.execute({
                pin,
                sessionId,
                nickname: 'HOST',
                sessionSecret,
                socket,
                isTeamMode,
                teamConfig
            });

            if (!result.success) {
                socket.emit('join-error', {
                    message: result.error,
                    reason: result.reason
                });
                return;
            }

            socket.data.presenterUserId = panelUser ? (panelUser.userId || null) : null;
            socket.data.presenterRole = panelUser ? (panelUser.role || null) : null;
            socket.data.playerId = playerId;

            const { roomId, playersInLobby, teamMode } = result;
            socket.emit('join-success', {
                roomId,
                teamMode,
                playerId: result.playerId,
                players: playersInLobby,
                sessionSecret: result.sessionSecret
            });

            socket.to(roomId).emit('player-joined', {
                nickname: 'HOST',
                players: playersInLobby
            });
        } catch (error) {
            logger.error('Error in join-presenter-lobby handler', {
                error: error.message,
                stack: error.stack
            });
            socket.emit('join-error', {
                message: 'Error al unirse al lobby como presentador',
                reason: 'server-error',
                code: 'JOIN_PRESENTER_LOBBY_FAILED'
            });
        }
    };
};
