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
 * Construye el snapshot inicial enviado al control remoto.
 * @param {string} sessionId
 * @param {Object|null} game
 * @param {Map} lobbyPlayers
 * @returns {Object}
 */
function buildRemoteSnapshot(sessionId, game, lobbyPlayers, gameType = null, teamConfigs = null) {
    const lobbyCount = lobbyPlayers?.get(sessionId)?.length ?? 0;
    if (!game) {
        return {
            sessionId,
            state: 'lobby',
            gameType,
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
 * Crea el handler para el evento `join-remote-presenter`.
 * @param {Object} deps - { activeGames, lobbyPlayers }
 * @returns {Function} handler(socket, data)
 */
function createJoinRemotePresenterHandler({ activeGames, lobbyPlayers, teamConfigs }) {
    return async function handleJoinRemotePresenter(socket, data) {
        const { pin } = data || {};
        let token = data?.token;

        if (!token) {
            const cookieHeader = socket.handshake?.headers?.cookie;
            if (cookieHeader) {
                const match = cookieHeader.match(/(?:^|;\s*)adminToken=([^;]*)/);
                if (match) {
                    token = decodeURIComponent(match[1]);
                }
            }
        }

        if (!token || !pin) {
            socket.emit('remote-join-failed', {
                reason: 'missing-data',
                message: 'Token JWT y PIN son requeridos',
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
                socketId: socket.id, pin
            });
            return;
        }

        const pinStr = String(pin).toUpperCase();
        const found = findSessionByPin(pinStr, activeGames, lobbyPlayers);
        if (!found) {
            socket.emit('remote-join-failed', {
                reason: 'session-not-found',
                message: `No se encontró ninguna sesión activa con PIN ${pin}`,
                code: 'NO_ACTIVE_SESSION_FOR_PIN',
                params: { pin }
            });
            return;
        }

        const { sessionId, game } = found;

        await socket.join(sessionId);
        await socket.join(sessionId + ':presenter');

        socket.data.role = 'remote-presenter';
        socket.data.roomId = sessionId;
        socket.data.pin = pinStr;
        socket.data.isRemote = true;

        addRemotePresenter(sessionId, socket.id);

        let gameType = null;
        try {
            const pinInfo = await validatePinCached(pinStr);
            gameType = pinInfo?.valid ? pinInfo.type : null;
        } catch (err) {
            logger.warn('Remote presenter: no se pudo resolver gameType por PIN', {
                pin: pinStr,
                error: err.message
            });
        }

        const snapshot = buildRemoteSnapshot(sessionId, game, lobbyPlayers, gameType, teamConfigs);
        socket.emit('remote-join-success', snapshot);

        logger.info('Remote presenter joined successfully', {
            socketId: socket.id, sessionId, pin, adminRole: user.role
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
