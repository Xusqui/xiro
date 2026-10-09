/**
 * @fileoverview Remote Control Helper
 * Gestiona el evento `join-remote-presenter`: permite a un admin unirse como
 * presentador adicional sin desconectar al presentador original (PC).
 *
 * El socket remoto se une a las mismas salas de presentador y puede emitir
 * next-question, reveal-answer y end-game con el sessionId de la partida.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/constants');
const logger = require('../../config/logger');
const { validatePinCached } = require('../validators/GameValidators');

/** @type {Map<string, Set<string>>} roomId → Set de socketIds remotos */
const remotePresenterSockets = new Map();

/**
 * Registra un socket remoto para la sala indicada.
 * @param {string} roomId
 * @param {string} socketId
 */
function addRemotePresenter(roomId, socketId) {
    if (!remotePresenterSockets.has(roomId)) {
        remotePresenterSockets.set(roomId, new Set());
    }
    remotePresenterSockets.get(roomId).add(socketId);
}

/**
 * Elimina un socket remoto de la sala.
 * @param {string} roomId
 * @param {string} socketId
 */
function removeRemotePresenter(roomId, socketId) {
    const sockets = remotePresenterSockets.get(roomId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) remotePresenterSockets.delete(roomId);
}

/**
 * Valida que el token sea JWT admin válido.
 * @param {string} token
 * @returns {Object|null} Payload decodificado o null si inválido/no-admin
 */
function validateAdminToken(token) {
    const panelUser = validatePanelToken(token, ['admin']);
    return panelUser;
}

/**
 * Valida que el token pertenezca a un usuario del panel con rol permitido.
 * @param {string} token
 * @param {string[]} allowedRoles
 * @returns {Object|null}
 */
function validatePanelToken(token, allowedRoles = ['admin', 'editor']) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || typeof decoded.role !== 'string') return null;
        return allowedRoles.includes(decoded.role) ? decoded : null;
    } catch {
        return null;
    }
}

/**
 * Busca la sesión activa por PIN en activeGames y lobbyPlayers.
 * @param {string} pin
 * @param {Map} activeGames
 * @param {Map} lobbyPlayers
 * @returns {{sessionId: string, game: Object|null}|null}
 */
function findSessionByPin(pin, activeGames, lobbyPlayers) {
    const pinStr = String(pin);

    for (const [sessionId, game] of activeGames.entries()) {
        const gamePin = game.pin
            || (sessionId.includes('-') ? sessionId.split('-')[0] : sessionId);
        if (gamePin === pinStr) return { sessionId, game };
    }

    for (const [sessionId] of (lobbyPlayers || new Map()).entries()) {
        const lobbyPin = sessionId.includes('-') ? sessionId.split('-')[0] : sessionId;
        if (lobbyPin === pinStr) return { sessionId, game: null };
    }

    return null;
}

/**
 * Busca la sesión activa por su sessionId exacto (PIN-UUID).
 * Evita la ambigüedad de findSessionByPin cuando hay varias sesiones con el mismo PIN.
 * @param {string} sessionId
 * @param {Map} activeGames
 * @param {Map} lobbyPlayers
 * @returns {{sessionId: string, game: Object|null}|null}
 */
function findSessionById(sessionId, activeGames, lobbyPlayers) {
    const id = String(sessionId);
    if (activeGames.has(id)) return { sessionId: id, game: activeGames.get(id) };
    if (lobbyPlayers?.has(id)) return { sessionId: id, game: null };
    return null;
}

/**
 * Construye el snapshot inicial enviado al control remoto.
 * @param {string} sessionId
 * @param {Object|null} game
 * @param {Map} lobbyPlayers
 * @returns {Object}
 */
function buildRemoteSnapshot(sessionId, game, lobbyPlayers, gameType = null, teamConfigs = null) {
    // El presentador entra al lobby como 'HOST': no cuenta como jugador
    const lobbyNicks = (lobbyPlayers?.get(sessionId) || []).filter(nick => nick !== 'HOST');
    const lobbyCount = lobbyNicks.length;
    if (!game) {
        return {
            sessionId,
            state: 'lobby',
            gameType,
            players: lobbyNicks,
            playerCount: lobbyCount,
            currentIndex: 0,
            totalQuestions: 0,
            scores: {},
            teamConfig: teamConfigs?.get(sessionId) || null
        };
    }
    return {
        sessionId,
        pin: game.pin,
        state: game.state || 'active',
        gameType: gameType || (game.isTrivial ? 'trivial' : null),
        currentIndex: game.currentIndex ?? 0,
        totalQuestions: game.questions?.length ?? 0,
        playerCount: game.players?.length ?? lobbyCount,
        canAnswer: game.canAnswer ?? false,
        scores: game.scores || {},
        teamConfig: teamConfigs?.get(sessionId) || null
    };
}

