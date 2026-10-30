/**
 * @fileoverview Estado de las reacciones con emoji de cada sala: activas o silenciadas
 * por el presentador y el conjunto de seis emojis.
 *
 * Se fija desde la configuración de Interfaz la primera vez que alguien lo pide (SET NX),
 * así una partida en curso no cambia si el admin toca la configuración. Vive en Redis
 * (`game:reactions:<roomId>`, TTL de sesión) y cada worker lo cachea cacheMs: tras un
 * cambio, el resto de workers lo ven como mucho un segundo tarde. Sin Redis, o si falla,
 * usa un estado local del worker.
 */

'use strict';

const { normalize } = require('../../public/js/core/reactions-catalog.js');
const logger = require('../../config/logger');

const KEY_PREFIX = 'game:reactions:';
const SESSION_TTL_SECONDS = 6 * 60 * 60;

function parse(raw) {
    try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== 'object') return null;
        return { enabled: value.enabled !== false, set: normalize(value.set) };
    } catch {
        return null;
    }
}

class ReactionsState {
    /**
     * @param {Object} options
     * @param {Function} options.getClient - Devuelve el cliente Redis o null
     * @param {Function} options.defaults - () => ({ enabled, set }) desde la configuración
     * @param {number} [options.cacheMs=1000]
     * @param {Function} [options.now=Date.now]
     */
    constructor({ getClient, defaults, cacheMs = 1000, now = Date.now }) {
        this._getClient = getClient;
        this._defaults = defaults;
        this._cacheMs = cacheMs;
        this._now = now;
        this._cache = new Map();
        this._local = new Map();
    }

    async get(roomId) {
        const cached = this._cache.get(roomId);
        if (cached && this._now() - cached.at < this._cacheMs) return { ...cached.value };
        const value = await this._read(roomId);
        this._remember(roomId, value);
        return { ...value };
    }

    async setEnabled(roomId, enabled) {
        const value = { ...(await this._read(roomId)), enabled: Boolean(enabled) };
        await this._write(roomId, value, false);
        this._remember(roomId, value);
        return { ...value };
    }

    _remember(roomId, value) {
        this._cache.set(roomId, { value, at: this._now() });
        if (this._cache.size > 1000) this._cache.delete(this._cache.keys().next().value);
    }

    _initial() {
        const settings = this._defaults() || {};
        return { enabled: settings.enabled !== false, set: normalize(settings.set) };
    }

    async _read(roomId) {
        const client = this._getClient();
        if (!client) {
            if (!this._local.has(roomId)) this._local.set(roomId, this._initial());
            return { ...this._local.get(roomId) };
        }
        try {
            const stored = parse(await client.get(KEY_PREFIX + roomId));
            if (stored) return stored;
            const initial = this._initial();
            if (await this._write(roomId, initial, true)) return initial;
            // Otro worker lo fijó antes: manda el suyo
            return parse(await client.get(KEY_PREFIX + roomId)) || initial;
        } catch (error) {
            logger.warn('No se pudo leer el estado de las reacciones', { roomId, error: error.message });
            return this._initial();
        }
    }

    /** true si se escribió (con NX, false si la clave ya existía). */
    async _write(roomId, value, onlyIfMissing) {
        const client = this._getClient();
        if (!client) {
            this._local.set(roomId, { ...value });
            return true;
        }
        const options = { EX: SESSION_TTL_SECONDS, ...(onlyIfMissing ? { NX: true } : {}) };
        return (await client.set(KEY_PREFIX + roomId, JSON.stringify(value), options)) !== null;
    }
}

module.exports = { ReactionsState };
