/**
 * @fileoverview Query para listar sesiones de juego activas
 * @module application/queries/GetActiveSessionsQuery
 */

const Query = require('./Query');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

// Timestamp de carga del módulo ≈ tiempo de arranque del worker.
// Las sesiones Redis guardadas ANTES de este instante pertenecen a ejecuciones
// anteriores del servidor y se consideran obsoletas.
const MODULE_LOAD_TIME = Date.now();

/**
 * Devuelve todas las sesiones en curso (juegos activos + lobbys con jugadores).
 * Lectura pura sobre los Maps en memoria: no modifica estado.
 */
class GetActiveSessionsQuery extends Query {
    constructor(params = {}) {
        super(params);
    }

    validate() {
        return { valid: true, errors: [] };
    }

    /**
     * @param {Object} deps
     * @param {Map} deps.activeGames   - Juegos iniciados (sessionId → game)
     * @param {Map} [deps.lobbyPlayers] - Jugadores en lobby (sessionId → string[])
     * @returns {Promise<{success: boolean, sessions: Array}>}
     */
    async execute({ activeGames, lobbyPlayers }) {
        // La memoria de este worker es siempre autoritativa para sus propias partidas.
        const memorySessions = this._getSessionsFromMemory(activeGames, lobbyPlayers);
        const memoryIds = new Set(memorySessions.map(s => s.sessionId));

        let remoteSessions = [];
        try {
            const redisSessions = await this._scanSessionsFromRedis();
            // Solo añadir sesiones Redis que NO estén ya en memoria de este worker:
            // esto cubre partidas activas en otros workers del clúster PM2.
            remoteSessions = redisSessions.filter(s => !memoryIds.has(s.sessionId));
            logger.debug('GetActiveSessionsQuery executed', {
                memory: memorySessions.length,
                remoteFromRedis: remoteSessions.length
            });
        } catch (error) {
            logger.warn('GetActiveSessionsQuery Redis scan failed - using memory only', {
                error: error.message
            });
        }

        return { success: true, sessions: [...memorySessions, ...remoteSessions] };
    }

    async _scanSessionsFromRedis() {
        const client = await getRedisClient();
        const sessions = [];

        for await (const key of client.scanIterator({ MATCH: 'session:*', COUNT: 100 })) {
            const raw = await client.get(key);
            if (!raw) {
                continue;
            }

            const state = this._parseSessionState(raw);
            if (!state) {
                continue;
            }

            if (!this._isSessionRedisStateActive(state, key)) {
                continue;
            }

            const sessionId = this._extractSessionId(key, state);
            const pin = state.pin || this._pinFromSessionId(sessionId);
            sessions.push(this._buildRedisSessionPayload(sessionId, pin, state));
        }

        return sessions;
    }

    _parseSessionState(raw) {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    _isSessionRedisStateActive(state, key) {
        const savedAt = state.savedAt ?? 0;
        if (savedAt < MODULE_LOAD_TIME) {
            logger.debug('GetActiveSessionsQuery: sesión obsoleta ignorada', { key, savedAt });
            return false;
        }

        return state.ended !== true;
    }

    _buildRedisSessionPayload(sessionId, pin, state) {
        return {
            sessionId,
            pin,
            state: state.state || 'active',
            currentIndex: state.currentIndex ?? 0,
            totalQuestions: state.questions?.length ?? state.totalQuestions ?? 0,
            playerCount: state.players?.length ?? state.playerCount ?? 0,
            startedAt: state.startedAt ?? state.savedAt ?? null
        };
    }

    _getSessionsFromMemory(activeGames, lobbyPlayers) {
        const sessions = [];
        const seen = new Set();

        for (const [sessionId, game] of activeGames.entries()) {
            if (game.ended) continue;   // skip games that have already ended
            seen.add(sessionId);
            sessions.push({
                sessionId,
                pin: game.pin || this._pinFromSessionId(sessionId),
                state: game.state || 'active',
                currentIndex: game.currentIndex ?? 0,
                totalQuestions: game.questions?.length ?? 0,
                playerCount: game.players?.length ?? 0,
                startedAt: game.startedAt ?? null
            });
        }

        // 2. Lobbys con jugadores esperando (no iniciados aún)
        if (lobbyPlayers) {
            for (const [sessionId, players] of lobbyPlayers.entries()) {
                if (seen.has(sessionId)) continue;
                const playerList = Array.isArray(players) ? players : [];
                // Evitar lobbies fantasma: una sala vacía en memoria no debe
                // contarse como sesión activa en el panel de admin.
                if (playerList.length === 0) continue;

                sessions.push({
                    sessionId,
                    pin: this._pinFromSessionId(sessionId),
                    state: 'lobby',
                    currentIndex: 0,
                    totalQuestions: 0,
                    playerCount: playerList.length,
                    startedAt: null
                });
            }
        }

        return sessions;
    }

    _extractSessionId(key, state) {
        return state.sessionId || state.roomId || key.replace('session:', '');
    }

    _pinFromSessionId(sessionId) {
        return String(sessionId).includes('-')
            ? String(sessionId).split('-')[0]
            : String(sessionId);
    }
}

module.exports = GetActiveSessionsQuery;
