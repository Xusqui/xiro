/**
 * @fileoverview Join Game Command - Comando para unirse a un lobby
 * @module application/commands/JoinGameCommand
 * 
 * Encapsula toda la lógica de unirse a un juego:
 * - Validación de PIN (presenter vs player)
 * - Validación de jugador (duplicados, capacidad)
 * - Gestión de equipos (si aplica)
 * - Registro del jugador en Maps
 * - Unión a rooms de Socket.IO
 * - Sincronización Redis
 * - Emisión de eventos
 */

const crypto = require('crypto');
const Command = require('./Command');
const { PlayerJoinedEvent } = require('../../domain/events/GameEvents');
const EventBus = require('../../domain/events/EventBus');
const { RedisSyncBus } = require('../../sockets/sync/RedisSyncBus');
const { validatePinCached, validatePinForPresenter, validatePlayerJoin } = require('../../sockets/validators/GameValidators');
const { validateJoinGameInput } = require('../validators/JoinGameValidator');
const { addPlayerToLobby } = require('../../sockets/utils/LobbyPlayerSync');
const SessionStore = require('../../services/SessionStore');
const logger = require('../../config/logger');

const PRESENTER_NICKNAME = 'HOST';

function normalizeSessionSecret(secret) {
    return typeof secret === 'string' ? secret.trim() : '';
}

