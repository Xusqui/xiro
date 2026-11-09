/**
 * @fileoverview Simple Event Handlers - Pause, Resume, Select Team, Leave, Error
 */

const { validateSocket, schemas } = require('../../validation');
const timerManager = require('../../services/timer.manager');
const logger = require('../../config/logger');
const { applyTeamMembership, emitLocalTeamUpdate } = require('../utils/TeamMembershipSync');
const { loadTimerState, saveTimerState, publishTimerChange } = require('../utils/TimerStateStore');

/**
 * Validación común para handlers de timer
 * Consolida código duplicado en pause/resume handlers
 */
function validateTimerRequest(socket, schema, roomIdOrPin) {
    const validation = validateSocket(schema, { roomIdOrPin });
    if (!validation.valid) {
        socket.emit('error', { message: validation.error });
        return null;
    }
    return String(roomIdOrPin);
}

/**
 * Pause Timer Handler
 */
function createPauseTimerHandler(dependencies) {
    const { timerPausedState, clearGameTimer, io } = dependencies;

    return async function handlePauseTimer(socket, roomIdOrPin) {
        logger.info('🔴 Backend: pause-timer handler CALLED', {
            roomIdOrPin,
            roomIdType: typeof roomIdOrPin,
            socketId: socket.id
        });

        const sPin = validateTimerRequest(socket, schemas.pauseTimer, roomIdOrPin);
        if (!sPin) {
            logger.error('🔴 Backend: validateTimerRequest FAILED', { roomIdOrPin });
            return;
        }

        logger.info('🔴 Backend: sPin validated', { sPin });

        const timerState = await loadTimerState(sPin, timerPausedState, 'pause');

        logger.debug('Backend: pause-timer recibido', {
            pin: sPin,
            timerStateExists: !!timerState,
            isPaused: timerState?.isPaused,
            allTimerStates: Array.from(timerPausedState.keys())
        });

        if (!timerState) {
            logger.error('Backend: No existe timerState para', sPin);
            return;
        }

        if (timerState.isPaused) {
            logger.warn('Backend: Timer ya está pausado para', sPin);
            return;
        }

        // Calcular tiempo restante
        const elapsed = (Date.now() - timerState.startTime) / 1000;
        timerState.remainingTime = Math.max(0, timerState.remainingTime - elapsed);
        timerState.isPaused = true;

        await saveTimerState(sPin, timerState, 'pause');

        // Cancelar timer actual
        clearGameTimer(sPin);

        // Notificar a todos los workers para que cancelen sus timers
        await publishTimerChange(sPin, 'pause');

        logger.debug('Backend: Timer pausado, emitiendo timer-paused', {
            pin: sPin,
            remainingTime: timerState.remainingTime
        });

        // Notificar a todos los clientes (sala base + sala presenter)
        io.to(sPin).emit('timer-paused', { remainingTime: timerState.remainingTime });
        io.to(sPin + ':presenter').emit('timer-paused', {
            remainingTime: timerState.remainingTime,
            serverNow: Date.now()
        });
    };
}

/**
 * Resume Timer Handler
 */
function createResumeTimerHandler(dependencies) {
    const { timerPausedState, gameTimers, io } = dependencies;

    return async function handleResumeTimer(socket, roomIdOrPin) {
        const sPin = validateTimerRequest(socket, schemas.resumeTimer, roomIdOrPin);
        if (!sPin) return;

        const timerState = await loadTimerState(sPin, timerPausedState, 'resume');

        logger.debug('Backend: resume-timer recibido', {
            pin: sPin,
            timerStateExists: !!timerState,
            isPaused: timerState?.isPaused
        });

        if (!timerState) {
            logger.error('Backend: No existe timerState para', sPin);
            return;
        }

        if (!timerState.isPaused) {
            logger.warn('Backend: Timer no está pausado para', sPin);
            return;
        }

        timerState.isPaused = false;
        timerState.startTime = Date.now();

        await saveTimerState(sPin, timerState, 'resume');

        // Reiniciar timer con el tiempo restante
        const { revelarResultadosAutomatico } = require('../utils/TimerManager');
        const resumeTimerId = timerManager.setTimeout(
            () => revelarResultadosAutomatico(sPin, io),
            timerState.remainingTime * 1000,
            'game-countdown',
            sPin
        );
        gameTimers.set(sPin, resumeTimerId);

        // Notificar a todos los workers que el timer se reanudó
        await publishTimerChange(sPin, 'resume');

        logger.debug('Backend: Timer reanudado, emitiendo timer-resumed', {
            pin: sPin,
            remainingTime: timerState.remainingTime
        });

        // Notificar a todos los clientes (sala base + sala presenter)
        io.to(sPin).emit('timer-resumed', { remainingTime: timerState.remainingTime });
        io.to(sPin + ':presenter').emit('timer-resumed', {
            remainingTime: timerState.remainingTime,
            serverNow: Date.now()
        });
    };
}