/**
 * Obtiene el token admin del payload o, si falta, de la cookie `adminToken`.
 * @param {Object} socket
 * @param {Object} data
 * @returns {string|undefined}
 */
function resolveRemoteToken(socket, data) {
    if (data?.token) return data.token;
    const cookieHeader = socket.handshake?.headers?.cookie;
    const match = cookieHeader && cookieHeader.match(/(?:^|;\s*)adminToken=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Localiza la sesión pedida: por sessionId (sin ambigüedad) o, en URLs antiguas, por PIN.
 * @returns {{found: Object}|{error: Object}}
 */
function resolveRemoteSession(requestedId, pin, activeGames, lobbyPlayers) {
    if (requestedId) {
        const found = findSessionById(requestedId, activeGames, lobbyPlayers);
        return found ? { found } : {
            error: {
                reason: 'session-not-found',
                message: `No se encontró ninguna sesión activa con id ${requestedId}`,
                code: 'NO_ACTIVE_SESSION_FOR_ID',
                params: { sessionId: requestedId }
            }
        };
    }
    const found = findSessionByPin(String(pin).toUpperCase(), activeGames, lobbyPlayers);
    return found ? { found } : {
        error: {
            reason: 'session-not-found',
            message: `No se encontró ninguna sesión activa con PIN ${pin}`,
            code: 'NO_ACTIVE_SESSION_FOR_PIN',
            params: { pin }
        }
    };
}

/**
 * Resuelve el tipo de juego (bank/custom/trivial) a partir del PIN; null si falla.
 * @param {string} pinStr
 * @returns {Promise<string|null>}
 */
async function resolveRemoteGameType(pinStr) {
    try {
        const pinInfo = await validatePinCached(pinStr);
        return pinInfo?.valid ? pinInfo.type : null;
    } catch (err) {
        logger.warn('Remote presenter: no se pudo resolver gameType por PIN', {
            pin: pinStr,
            error: err.message
        });
        return null;
    }
}

/**
 * Crea el handler para el evento `join-remote-presenter`.
 * @param {Object} deps - { activeGames, lobbyPlayers }
 * @returns {Function} handler(socket, data)
 */
function createJoinRemotePresenterHandler({ activeGames, lobbyPlayers, teamConfigs }) {
    return async function handleJoinRemotePresenter(socket, data) {
        const { sessionId: requestedId, pin } = data || {};
        const token = resolveRemoteToken(socket, data);

        if (!token || (!pin && !requestedId)) {
            socket.emit('remote-join-failed', {
                reason: 'missing-data',
                message: 'Token JWT y sesión (o PIN) son requeridos',
                code: 'REMOTE_JOIN_DATA_REQUIRED'
            });
            return;
        }

        const user = validateAdminToken(token);
        if (!user) {
            socket.emit('remote-join-failed', {
                reason: 'invalid-token',
                message: 'Token de admin inválido o expirado. Inicia sesión en el panel.',
                code: 'REMOTE_JOIN_TOKEN_INVALID'
            });
            logger.warn('Remote presenter join denied – invalid token', {
                socketId: socket.id, pin, sessionId: requestedId
            });
            return;
        }

        const { found, error } = resolveRemoteSession(requestedId, pin, activeGames, lobbyPlayers);
        if (error) {
            socket.emit('remote-join-failed', error);
            return;
        }

        const { sessionId, game } = found;
        const pinStr = String(pin || game?.pin || sessionId.split('-')[0]).toUpperCase();

        await socket.join(sessionId);
        await socket.join(sessionId + ':presenter');

        socket.data.role = 'remote-presenter';
        socket.data.roomId = sessionId;
        socket.data.pin = pinStr;
        socket.data.isRemote = true;

        addRemotePresenter(sessionId, socket.id);

        const gameType = await resolveRemoteGameType(pinStr);
        const snapshot = buildRemoteSnapshot(sessionId, game, lobbyPlayers, gameType, teamConfigs);
        socket.emit('remote-join-success', snapshot);

        logger.info('Remote presenter joined successfully', {
            socketId: socket.id, sessionId, pin: pin || pinStr, adminRole: user.role
        });
    };
}

module.exports = {
    createJoinRemotePresenterHandler,
    validatePanelToken,
    validateAdminToken,
    addRemotePresenter,
    removeRemotePresenter
};