function compareSessionSecrets(providedSecret, expectedSecret) {
    const provided = normalizeSessionSecret(providedSecret);
    const expected = normalizeSessionSecret(expectedSecret);
    if (!provided || !expected) return false;

    try {
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch (_) {
        return false;
    }
}

function isReclaimableDisconnectedStatus(status) {
    return status === 'disconnected' || status === 'presenter_disconnected';
}

/**
 * Comando para unirse a un juego
 */
class JoinGameCommand extends Command {
    /**
     * @param {Object} payload
     * @param {string} payload.pin - PIN de la partida
     * @param {string} payload.sessionId - ID de sesión (opcional)
     * @param {string} payload.nickname - Nombre del jugador
     * @param {Object} payload.socket - Socket del jugador
     * @param {boolean} [payload.isTeamMode] - Modo equipos (solo HOST)
     * @param {Object} [payload.teamConfig] - Configuración equipos (solo HOST)
     */
    constructor(payload) {
        super(payload);
    }

    /**
     * Validar datos del comando
     */
    validate() {
        return validateJoinGameInput(this.payload);
    }

    _createExecutionContext(deps) {
        const {
            players,
            socketToPlayer,
            lobbyPlayers,
            teamConfigs,
            activeGames,
            roomPresenterMap
        } = deps;

        const { pin, sessionId, nickname, sessionSecret, socket, isTeamMode, teamConfig } = this.payload;
        const sPin = String(pin).toUpperCase();
        const roomId = sessionId || sPin;

        return {
            players,
            socketToPlayer,
            lobbyPlayers,
            teamConfigs,
            activeGames,
            roomPresenterMap,
            pin,
            sessionId,
            nickname,
            sessionSecret,
            socket,
            isTeamMode,
            teamConfig,
            sPin,
            roomId,
            syncBus: RedisSyncBus.getInstance()
        };
    }

    _validatePresenterSessionId(context) {
        const { nickname, sessionId, sPin } = context;
        if (nickname !== PRESENTER_NICKNAME || !sessionId) {
            return null;
        }

        const sessionPrefix = `${sPin}-`;
        if (String(sessionId).startsWith(sessionPrefix)) {
            return null;
        }

        return {
            success: false,
            error: 'SessionId inválido para este PIN',
            reason: 'invalid-session-id',
            code: 'INVALID_SESSION_ID_FOR_PIN'
        };
    }

    async _saveTeamConfigIfNeeded(context) {
        const { nickname, isTeamMode, teamConfig, teamConfigs, roomId, syncBus } = context;
        if (nickname !== PRESENTER_NICKNAME || !isTeamMode || !teamConfig) {
            return;
        }

        const config = {
            isTeamMode: true,
            teams: teamConfig.teams.map(team => ({
                ...team,
                players: [],
                score: 0
            }))
        };

        teamConfigs.set(roomId, config);
        await syncBus.publishTeamConfig(roomId, config);

        logger.info('Team configuration saved', {
            roomId,
            teams: config.teams.length
        });
    }

    async _validatePin(context) {
        const { nickname, sPin, sessionId } = context;

        if (nickname === PRESENTER_NICKNAME) {
            const pinValidation = await validatePinForPresenter(sPin);
            if (pinValidation.valid) {
                return null;
            }

            return {
                success: false,
                error: 'PIN no válido o no visible para presentador',
                reason: 'pin-not-found',
                code: 'PRESENTER_PIN_NOT_VISIBLE'
            };
        }

        const idToValidate = sessionId ? sessionId.split('-')[0] : sPin;
        const pinValidation = await validatePinCached(idToValidate);

        if (pinValidation.valid) {
            return null;
        }

        return {
            success: false,
            error: 'La sesión no existe o no es válida',
            reason: 'session-not-exist',
            code: 'SESSION_NOT_FOUND'
        };
    }

    async _ensurePlayerSessionExists(context) {
        const { nickname, sessionId, lobbyPlayers, activeGames, roomId } = context;
        if (nickname === PRESENTER_NICKNAME || !sessionId) {
            return null;
        }

        const sessionExists = lobbyPlayers.has(roomId) || activeGames.has(roomId);
        if (sessionExists) {
            return null;
        }

        let redisSession = null;
        try {
            redisSession = await SessionStore.load(roomId);
        } catch (error) {
            logger.warn('Failed to load session marker from Redis', {
                roomId,
                error: error.message
            });
        }

        if (redisSession && !redisSession.ended) {
            return null;
        }

        return {
            success: false,
            error: 'La sesión de juego no existe o no está activa',
            reason: 'session-not-exist',
            code: 'SESSION_NOT_FOUND'
        };
    }

    _buildFallbackPlayerId(socket) {
        return socket.handshake.auth?.playerId ||
            `player_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    _validatePresenterReclaim(context, fallbackPlayerId) {
        const { nickname, players, roomId, sessionSecret } = context;
        if (nickname !== PRESENTER_NICKNAME) {
            return null;
        }

        const existingPresenter = Array.from(players.values()).find(player =>
            player.roomId === roomId && (player.role === 'presenter' || player.nickname === PRESENTER_NICKNAME)
        );

        if (!existingPresenter || existingPresenter.id === fallbackPlayerId) {
            return null;
        }

        if (!isReclaimableDisconnectedStatus(existingPresenter.status)) {
            return {
                success: false,
                error: 'Ya hay un presentador conectado en esta sesión',
                reason: 'presenter-already-connected',
                code: 'PRESENTER_ALREADY_CONNECTED'
            };
        }

        if (compareSessionSecrets(sessionSecret, existingPresenter.sessionSecret)) {
            return null;
        }

        logger.warn('Presenter reclaim denied: invalid sessionSecret', {
            roomId,
            fallbackPlayerId,
            existingPresenterId: existingPresenter.id,
            nickname
        });

        return {
            success: false,
            error: 'No autorizado para recuperar la sesión del presentador',
            reason: 'invalid-session-secret',
            code: 'PRESENTER_RECLAIM_UNAUTHORIZED'
        };
    }

    async _validateAndResolvePlayer(context, fallbackPlayerId) {
        const { nickname, roomId, socket } = context;

        const playerValidation = await validatePlayerJoin(
            fallbackPlayerId,
            nickname,
            roomId,
            socket,
            false
        );

        if (!playerValidation.valid) {
            return {
                success: false,
                error: playerValidation.message,
                reason: playerValidation.reason,
                code: playerValidation.code,
                params: playerValidation.params
            };
        }

        const existingPlayer = playerValidation.existingPlayer || playerValidation.player;
        const playerId = existingPlayer?.id || fallbackPlayerId;

        return {
            success: true,
            playerId,
            existingPlayer
        };
    }

    _buildPlayerData(context, playerId, existingPlayer) {
        const isPresenter = context.nickname === PRESENTER_NICKNAME;
        const playerData = existingPlayer || {
            id: playerId,
            nickname: context.nickname,
            roomId: context.roomId,
            role: isPresenter ? 'presenter' : 'player',
            status: isPresenter ? 'presenter_lobby' : 'lobby_waiting',
            socketId: context.socket.id,
            lastSeen: Date.now(),
            answeredQuestions: new Set(),
            answers: {},
            sessionSecret: crypto.randomBytes(24).toString('hex')
        };

        playerData.roomId = context.roomId;
        playerData.socketId = context.socket.id;
        playerData.status = isPresenter ? 'presenter_lobby' : 'lobby_waiting';
        playerData.lastSeen = Date.now();

        if (!isPresenter && playerData.status === 'lobby_waiting') {
            playerData.expiresAt = null;
        }

        if (!playerData.role) {
            playerData.role = isPresenter ? 'presenter' : 'player';
        }

        if (isPresenter && !playerData.sessionSecret) {
            playerData.sessionSecret = crypto.randomBytes(24).toString('hex');
        }

        return playerData;
    }

    _registerPlayerData(context, playerId, playerData) {
        context.players.set(playerId, playerData);
        context.socketToPlayer.set(context.socket.id, playerId);
    }

    _publishPlayerDataSync(context, playerId, playerData) {
        const serializablePlayer = {
            ...playerData,
            answeredQuestions: playerData.answeredQuestions instanceof Set
                ? Array.from(playerData.answeredQuestions)
                : (Array.isArray(playerData.answeredQuestions) ? playerData.answeredQuestions : [])
        };

        context.syncBus.publishPlayerData(playerId, serializablePlayer).catch(error => {
            logger.warn('Failed to publish player-data-sync', {
                playerId,
                error: error.message
            });
        });
    }

    _attachSocketData(context, playerId) {
        context.socket.data.playerId = playerId;
        context.socket.data.nickname = context.nickname;
        context.socket.data.roomId = context.roomId;
    }

    async _joinSocketRooms(context, playerId) {
        const { socket, roomId, nickname, roomPresenterMap } = context;
        const presenterRoom = `${roomId}:presenter`;
        const playersRoom = `${roomId}:players`;

        if (nickname === PRESENTER_NICKNAME) {
            await socket.join(presenterRoom);
            await socket.join(roomId);
            if (roomPresenterMap) {
                roomPresenterMap.set(roomId, playerId);
            }

            logger.info('Presenter joined rooms', {
                socketId: socket.id,
                nickname,
                roomId,
                rooms: [presenterRoom, roomId]
            });
            return;
        }

        await socket.join(playersRoom);
        await socket.join(roomId);
        logger.info('Player joined rooms', {
            socketId: socket.id,
            nickname,
            roomId,
            rooms: [playersRoom, roomId]
        });
    }

    async _syncLobby(context) {
        const { lobbyPlayers, roomId, nickname, syncBus } = context;
        const added = addPlayerToLobby(lobbyPlayers, roomId, nickname);

        if (added) {
            await syncBus.publishLobbyPlayerJoined(roomId, nickname);
        }

        if (nickname === PRESENTER_NICKNAME) {
            const SessionSaveDebouncer = require('../../services/SessionSaveDebouncer');
            SessionSaveDebouncer.reopen(roomId);

            SessionStore.save(roomId, {
                pin: context.sPin,
                sessionId: roomId,
                state: 'lobby',
                savedAt: Date.now()
            }).catch(error => {
                logger.warn('Failed to save lobby session marker to Redis', {
                    roomId,
                    error: error.message
                });
            });
        }

        return lobbyPlayers.get(roomId) || [];
    }

    _emitJoinedEvent(context, playerId, playersInLobby) {
        EventBus.emit('player.joined', new PlayerJoinedEvent({
            gameId: context.roomId,
            playerId,
            nickname: context.nickname,
            playerCount: playersInLobby.length
        }));
    }

    _logJoinResult(context, playerId, playersInLobby) {
        logger.info('Players in lobby after join', {
            roomId: context.roomId,
            nickname: context.nickname,
            playersInLobby,
            totalPlayers: playersInLobby.length
        });

        logger.info('Player joined lobby', {
            playerId,
            nickname: context.nickname,
            roomId: context.roomId,
            totalPlayers: playersInLobby.length
        });
    }

    _buildSuccessResponse(context, playerId, playerData, playersInLobby) {
        return {
            success: true,
            roomId: context.roomId,
            playerId,
            nickname: context.nickname,
            playersInLobby,
            teamMode: context.teamConfigs.get(context.roomId) || null,
            sessionSecret: playerData.sessionSecret
        };
    }

    _handleExecutionError(error, context) {
        logger.error('Error in JoinGameCommand', {
            error: error.message,
            stack: error.stack,
            roomId: context?.roomId,
            nickname: context?.nickname
        });

        return {
            success: false,
            error: 'Error al unirse al lobby',
            code: 'JOIN_LOBBY_FAILED'
        };
    }

    /**
     * Ejecutar comando - unir jugador al lobby
     * @param {Object} deps - Dependencias
     * @returns {Promise<Object>} Resultado de la operación
     */
    async execute(deps) {
        const validation = this.validate();
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', ')
            };
        }

        const context = this._createExecutionContext(deps);

        try {
            const presenterSessionError = this._validatePresenterSessionId(context);
            if (presenterSessionError) {
                return presenterSessionError;
            }

            await this._saveTeamConfigIfNeeded(context);

            const pinError = await this._validatePin(context);
            if (pinError) {
                return pinError;
            }

            const sessionError = await this._ensurePlayerSessionExists(context);
            if (sessionError) {
                return sessionError;
            }

            const fallbackPlayerId = this._buildFallbackPlayerId(context.socket);

            const presenterReclaimError = this._validatePresenterReclaim(context, fallbackPlayerId);
            if (presenterReclaimError) {
                return presenterReclaimError;
            }

            const playerValidation = await this._validateAndResolvePlayer(context, fallbackPlayerId);
            if (!playerValidation.success) {
                return playerValidation;
            }

            const { playerId, existingPlayer } = playerValidation;
            const playerData = this._buildPlayerData(context, playerId, existingPlayer);

            this._registerPlayerData(context, playerId, playerData);
            this._publishPlayerDataSync(context, playerId, playerData);
            this._attachSocketData(context, playerId);

            await this._joinSocketRooms(context, playerId);

            const playersInLobby = await this._syncLobby(context);

            this._emitJoinedEvent(context, playerId, playersInLobby);
            this._logJoinResult(context, playerId, playersInLobby);

            return this._buildSuccessResponse(context, playerId, playerData, playersInLobby);

        } catch (error) {
            return this._handleExecutionError(error, context);
        }
    }
}

module.exports = JoinGameCommand;
