/**
 * @fileoverview Reconnect Player Use Case - Flujo completo de reconexión
 * @module application/use-cases/ReconnectPlayerUseCase
 * 
 * Encapsula todo el flujo de negocio para reconectar un jugador:
 * 1. Validación
 * 2. Restaurar sesión (disconnect old, update state, setup socket)
 * 3. Construir snapshot de estado
 * 4. Emitir eventos
 */

const { findGameByPin } = require('../helpers/GameLookupHelper');
const ReconnectionService = require('../../sockets/services/ReconnectionService');
const TrivialReconnectService = require('../../sockets/services/TrivialReconnectService');
const EventBus = require('../../domain/events/EventBus');
const { PlayerJoinedEvent } = require('../../domain/events/GameEvents');
const logger = require('../../config/logger');

function validateLobbyPresence({ game, lobbyPlayers, roomId, nickname, players }) {
    if (game) {
        return null;
    }

    const lobby = lobbyPlayers.get(roomId) || [];
    const lobbyHasNick = lobby.includes(nickname);
    const hasPlayer = Array.from(players.values())
        .some(player => player.nickname === nickname && player.roomId === roomId);

    if (lobbyHasNick || hasPlayer) {
        return null;
    }

    return {
        success: false,
        reason: 'lobby-not-found',
        message: 'Lobby no encontrado',
        code: 'LOBBY_NOT_FOUND'
    };
}

function buildPlayerRejoinPayload({ nickname, player, game }) {
    return {
        nickname,
        playerId: player.id,
        score: player.score || 0,
        streak: game?.playerStreaks?.[nickname] || 0,
        streakInfo: game?.playerStreakInfos?.[nickname] || null,
        teamIndex: player.teamIndex,
        teamName: player.teamName
    };
}

class ReconnectPlayerUseCase {
    /**
     * Ejecutar el use case
     * @param {Object} context - Contexto de la reconexión
     * @param {Object} context.socket - Socket del jugador
     * @param {Object} context.data - Datos (pin, nickname)
     * @param {Object} context.dependencies - Dependencias (activeGames, players, etc.)
     * @returns {Promise<Object>} Resultado del procesamiento
     */
    async execute(context) {
        const { socket, data, dependencies } = context;
        const { activeGames, players, socketToPlayer, lobbyPlayers, io } = dependencies;
        const { pin, nickname } = data;

        try {
            // 1. Validar datos
            if (!pin || !nickname) {
                return {
                    success: false,
                    reason: 'missing-data',
                    message: 'PIN y nickname son requeridos',
                    code: 'PIN_NICKNAME_REQUIRED'
                };
            }

            // 2. Buscar juego usando helper consolidado (puede no existir en lobby)
            const lookupResult = findGameByPin(activeGames, pin);
            const game = lookupResult?.game || null;
            const roomId = lookupResult?.roomId || pin;

            const lobbyValidationError = validateLobbyPresence({
                game,
                lobbyPlayers,
                roomId,
                nickname,
                players
            });
            if (lobbyValidationError) {
                return lobbyValidationError;
            }

            // 3. Restaurar sesión usando ReconnectionService
            const reconnectResult = await ReconnectionService.reconnectPlayer({
                socket,
                nickname,
                roomId,
                game,
                players,
                socketToPlayer,
                lobbyPlayers,
                io
            });

            if (!reconnectResult.success) {
                return reconnectResult;
            }

            const player = reconnectResult.player;

            // 3.6: Restaurar rachas desde Redis al objeto game en memoria
            // Esto asegura que el servidor tenga la racha actualizada para:
            // - Aplicar bonus de racha en próximas respuestas
            // - Mostrar badge de racha en el presentador
            // - Mantener sincronía cross-worker
            if (game) {
                await ReconnectionService.restorePlayerStreaksFromRedis(game, nickname, roomId);
            }

            // 3.5: Comprobar si hay fase de tablero Trivial activa en Redis.
            // Se intenta SIEMPRE (no solo cuando game.isTrivial es true en este worker)
            // porque activeGames solo existe en el worker que procesó handleStart.
            // getTrivialBoardInfo hace un GET de Redis y devuelve null rápidamente si
            // no hay estado trivial, por lo que el coste en games no-trivial es mínimo.
            const trivialBoardInfo = await TrivialReconnectService.getTrivialBoardInfo(roomId);

            // 4. Obtener estado actual (snapshot) - ASYNC para cargar racha desde Redis
            const snapshot = await ReconnectionService.buildPlayerSnapshot(
                player,
                roomId,
                game,
                dependencies.teamConfigs,
                trivialBoardInfo
            );

            // 5. Enviar snapshot al jugador
            socket.emit('reconnected-success', snapshot);

            // 5.5: Si estamos en fase de tablero Trivial, re-emitir el evento exacto
            // que el cliente recibió originalmente para que los handlers existentes
            // restauren la pantalla (dado / casillas / categoría) sin nuevo código frontend.
            if (trivialBoardInfo?.isBoardPhase) {
                TrivialReconnectService.emitBoardEventToSocket(socket, trivialBoardInfo);
            }

            // 6. Notificar a todos en la sala con información completa del jugador
            // Incluir racha para que el presentador actualice el badge correctamente
            const playerReconnectData = buildPlayerRejoinPayload({ nickname, player, game });
            io.to(roomId).emit('player-rejoined', playerReconnectData);

            // 7. Emitir evento de dominio
            EventBus.emit('player.joined', new PlayerJoinedEvent({
                gameId: roomId,
                playerId: player.id,
                nickname: player.nickname,
                roomId,
                isReconnection: true,
                timestamp: Date.now()
            }));

            return {
                success: true,
                player,
                snapshot
            };

        } catch (error) {
            logger.error('Error in ReconnectPlayerUseCase', {
                error: error.message,
                stack: error.stack,
                pin,
                nickname
            });

            return {
                success: false,
                reason: 'server-error',
                message: 'Error al reconectar jugador',
                code: 'RECONNECT_PLAYER_FAILED'
            };
        }
    }
}

module.exports = ReconnectPlayerUseCase;
