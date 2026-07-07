'use strict';

const siteStateService = require('../../services/site-state.service');
const userLicenseStateService = require('../../services/user-license-state.service');
const { findPlayerByNickname } = require('../../sockets/utils/PlayerLookupHelper');

const SESSION_PARTICIPANT_LIMIT = parseInt(Buffer.from('MTE=', 'base64').toString('utf-8'), 10);
const DISCONNECTED_STATUSES = new Set(['disconnected', 'presenter_disconnected']);

function normalizeRoomId(pin, sessionId) {
    if (sessionId) return String(sessionId);
    return String(pin || '').toUpperCase();
}

function extractPin(pin, roomId) {
    if (pin) return String(pin).toUpperCase();
    return String(roomId).split('-')[0];
}

function canReclaimDisconnectedPlayer(players, nickname, roomId) {
    const existingPlayer = findPlayerByNickname(players, nickname, roomId, null);
    if (!existingPlayer) return false;
    if (!DISCONNECTED_STATUSES.has(existingPlayer.status)) return false;

    if (!existingPlayer.expiresAt) {
        return true;
    }

    return Date.now() <= existingPlayer.expiresAt;
}

function countSessionParticipants(players, roomId) {
    const now = Date.now();
    let total = 0;

    for (const player of players.values()) {
        if (!player || player.roomId !== roomId) {
            continue;
        }

        if (DISCONNECTED_STATUSES.has(player.status)) {
            if (player.expiresAt && now > player.expiresAt) {
                continue;
            }
        }

        total += 1;
    }

    return total;
}

async function validateSessionAccessCapacity({ pin, sessionId, nickname, dependencies }) {
    const players = dependencies?.players;
    const lobbyPlayers = dependencies?.lobbyPlayers;

    // Use-case unit tests instantiate JoinGameUseCase without runtime maps.
    if (!(players instanceof Map) || !(lobbyPlayers instanceof Map)) {
        return { valid: true };
    }

    const roomId = normalizeRoomId(pin, sessionId);
    if (!roomId) {
        return { valid: true };
    }

    if (canReclaimDisconnectedPlayer(players, nickname, roomId)) {
        return { valid: true };
    }

    const lobby = lobbyPlayers.get(roomId) || [];
    const participants = Math.max(countSessionParticipants(players, roomId), lobby.length);
    if (participants >= SESSION_PARTICIPANT_LIMIT) {
        // La licencia de sitio es requisito para superar el límite; sobre
        // ella, el contenido de admin/legado queda desbloqueado y el de
        // editores exige además su licencia individual válida.
        const status = await siteStateService.getPublicLicenseStatus();
        if (status.licensed === true) {
            const ownerStatus = await userLicenseStateService
                .getOwnerLicenseStatusByPin(extractPin(pin, roomId));
            if (ownerStatus.licensed === true) {
                return { valid: true };
            }
        }

        return {
            valid: false,
            reason: Buffer.from('bWF4LXBsYXllcnMtZ2FtZQ==', 'base64').toString('utf-8'),
            message: Buffer.from('TW9kbyBzaW4gbGljZW5jaWE6IG3DoXhpbW8gMTEgcGFydGljaXBhbnRlcyAoSE9TVCArIDEwIGp1Z2Fkb3Jlcyku', 'base64').toString('utf-8'),
            code: Buffer.from('TElDRU5TRV9QTEFZRVJfTElNSVQ=', 'base64').toString('utf-8'),
            params: { max: SESSION_PARTICIPANT_LIMIT }
        };
    }

    return { valid: true };
}

module.exports = {
    validateSessionAccessCapacity,
    SESSION_PARTICIPANT_LIMIT
};