/**
 * Select Team Handler
 */
function createSelectTeamHandler(dependencies) {
    const { teamConfigs, players, syncBus, io } = dependencies;

    return async function handleSelectTeam(socket, data) {
        // Joi da por válido un payload undefined; sin datos tiene que fallar la validación
        const validation = validateSocket(schemas.selectTeam, data ?? {});
        if (!validation.valid) {
            socket.emit('error', { message: validation.error });
            return;
        }

        const { pin, sessionId, nickname, teamIndex } = validation.value;
        const roomId = sessionId || pin;

        const currentTeamConfig = teamConfigs.get(roomId);
        if (!currentTeamConfig || !currentTeamConfig.isTeamMode) {
            return;
        }

        const teamConfig = currentTeamConfig;
        if (teamIndex < 0 || teamIndex >= teamConfig.teams.length) {
            return;
        }

        // Mover al jugador al equipo elegido (lo saca de cualquier otro)
        applyTeamMembership(teamConfig, { nickname, teamIndex });

        // Guardar equipo en player para reconexión
        const playerId = socket.data.playerId;
        if (playerId) {
            const player = players.get(playerId);
            if (player) {
                player.teamIndex = teamIndex;
                player.teamName = teamConfig.teams[teamIndex].name;
            }
        }

        // Publicar solo el cambio: publicar la configuración entera haría que dos
        // elecciones simultáneas en workers distintos se pisaran.
        await syncBus.publishTeamMembership(roomId, nickname, teamIndex);

        // Cada worker avisa a sus propios sockets al aplicar el cambio
        emitLocalTeamUpdate(io, roomId, teamConfig);
    };
}

/**
 * Leave Lobby Handler
 */
function createLeaveLobbyHandler(dependencies) {
    const { players, socketToPlayer, lobbyPlayers, activeGames, teamConfigs, syncBus, io } = dependencies;
    const resolvedSyncBus = syncBus || require('../sync/RedisSyncBus').RedisSyncBus.getInstance();

    function removePlayerFromTeams(roomId, nickname) {
        if (!teamConfigs) {
            return null;
        }

        const teamConfig = teamConfigs.get(roomId);
        return applyTeamMembership(teamConfig, { nickname, teamIndex: null }) ? teamConfig : null;
    }

    return async function handleLeaveLobby(socket) {
        const playerId = socketToPlayer.get(socket.id);
        if (!playerId) return;

        const player = players.get(playerId);
        if (!player) return;

        const { nickname, roomId } = player;

        // Remover de lobby
        const lobby = lobbyPlayers.get(roomId);
        if (lobby) {
            const idx = lobby.indexOf(nickname);
            if (idx !== -1) {
                lobby.splice(idx, 1);

                // CRÍTICO: Sincronizar con otros workers vía Redis
                await resolvedSyncBus.publishLobbyPlayerLeft(roomId, nickname);
            }
        }

        // Remover del equipo para evitar miembros fantasma al volver con otro nickname
        const updatedTeamConfig = removePlayerFromTeams(roomId, nickname);
        if (updatedTeamConfig) {
            await resolvedSyncBus.publishTeamMembership(roomId, nickname, null);
            emitLocalTeamUpdate(io, roomId, updatedTeamConfig);
        }

        // Remover del juego activo y verificar si todos respondieron
        const { removePlayerFromActiveGame } = require('../utils/GamePlayerRemover');
        await removePlayerFromActiveGame({
            roomId,
            nickname,
            activeGames,
            players,
            io
        });

        // Remover player y socket mapping
        players.delete(playerId);
        socketToPlayer.delete(socket.id);

        // Desconectar socket
        socket.leave(roomId);
        socket.leave(roomId + ':players');

        // Obtener lista actualizada
        const { getPlayersInRoom } = require('../utils/GameUtils');
        const playersInRoom = await getPlayersInRoom(roomId, io);

        // Notificar con lista actualizada
        io.to(roomId).emit('player-left', {
            nickname,
            players: playersInRoom
        });
    };
}

