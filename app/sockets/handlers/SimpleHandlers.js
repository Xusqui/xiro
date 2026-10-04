/**
 * @fileoverview Simple Event Handlers - Pause, Resume, Select Team, Leave, Error
 */

const { validateSocket, schemas } = require('../../validation');
const timerManager = require('../../services/timer.manager');
const logger = require('../../config/logger');
const { applyTeamMembership, emitLocalTeamUpdate } = require('../utils/TeamMembershipSync');

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

        // Refrescar SIEMPRE desde Redis para evitar estado local obsoleto entre workers/preguntas
        let timerState = null;
        try {
            const { getRedisClient } = require('../../config/redis');
            const redis = await getRedisClient();
            const redisState = await redis.hGetAll(`timer:state:${sPin}`);

            logger.info('🔴 Redis state loaded', { sPin, redisState });

            if (redisState && redisState.startTime) {
                timerState = {
                    isPaused: redisState.isPaused === '1',
                    startTime: Number(redisState.startTime),
                    remainingTime: Number(redisState.remainingTime)
                };
                // Cache local alineado con Redis
                timerPausedState.set(sPin, timerState);
                logger.info('Timer state loaded from Redis', { sPin, isPaused: timerState.isPaused });
            } else {
                // Evitar reutilizar valores viejos si Redis no tiene estado para esta sala
                timerPausedState.delete(sPin);
            }
        } catch (err) {
            logger.warn('Failed to load timer state from Redis', { error: err.message });
            // Fallback a local solo si Redis falla
            timerState = timerPausedState.get(sPin) || null;
        }

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

        // Guardar estado pausado en Redis
        try {
            const { getRedisClient } = require('../../config/redis');
            const redis = await getRedisClient();
            await redis.hSet(`timer:state:${sPin}`, {
                isPaused: '1',
                startTime: String(timerState.startTime),
                remainingTime: String(timerState.remainingTime)
            });
            logger.debug('Paused state saved to Redis', { sPin, isPaused: true, remainingTime: timerState.remainingTime });
        } catch (err) {
            logger.warn('Failed to save paused state to Redis', { error: err.message });
        }

        // Cancelar timer actual
        clearGameTimer(sPin);

        // Notificar a todos los workers para que cancelen sus timers
        try {
            const { RedisSyncBus } = require('../sync/RedisSyncBus');
            await RedisSyncBus.getInstance().publishTimerPaused(sPin);
        } catch (err) {
            logger.warn('Failed to publish timer paused event', { error: err.message });
        }

        logger.debug('Backend: Timer pausado, emitiendo timer-paused', {
            pin: sPin,
            remainingTime: timerState.remainingTime
        });

        // Notificar a todos los clientes (sala base + sala presenter)
        io.to(sPin).emit('timer-paused', { remainingTime: timerState.remainingTime });
        io.to(sPin + ':presenter').emit('timer-paused', { remainingTime: timerState.remainingTime });
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

        // Refrescar SIEMPRE desde Redis para evitar estado local obsoleto entre workers/preguntas
        let timerState = null;
        try {
            const { getRedisClient } = require('../../config/redis');
            const redis = await getRedisClient();
            const redisState = await redis.hGetAll(`timer:state:${sPin}`);

            if (redisState && redisState.startTime) {
                timerState = {
                    isPaused: redisState.isPaused === '1',
                    startTime: Number(redisState.startTime),
                    remainingTime: Number(redisState.remainingTime)
                };
                timerPausedState.set(sPin, timerState);
                logger.info('Timer state loaded from Redis for resume', {
                    sPin,
                    isPaused: timerState.isPaused
                });
            } else {
                timerPausedState.delete(sPin);
            }
        } catch (err) {
            logger.warn('Failed to load timer state from Redis', { error: err.message });
            // Fallback a local solo si Redis falla
            timerState = timerPausedState.get(sPin) || null;
        }

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

        // Guardar estado reanudado en Redis
        try {
            const { getRedisClient } = require('../../config/redis');
            const redis = await getRedisClient();
            await redis.hSet(`timer:state:${sPin}`, {
                isPaused: '0',
                startTime: String(timerState.startTime),
                remainingTime: String(timerState.remainingTime)
            });
            logger.debug('Resumed state saved to Redis', { sPin, isPaused: false, remainingTime: timerState.remainingTime });
        } catch (err) {
            logger.warn('Failed to save resumed state to Redis', { error: err.message });
        }

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
        try {
            const { RedisSyncBus } = require('../sync/RedisSyncBus');
            await RedisSyncBus.getInstance().publishTimerResumed(sPin);
        } catch (err) {
            logger.warn('Failed to publish timer resumed event', { error: err.message });
        }

        logger.debug('Backend: Timer reanudado, emitiendo timer-resumed', {
            pin: sPin,
            remainingTime: timerState.remainingTime
        });

        // Notificar a todos los clientes (sala base + sala presenter)
        io.to(sPin).emit('timer-resumed', { remainingTime: timerState.remainingTime });
        io.to(sPin + ':presenter').emit('timer-resumed', { remainingTime: timerState.remainingTime });
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
    const {
        players,
        socketToPlayer,
        lobbyPlayers,
        activeGames,
        teamConfigs,
        syncBus,
        io
    } = dependencies;
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
function createValidateSessionHandler(dependencies) {
    const { lobbyPlayers, activeGames } = dependencies;

    return async function handleValidateSession(socket, data) {
        const logger = require('../../config/logger');
        const SessionStore = require('../../services/SessionStore');

        const { sessionId } = data || {};

        if (!sessionId || typeof sessionId !== 'string') {
            socket.emit('session-validation-result', {
                valid: false,
                reason: 'invalid-format',
                message: 'Formato de sesión inválido',
                code: 'SESSION_FORMAT_INVALID'
            });
            return;
        }

        try {
            // Extraer PIN del sessionId (formato: PIN-UUID)
            const pin = sessionId.split('-')[0];
            const roomId = sessionId; // El roomId completo es el sessionId

            // 🔍 VERIFICAR SI LA ROOM ESTÁ ACTIVA (no solo si el PIN existe en BD)
            // Buscar en lobbyPlayers (juegos que están en lobby esperando jugadores)
            const lobbyExists = lobbyPlayers.has(roomId);

            // Buscar en activeGames (juegos que ya empezaron)
            const gameExists = activeGames.has(roomId);

            // Fallback cross-worker: si este worker no tiene la sala en memoria,
            // consultar SessionStore en Redis para evitar falsos negativos.
            let redisSessionExists = false;
            let redisSessionEnded = false;
            if (!lobbyExists && !gameExists) {
                try {
                    const sessionState = await SessionStore.load(roomId);
                    redisSessionExists = !!sessionState;
                    redisSessionEnded = Boolean(sessionState?.ended);
                } catch (redisErr) {
                    logger.warn('Session validation Redis fallback failed', {
                        sessionId,
                        roomId,
                        error: redisErr.message
                    });
                }
            }

            logger.info('Session validation check', {
                sessionId,
                pin,
                roomId,
                lobbyExists,
                gameExists,
                redisSessionExists,
                redisSessionEnded,
                totalLobbies: lobbyPlayers.size,
                totalGames: activeGames.size
            });

            const sessionIsLive = lobbyExists
                || gameExists
                || (redisSessionExists && !redisSessionEnded);

            if (!sessionIsLive) {
                logger.warn('Session validation failed - room not found', { sessionId, roomId });
                socket.emit('session-validation-result', {
                    valid: false,
                    reason: 'session-not-exist',
                    message: 'La sesión no existe o no es válida',
                    code: 'SESSION_NOT_FOUND'
                });
                return;
            }

            logger.info('Session validation successful', {
                sessionId,
                roomId,
                inLobby: lobbyExists,
                inGame: gameExists,
                viaRedis: redisSessionExists
            });
            socket.emit('session-validation-result', {
                valid: true,
                sessionId
            });

        } catch (error) {
            logger.error('Error validating session', {
                error: error.message,
                sessionId
            });
            socket.emit('session-validation-result', {
                valid: false,
                reason: 'validation-error',
                message: 'Error al validar la sesión',
                code: 'SESSION_VALIDATION_ERROR'
            });
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
