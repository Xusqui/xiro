/**
 * @fileoverview Validaciones de juego y jugadores
 * @module sockets/validators/GameValidators
 */

const dbService = require('../../services/db.service');
const { players, lobbyPlayers, pinValidationCache, socketRateLimits } = require('../../state/globalState');
const { MAX_TOTAL_PLAYERS, MAX_JOIN_ATTEMPTS, RATE_LIMIT_WINDOW_MS } = require('../../config/constants');
const runtimeConfig = require('../../config/runtime-config');
const { findPlayerByNickname } = require('../utils/PlayerLookupHelper');
const logger = require('../../config/logger');

const DISCONNECTED_STATUSES = new Set(['disconnected', 'presenter_disconnected']);

function normalizeRoomIdentifiers(roomId) {
    const sRoomId = String(roomId);
    const sPin = sRoomId.includes('-') ? sRoomId.split('-')[0] : sRoomId;
    return { sRoomId, sPin };
}

function invalidJoin(reason, message, code, params) {
    return { valid: false, reason, message, ...(code && { code }), ...(params && { params }) };
}

function canReclaimDisconnectedNickname(existingPlayerWithNick, isReconnect) {
    if (!existingPlayerWithNick || isReconnect) {
        return false;
    }

    const now = Date.now();
    return DISCONNECTED_STATUSES.has(existingPlayerWithNick.status)
        && (!existingPlayerWithNick.expiresAt || now <= existingPlayerWithNick.expiresAt);
}

function hasNicknameInLobby(lobby, nickname) {
    return lobby.some(nick => {
        const lobbyNick = typeof nick === 'string' ? nick : nick.nickname;
        return lobbyNick === nickname;
    });
}

function validateCapacityConstraints(lobbyLength, isReconnect) {
    if (isReconnect) {
        return null;
    }

    if (players.size >= MAX_TOTAL_PLAYERS) {
        return invalidJoin('max-players-total', `Servidor lleno (${MAX_TOTAL_PLAYERS} jugadores)`, 'SERVER_FULL', { max: MAX_TOTAL_PLAYERS });
    }

    const maxPlayersPerGame = runtimeConfig.get('MAX_PLAYERS_PER_GAME');
    if (lobbyLength >= maxPlayersPerGame) {
        return invalidJoin('max-players-game', `Partida llena (${maxPlayersPerGame} jugadores)`, 'ROOM_FULL', { max: maxPlayersPerGame });
    }

    return null;
}

function validateJoinAttempts(playerId, isReconnect) {
    if (isReconnect) {
        return null;
    }

    const existingPlayer = players.get(playerId);
    if (existingPlayer && existingPlayer.joinAttempts >= MAX_JOIN_ATTEMPTS) {
        return invalidJoin('too-many-attempts', 'Demasiados intentos de conexión', 'TOO_MANY_JOIN_ATTEMPTS');
    }

    return null;
}

/**
 * Cache de validación de PINs para reducir queries a DB
 */
async function validatePinCached(pin) {
    const sPin = String(pin);

    if (pinValidationCache.has(sPin)) {
        const cached = pinValidationCache.get(sPin);
        if (Date.now() - cached.timestamp < 60000) { //1min cache
            return cached.result;
        }
    }

    const result = await dbService.validatePinInDatabase(sPin);
    pinValidationCache.set(sPin, {
        result,
        timestamp: Date.now()
    });

    return result;
}

/**
 * Validación de PIN para presentador
 */
async function validatePinForPresenter(pin) {
    const sPin = String(pin);
    const exists = await validatePinCached(sPin);

    if (!exists || exists.valid !== true) {
        return {
            valid: false,
            reason: 'pin-not-found'
        };
    }

    return { valid: true };
}

/**
 * Validación compleja para join de jugador
 */
async function validatePlayerJoin(playerId, nickname, roomId, socket, isReconnect = false) {
    const { sRoomId, sPin } = normalizeRoomIdentifiers(roomId);

    // 1. Validar PIN
    const pinExists = await validatePinCached(sPin);
    if (!pinExists || pinExists.valid !== true) {
        return invalidJoin('session-not-exist', 'La sesión no existe', 'SESSION_NOT_FOUND');
    }

    // 2. Validar lobby existe (o crearlo si no existe)
    // Nota: El lobby se crea en join-lobby si no existe, así que esto es solo informativo
    // No rechazamos si el lobby no existe, solo lo verificamos para jugadores existentes
    const lobby = lobbyPlayers.get(sRoomId) || [];

    // 3. Detectar si es un jugador desconectado intentando recuperar nickname
    // Verificar en dos fuentes:
    // a) En el Map de players (jugadores ya procesados)
    // b) En el array lobby (puede tener jugadores que aún no están en players por race condition)

    // OPTIMIZADO: findPlayerByNickname evita Array.from() innecesario (O(n) → O(n) pero más eficiente)
    const existingPlayerWithNick = findPlayerByNickname(players, nickname, sRoomId, playerId);
    if (canReclaimDisconnectedNickname(existingPlayerWithNick, isReconnect)) {
        return {
            valid: true,
            isReclaim: true,
            existingPlayer: existingPlayerWithNick
        };
    }

    // 4. Validar capacidad total
    const capacityError = validateCapacityConstraints(lobby.length, isReconnect);
    if (capacityError) {
        return capacityError;
    }

    // 6. Validar nickname duplicado en este lobby
    const nicknameInLobby = hasNicknameInLobby(lobby, nickname);

    if ((existingPlayerWithNick || nicknameInLobby) && !isReconnect) {
        return invalidJoin('nickname-taken', 'Nombre ya en uso en esta sala', 'NAME_TAKEN');
    }

    // 6. Validar rate limiting de intentos
    const attemptsError = validateJoinAttempts(playerId, isReconnect);
    if (attemptsError) {
        return attemptsError;
    }

    return { valid: true };
}

/**
 * Verificar si se puede agregar un jugador
 */
function canAddPlayer() {
    const currentSize = players.size;
    const canAdd = currentSize < MAX_TOTAL_PLAYERS;

    if (!canAdd) {
        logger.warn(`No se puede agregar jugador: ${currentSize}/${MAX_TOTAL_PLAYERS}`);
    }

    return canAdd;
}

/**
 * Verificar rate limit de socket
 */
function checkRateLimit(socketId) {
    const now = Date.now();

    if (!socketRateLimits.has(socketId)) {
        socketRateLimits.set(socketId, {
            firstAttempt: now,
            attempts: 1
        });
        return true;
    }

    const limitData = socketRateLimits.get(socketId);

    if (now - limitData.firstAttempt > RATE_LIMIT_WINDOW_MS) {
        socketRateLimits.set(socketId, {
            firstAttempt: now,
            attempts: 1
        });
        return true;
    }

    limitData.attempts++;

    if (limitData.attempts > MAX_JOIN_ATTEMPTS) {
        return false;
    }

    return true;
}

module.exports = {
    validatePinCached,
    validatePinForPresenter,
    validatePlayerJoin,
    canAddPlayer,
    checkRateLimit
};