/**
 * Validate Session Handler
 * Valida si un sessionId o PIN existe antes de que el usuario introduzca su nombre
 */
/** Responde que la sesión no es válida (formato, inexistente o error al validarla). */
function emitSessionInvalid(socket, reason, message, code) {
    socket.emit('session-validation-result', { valid: false, reason, message, code });
}

/**
 * Dónde está viva la sala: en el lobby o en la partida de este worker o, si no, en SessionStore
 * (otro worker). Mira la sala activa, no solo que el PIN exista en la base de datos.
 * @param {string} roomId - Sala (el sessionId completo)
 * @param {Map} lobbyPlayers - Lobbys de este worker
 * @param {Map} activeGames - Partidas de este worker
 * @returns {Promise<{lobbyExists: boolean, gameExists: boolean, redisSessionExists: boolean, redisSessionEnded:
 *   boolean}>}
 */
async function findSessionPresence(roomId, lobbyPlayers, activeGames) {
    const lobbyExists = lobbyPlayers.has(roomId);
    const gameExists = activeGames.has(roomId);
    let redisSessionExists = false;
    let redisSessionEnded = false;

    // Fallback cross-worker: si este worker no tiene la sala en memoria,
    // consultar SessionStore en Redis para evitar falsos negativos.
    if (!lobbyExists && !gameExists) {
        try {
            const SessionStore = require('../../services/SessionStore');
            const sessionState = await SessionStore.load(roomId);
            redisSessionExists = !!sessionState;
            redisSessionEnded = Boolean(sessionState?.ended);
        } catch (redisErr) {
            logger.warn('Session validation Redis fallback failed', {
                sessionId: roomId,
                roomId,
                error: redisErr.message
            });
        }
    }

    return { lobbyExists, gameExists, redisSessionExists, redisSessionEnded };
}

/**
 * Crea el handler del evento 'validate-session'. Comprueba si la sesión sigue viva (lobby, partida o sesión en Redis) y
 * responde al socket.
 * @param {Object} dependencies - Maps de globalState, io y servicios (ver socket.handlers.js)
 * @returns {function(socket, data): Promise<void>} Handler
 */
function createValidateSessionHandler(dependencies) {
    const { lobbyPlayers, activeGames } = dependencies;

    return async function handleValidateSession(socket, data) {
        const { sessionId } = data || {};

        if (!sessionId || typeof sessionId !== 'string') {
            emitSessionInvalid(socket, 'invalid-format', 'Formato de sesión inválido', 'SESSION_FORMAT_INVALID');
            return;
        }

        try {
            // Extraer PIN del sessionId (formato: PIN-XXXX)
            const pin = sessionId.split('-')[0];
            const roomId = sessionId; // El roomId completo es el sessionId
            const presence = await findSessionPresence(roomId, lobbyPlayers, activeGames);

            logger.info('Session validation check', {
                sessionId,
                pin,
                roomId,
                ...presence,
                totalLobbies: lobbyPlayers.size,
                totalGames: activeGames.size
            });

            const sessionIsLive =
                presence.lobbyExists ||
                presence.gameExists ||
                (presence.redisSessionExists && !presence.redisSessionEnded);

            if (!sessionIsLive) {
                logger.warn('Session validation failed - room not found', { sessionId, roomId });
                emitSessionInvalid(
                    socket,
                    'session-not-exist',
                    'La sesión no existe o no es válida',
                    'SESSION_NOT_FOUND'
                );
                return;
            }

            logger.info('Session validation successful', {
                sessionId,
                roomId,
                inLobby: presence.lobbyExists,
                inGame: presence.gameExists,
                viaRedis: presence.redisSessionExists
            });
            socket.emit('session-validation-result', { valid: true, sessionId });
        } catch (error) {
            logger.error('Error validating session', { error: error.message, sessionId });
            emitSessionInvalid(socket, 'validation-error', 'Error al validar la sesión', 'SESSION_VALIDATION_ERROR');
        }
    };
}

/**
 * Error Handler
 */
function createErrorHandler() {
    return function handleError(socket, error) {
        const logger = require('../../config/logger');
        logger.error('Socket error', {
            socketId: socket.id,
            error: error.message
        });
    };
}

module.exports = {
    createPauseTimerHandler,
    createResumeTimerHandler,
    createSelectTeamHandler,
    createLeaveLobbyHandler,
    createValidateSessionHandler,
    createErrorHandler
};
