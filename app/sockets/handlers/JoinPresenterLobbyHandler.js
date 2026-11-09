/**
 * @fileoverview Handler para join-presenter-lobby
 * Flujo separado para presentador; token JWT de panel opcional.
 */

const { validateSocket, schemas } = require('../../validation');
const { buildJoinGameUseCase } = require('../utils/JoinGameUseCaseFactory');
const { validatePanelToken } = require('../utils/RemoteControlHelper');
const logger = require('../../config/logger');

// El token del panel llega en el payload o en la cookie del handshake
function resolvePanelToken(socket, payloadToken) {
    if (payloadToken) return payloadToken;

    const cookieHeader = socket.handshake?.headers?.cookie;
    const match = cookieHeader ? cookieHeader.match(/(?:^|;\s*)adminToken=([^;]*)/) : null;
    return match ? decodeURIComponent(match[1]) : undefined;
}

function resolvePanelUser(socket, payloadToken, playerId) {
    const token = resolvePanelToken(socket, payloadToken);
    if (!token) return null;

    const panelUser = validatePanelToken(token, ['admin', 'editor']);
    if (!panelUser) {
        logger.warn('join-presenter-lobby token inválido: continuando sin autenticación de panel', {
            socketId: socket.id,
            playerId
        });
    }
    return panelUser || null;
}

function completePresenterJoin(socket, result, panelUser, playerId) {
    socket.data.presenterUserId = panelUser ? panelUser.userId || null : null;
    socket.data.presenterRole = panelUser ? panelUser.role || null : null;
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
}

/**
 * Crea el handler del evento 'join-presenter-lobby'. El presentador abre o recupera el lobby de una sala.
 * @param {Object} dependencies - Maps de globalState, io y servicios (ver socket.handlers.js)
 * @returns {function(socket, data): Promise<void>} Handler
 */
module.exports = function createJoinPresenterLobbyHandler(dependencies) {
    const joinGameUseCase = buildJoinGameUseCase(dependencies);

    return async function handleJoinPresenterLobby(socket, data) {
        // Joi da por válido un payload undefined; sin datos tiene que fallar la validación
        const validation = validateSocket(schemas.joinPresenterLobby, data ?? {});
        if (!validation.valid) {
            socket.emit('join-error', { message: validation.error, reason: 'invalid-data' });
            return;
        }

        const { pin, sessionId, playerId, sessionSecret, isTeamMode, teamConfig } = validation.value;
        const panelUser = resolvePanelUser(socket, validation.value.token, playerId);

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

            completePresenterJoin(socket, result, panelUser, playerId);
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
