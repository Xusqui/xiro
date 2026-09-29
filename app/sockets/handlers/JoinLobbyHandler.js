/**
 * @fileoverview Handler para join-lobby event - Refactorizado con Use Case pattern
 * Simplificado de 178 líneas a ~65 líneas usando JoinGameUseCase
 */

const { validateSocket, schemas } = require('../../validation');
const JoinGameUseCase = require('../../application/use-cases/JoinGameUseCase');
const { pushSessionLog } = require('../../services/game-logs.service');
const ReconnectionService = require('../services/ReconnectionService');
const logger = require('../../config/logger');

function emitJoinError(socket, result) {
    socket.emit('join-error', {
        message: result.error,
        reason: result.reason,
        ...(result.code && { code: result.code }),
        ...(result.params && { params: result.params })
    });
}

async function handleReconnectJoin({ socket, io, nickname, result, teamConfigs }) {
    // Jugador desconectado que reclamó su nickname mientras la
    // partida seguía en curso: mismo snapshot y aviso al
    // presentador que recibiría vía reconnect-player.
    await ReconnectionService.emitReconnectionSuccess({
        socket,
        io,
        nickname,
        playerId: result.playerId,
        player: result.player,
        roomId: result.roomId,
        game: result.game,
        teamConfigs
    });

    await pushSessionLog(result.roomId, {
        level: 'info',
        event: 'player-rejoined',
        actor: nickname,
        message: 'Player reconnected via join-lobby (session was disconnected)',
        data: { playerId: result.playerId }
    });
}

async function emitJoinSuccess({ socket, nickname, result }) {
    const { roomId, playerId, playersInLobby, teamMode } = result;

    await pushSessionLog(roomId, {
        level: 'info',
        event: 'player-joined',
        actor: nickname,
        message: 'Player joined lobby',
        data: {
            playerId,
            playersInLobby: playersInLobby?.length || 0,
            teamMode: !!teamMode
        }
    });

    logger.info('JoinGameUseCase result', {
        nickname,
        roomId,
        playerId,
        playersInLobby,
        playersInLobbyLength: playersInLobby?.length,
        teamMode
    });

    // Emitir confirmación al cliente
    socket.emit('join-success', {
        roomId,
        teamMode,
        playerId,
        players: playersInLobby,
        sessionSecret: result.sessionSecret
    });

    // Notificar a otros jugadores
    logger.info('Emitting player-joined event', {
        nickname,
        roomId,
        playersCount: playersInLobby?.length || 0,
        players: playersInLobby
    });

    socket.to(roomId).emit('player-joined', {
        nickname,
        players: playersInLobby
    });
}

module.exports = function createJoinLobbyHandler(dependencies) {
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

    // Instanciar Use Case con dependencias
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

    return async function handleJoinLobby(socket, data) {
        // Validación básica de schema
        const validation = validateSocket(schemas.joinLobby, data);
        if (!validation.valid) {
            socket.emit('join-error', { message: validation.error });
            return;
        }

        const { pin, sessionId, nickname, sessionSecret, isTeamMode, teamConfig } = validation.value;

        if (nickname === 'HOST') {
            socket.emit('join-error', {
                message: 'Flujo de presentador no válido en join-lobby. Usa join-presenter-lobby.',
                reason: 'presenter-auth-required',
                code: 'PRESENTER_FLOW_INVALID_IN_JOIN_LOBBY'
            });
            return;
        }

        try {
            // Ejecutar Use Case (incluye validación, rate limit, comando, eventos)
            const result = await joinGameUseCase.execute({
                pin,
                sessionId,
                nickname,
                sessionSecret,
                socket,
                isTeamMode,
                teamConfig
            });

            if (!result.success) {
                emitJoinError(socket, result);
                return;
            }

            if (result.isReconnect) {
                await handleReconnectJoin({ socket, io, nickname, result, teamConfigs });
                return;
            }

            await emitJoinSuccess({ socket, nickname, result });

        } catch (error) {
            logger.error('Error in join-lobby handler', {
                error: error.message,
                stack: error.stack
            });
            socket.emit('join-error', { message: 'Error al unirse al lobby', code: 'JOIN_LOBBY_FAILED' });
        }
    };
};
