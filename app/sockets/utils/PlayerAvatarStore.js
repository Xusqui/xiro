/**
 * @fileoverview Avatar que eligió cada jugador de una sala (apodo → id del catálogo).
 *
 * El lobby sigue siendo una lista de apodos; el avatar va aparte, en un hash de Redis
 * (`game:avatars:<roomId>`, TTL de sesión) que cualquier worker puede leer. Sin Redis, o si
 * falla, usa un mapa local del worker.
 */

'use strict';

const { isKnown } = require('../../public/js/core/avatars-catalog.js');
const logger = require('../../config/logger');

const KEY_PREFIX = 'game:avatars:';
const SESSION_TTL_SECONDS = 6 * 60 * 60;

class PlayerAvatarStore {
    /**
     * @param {Object} options
     * @param {Function} options.getClient - Devuelve el cliente Redis o null
     */
    constructor({ getClient }) {
        this._getClient = getClient;
        this._local = new Map();
    }

    /** Guarda el avatar del jugador; con null lo borra (entró sin avatar). */
    async set(roomId, nickname, avatarId) {
        const client = this._getClient();
        if (!client) return this._setLocal(roomId, nickname, avatarId);
        const key = KEY_PREFIX + roomId;
        try {
            if (avatarId) {
                await client.hSet(key, nickname, avatarId);
                await client.expire(key, SESSION_TTL_SECONDS);
            } else {
                await client.hDel(key, nickname);
            }
        } catch (error) {
            logger.warn('No se pudo guardar el avatar del jugador', { roomId, error: error.message });
            this._setLocal(roomId, nickname, avatarId);
        }
    }

    /** { apodo: id } de la sala; solo ids que siguen en el catálogo. */
    async getAll(roomId) {
        const client = this._getClient();
        let stored = this._local.get(roomId) || {};
        if (client) {
            try {
                stored = (await client.hGetAll(KEY_PREFIX + roomId)) || {};
            } catch (error) {
                logger.warn('No se pudieron leer los avatares de la sala', { roomId, error: error.message });
            }
        }
        const avatars = {};
        Object.keys(stored).forEach(nickname => {
            if (isKnown(stored[nickname])) avatars[nickname] = stored[nickname];
        });
        return avatars;
    }

    _setLocal(roomId, nickname, avatarId) {
        const room = { ...(this._local.get(roomId) || {}) };
        if (avatarId) room[nickname] = avatarId;
        else delete room[nickname];
        this._local.set(roomId, room);
        if (this._local.size > 1000) this._local.delete(this._local.keys().next().value);
    }
}

module.exports = { PlayerAvatarStore, KEY_PREFIX };
