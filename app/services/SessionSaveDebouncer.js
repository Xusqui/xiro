/**
 * @fileoverview Session Save Debouncer - Coalesce session saves to Redis.
 * @module services/SessionSaveDebouncer
 */

const sessionStore = require('./SessionStore');
const logger = require('../config/logger');

class SessionSaveDebouncer {
    constructor() {
        this.pendingSaves = new Map(); // pin -> { data, timer, resolvePromises: [] }
        this.closedRooms = new Map(); // sPin -> expiry timestamp
    }

    _pruneClosedRooms() {
        const now = Date.now();
        for (const [sPin, expiry] of this.closedRooms.entries()) {
            if (now > expiry) {
                this.closedRooms.delete(sPin);
            }
        }
    }

    cancel(sPin) {
        const pending = this.pendingSaves.get(sPin);
        if (!pending) {
            return;
        }
        if (pending.timer) {
            clearTimeout(pending.timer);
        }
        const resolvePromises = pending.resolvePromises;
        this.pendingSaves.delete(sPin);
        for (const resolve of resolvePromises) {
            resolve(false);
        }
    }

    markClosed(sPin) {
        this._pruneClosedRooms();
        const expiry = Date.now() + 120000; // keep ~120s
        this.closedRooms.set(sPin, expiry);
        this.cancel(sPin);
    }

    reopen(sPin) {
        this._pruneClosedRooms();
        this.closedRooms.delete(sPin);
    }

    /**
     * Debounced save of session data.
     * @param {string} sPin - Room / Session Pin
     * @param {Object} sessionData - Session data to persist
     * @returns {Promise<boolean>} Resolves when actually written (either via timeout or flush)
     */
    save(sPin, sessionData) {
        this._pruneClosedRooms();
        if (this.closedRooms.has(sPin)) {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            let pending = this.pendingSaves.get(sPin);
            if (pending) {
                clearTimeout(pending.timer);
            } else {
                pending = {
                    data: null,
                    timer: null,
                    resolvePromises: []
                };
                this.pendingSaves.set(sPin, pending);
            }

            pending.data = sessionData;
            pending.resolvePromises.push(resolve);

            pending.timer = setTimeout(() => {
                this.flush(sPin);
            }, 1500);
        });
    }

    /**
     * Flush any pending saves for a room PIN immediately.
     * @param {string} sPin - Room / Session Pin
     * @returns {Promise<boolean>}
     */
    async flush(sPin) {
        this._pruneClosedRooms();
        if (this.closedRooms.has(sPin)) {
            this.cancel(sPin);
            return false;
        }

        const pending = this.pendingSaves.get(sPin);
        if (!pending) {
            return false;
        }

        if (pending.timer) {
            clearTimeout(pending.timer);
        }

        const data = pending.data;
        const resolvePromises = pending.resolvePromises;
        this.pendingSaves.delete(sPin);

        try {
            const existing = await sessionStore.load(sPin);
            
            // Limpiar valores undefined de data para no sobrescribir datos válidos en Redis
            const cleanData = { ...data };
            Object.keys(cleanData).forEach(key => {
                if (cleanData[key] === undefined) delete cleanData[key];
            });

            const mergedData = existing ? { ...existing, ...cleanData } : cleanData;

            const success = await sessionStore.save(sPin, mergedData);
            for (const resolve of resolvePromises) {
                resolve(success);
            }
            return success;
        } catch (error) {
            logger.error('SessionSaveDebouncer: Failed to save session on flush', {
                sPin,
                error: error.message
            });
            for (const resolve of resolvePromises) {
                resolve(false);
            }
            return false;
        }
    }
}

module.exports = new SessionSaveDebouncer();
