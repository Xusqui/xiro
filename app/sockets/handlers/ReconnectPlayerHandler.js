/**
 * @fileoverview Reconnect Player Handler (Use Case Pattern)
 */

const ReconnectPlayerUseCase = require('../../application/use-cases/ReconnectPlayerUseCase');
const { validateSocket, schemas } = require('../../validation');
const logger = require('../../config/logger');
const { recordReconnectFailedMetric } = require('./reconnectMetrics');
const crypto = require('crypto');

function createEmitReconnectFailed(socket) {
    return ({ reason, message, code, params, extra = {} }) => {
        socket.emit('reconnect-failed', {
            reason,
            message,
            ...(code && { code }),
            ...(params && { params }),
            ...extra
        });

        recordReconnectFailedMetric({ reason, actor: 'player' })
            .catch(() => { });
    };
}

function validateReconnectPayload(data, emitReconnectFailed) {
    // Joi da por válido un payload undefined; sin datos tiene que fallar la validación
    const validation = validateSocket(schemas.reconnectPlayer, data ?? {});
    if (!validation.valid) {
        emitReconnectFailed({
            reason: 'invalid-data',
            message: validation.error
        });
        return { valid: false };
    }

    return {
        valid: true,
        value: validation.value
    };
}

function logReconnectInput({ playerId, socket, players }) {
    logger.debug('[RECONNECT DEBUG BACKEND] reconnect-player recibido:', {
        playerId,
        socketId: socket.id,
        totalPlayers: players.size
    });
}

function logPlayerState(playerId, player) {
    logger.debug('[RECONNECT DEBUG BACKEND] Estado del jugador:', {
        found: !!player,
        playerId,
        playerData: player ? {
            nickname: player.nickname,
            roomId: player.roomId,
            status: player.status,
            expiresAt: player.expiresAt ? new Date(player.expiresAt).toISOString() : null,
            lastSeen: player.lastSeen ? new Date(player.lastSeen).toISOString() : null
        } : null
    });
}

function isValidSessionSecret(player, sessionSecret) {
    const provided = sessionSecret || '';
    const expected = player.sessionSecret || '';

    try {
        const providedBuffer = Buffer.from(provided);
        const expectedBuffer = Buffer.from(expected);
        return providedBuffer.length > 0
            && providedBuffer.length === expectedBuffer.length
            && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
    } catch (_) {
        return false;
    }
}

function isReconnectStateAllowed(player, socketId) {
    const isDisconnected = player.status === 'disconnected';
    const isDifferentSocket = player.socketId && player.socketId !== socketId;
    return isDisconnected || isDifferentSocket;
}

function executeReconnectPlayerUseCase(socket, player, dependencies) {
    const useCase = new ReconnectPlayerUseCase();
    return useCase.execute({
        socket,
        data: {
            pin: player.roomId,
            nickname: player.nickname
        },
        dependencies
    });
}

function createHandler(dependencies) {
    const { reconnectionManager, players } = dependencies;

    return async function handleReconnectPlayer(socket, data) {
        const emitReconnectFailed = createEmitReconnectFailed(socket);
        const payloadValidation = validateReconnectPayload(data, emitReconnectFailed);
        if (!payloadValidation.valid) {
            return;
        }

        const { playerId, sessionSecret } = payloadValidation.value;
        logReconnectInput({ playerId, socket, players });

        const player = players.get(playerId);
        logPlayerState(playerId, player);

        if (!player) {
            emitReconnectFailed({
                reason: 'not-found',
                message: 'Sesión no encontrada o expirada. Únete de nuevo.',
                code: 'RECONNECT_SESSION_NOT_FOUND'
            });
            logger.warn('Reconnection failed - player not found', { playerId, socketId: socket.id });
            return;
        }

        if (!isValidSessionSecret(player, sessionSecret)) {
            emitReconnectFailed({
                reason: 'invalid-secret',
                message: 'Sesión no válida. Únete de nuevo.',
                code: 'RECONNECT_INVALID_SESSION'
            });
            logger.warn('Reconnection failed - invalid sessionSecret', {
                playerId,
                nickname: player.nickname,
                hasExpectedSecret: !!player.sessionSecret,
                socketId: socket.id
            });
            return;
        }

        const canReconnect = reconnectionManager.canReconnect(playerId);
        if (!canReconnect.allowed) {
            emitReconnectFailed({
                reason: canReconnect.reason,
                message: canReconnect.message,
                code: canReconnect.code,
                params: canReconnect.params,
                extra: {
                    waitTime: canReconnect.waitTime
                }
            });
            logger.warn('Reconnection blocked by ReconnectionManager', {
                playerId,
                nickname: player.nickname,
                reason: canReconnect.reason,
                waitTime: canReconnect.waitTime
            });
            return;
        }

        if (!isReconnectStateAllowed(player, socket.id)) {
            reconnectionManager.recordAttempt(playerId, false);
            emitReconnectFailed({
                reason: 'invalid-state',
                message: 'No es posible reconectar en este momento',
                code: 'RECONNECT_INVALID_STATE'
            });
            logger.warn('Reconnection failed - invalid state', {
                nickname: player.nickname,
                status: player.status,
                playerId,
                sameSocket: player.socketId === socket.id
            });
            return;
        }

        const result = await executeReconnectPlayerUseCase(socket, player, dependencies);
        if (!result.success) {
            reconnectionManager.recordAttempt(playerId, false);
            emitReconnectFailed({
                reason: result.reason,
                message: result.message,
                code: result.code
            });
            return;
        }

        reconnectionManager.recordAttempt(playerId, true);
    };
}

function createReconnectPlayerHandler(dependencies) {
    return createHandler(dependencies);
}

module.exports = createReconnectPlayerHandler;
