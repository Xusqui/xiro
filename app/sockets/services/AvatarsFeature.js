/**
 * @fileoverview Avatares de jugador: el que elige cada uno al unirse y su lectura por sala.
 *
 * - join-lobby { …, avatar }: JoinLobbyHandler llama a `remember` tras un alta nueva. El
 *   avatar solo se guarda si está activo en Interfaz y dentro del conjunto que eligió el
 *   admin; si no, el jugador entra sin avatar. Una reconexión conserva el que tenía.
 * - 'get-avatars' (ack): { ok, enabled, avatars: { apodo: id } } de la sala del socket
 *   (jugador, presentador, TV o mando). Lo piden quienes entran tarde o recargan.
 */

'use strict';

const uiSettings = require('../../config/ui-settings');
const { getRedisClient, isRedisAvailable } = require('../../config/redis');
const { resolve } = require('../../public/js/core/avatars-catalog.js');
const { PlayerAvatarStore } = require('../utils/PlayerAvatarStore');
const logger = require('../../config/logger');

function currentSettings() {
    return { enabled: uiSettings.get('playerAvatars') !== false, set: uiSettings.get('avatarSet') };
}

/**
 * @param {Object} [deps]
 * @param {PlayerAvatarStore} [deps.store]
 * @param {Function} [deps.settings] - () => ({ enabled, set })
 */
function createAvatarsFeature({ store, settings = currentSettings } = {}) {
    const avatars = store || new PlayerAvatarStore({ getClient: () => (isRedisAvailable() ? getRedisClient() : null) });

    /** Guarda el avatar elegido (o lo borra si no vale) y devuelve el que queda, o null. */
    async function remember(roomId, nickname, requested) {
        const avatar = resolve(requested, settings());
        await avatars.set(roomId, nickname, avatar);
        return avatar;
    }

    async function handleGetAvatars(socket, _data, callback) {
        const reply = typeof callback === 'function' ? callback : () => {};
        const roomId = socket.data?.roomId;
        if (!roomId) return reply({ ok: false, reason: 'no-room' });
        try {
            const enabled = settings().enabled === true;
            return reply({ ok: true, enabled, avatars: enabled ? await avatars.getAll(roomId) : {} });
        } catch (error) {
            logger.warn('No se pudieron leer los avatares', { roomId, error: error.message });
            return reply({ ok: false, reason: 'error' });
        }
    }

    return { remember, handleGetAvatars };
}

/** Registra los eventos de avatares en un socket recién conectado. */
function registerAvatarEvents(socket, feature) {
    socket.on('get-avatars', (data, callback) => feature.handleGetAvatars(socket, data, callback));
}

module.exports = { createAvatarsFeature, registerAvatarEvents };
