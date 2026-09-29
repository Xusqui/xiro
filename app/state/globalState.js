/**
 * @fileoverview Estado global de la aplicación
 * CRÍTICO: Este archivo contiene las instancias únicas de Maps y objetos globales
 * NO duplicar estas estructuras en otros módulos - siempre importar desde aquí
 * 
 * NOTA: activeGames ahora usa sessionId (formato: PIN-UUID) como clave
 * esto permite múltiples sesiones independientes del mismo PIN simultáneamente
 */

const logger = require('../config/logger');
const timerManager = require('../services/timer.manager');

/**
 * Mapeo principal: playerId → PlayerState completo
 * @type {Map<string, Object>}
 */
const players = new Map();

/**
 * Mapeo inverso: socket.id → playerId (para disconnect rápido)
 * @type {Map<string, string>}
 */
const socketToPlayer = new Map();

/**
 * Juegos activos indexados por sessionId (formato: PIN-UUID)
 * Cada juego mantiene una referencia a su PIN original en game.pin
 * OPTIMIZADO: Migrado de Object a Map para acceso O(1) garantizado
 * @type {Map<string, Object>}
 */
const activeGames = new Map();

/**
 * Estado de timers pausados por sessionId
 * OPTIMIZADO: Migrado de Object a Map
 * @type {Map<string, Object>}
 */
const timerPausedState = new Map();

/**
 * Timers de preguntas activas por sessionId
 * OPTIMIZADO: Migrado de Object a Map
 * @type {Map<string, NodeJS.Timeout>}
 */
const gameTimers = new Map();

/**
 * Jugadores en lobby (esperando a que empiece el juego) por sessionId
 * OPTIMIZADO: Migrado de Object a Map
 * @type {Map<string, Array<string>>}
 */
const lobbyPlayers = new Map();

/**
 * Configuración de equipos por sessionId
 * Estructura: {
 *   sessionId: {
 *     isTeamMode: boolean,
 *     teams: [
 *       { name: string, color: string, players: [nickname1, nickname2, ...], score: number }
 *     ]
 *   }
 * }
 * OPTIMIZADO: Migrado de Object a Map
 * @type {Map<string, Object>}
 */
const teamConfigs = new Map();

/**
 * Rate limiting por socket
 * @type {Map<string, Object>}
 */
const socketRateLimits = new Map();

/**
 * Índice inverso: roomId → playerId del presentador (HOST).
 * Permite O(1) lookup en el path de disconnect sin iterar todos los players.
 * @type {Map<string, string>}
 */
const roomPresenterMap = new Map();

/**
 * Caché de validación de PINs (reduce queries a BD en ~90%)
 * Estructura: { pin: { valid, type, id, timestamp } }
 * TTL: 5 minutos
 * @type {Map<string, Object>}
 */
const pinValidationCache = new Map();

// Cleanup automático de caché cada 5 minutos
setInterval(() => {
    const now = Date.now();
    const TTL = 5 * 60 * 1000; // 5 minutos
    let cleaned = 0;

    for (const [pin, data] of pinValidationCache.entries()) {
        if (now - data.timestamp > TTL) {
            pinValidationCache.delete(pin);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.debug('PIN validation cache cleanup', { cleaned, remaining: pinValidationCache.size });
    }
}, 5 * 60 * 1000).unref();

/**
 * FASE 3: Limpieza proactiva del caché cuando un juego finaliza
 * NO esperar al TTL de 5 minutos - invalidar inmediatamente
 * @param {string} pin - PIN del juego que ha finalizado
 */
function invalidatePinCache(pin) {
    if (pinValidationCache.has(pin)) {
        pinValidationCache.delete(pin);
        logger.debug('PIN cache invalidated proactively', { pin });
    }
}

/**
 * FASE 3: Limpieza de timer con validación de existencia previa
 * Evita aceleraciones visuales por timers duplicados
 * @param {string} roomId - ID de la sala/juego
 */
function clearGameTimer(roomId) {
    if (gameTimers.has(roomId)) {
        timerManager.clear(gameTimers.get(roomId));
        gameTimers.delete(roomId);
        logger.debug('Game timer cleared explicitly', { roomId });
    }
}

/**
 * Purga entradas huérfanas de socketToPlayer (y su players/lobbyPlayers asociado)
 * cuyo socket ya no está conectado. Llamar periódicamente desde socket.manager.
 * @param {import('socket.io').Server} io
 */
function cleanupStaleSessions(io) {
    let removed = 0;
    for (const [socketId, playerId] of socketToPlayer) {
        if (!io.sockets.sockets.has(socketId)) {
            socketToPlayer.delete(socketId);
            players.delete(playerId);
            removed++;
        }
    }
    if (players.size > 5000) {
        logger.warn('players Map exceeded 5000 entries — possible memory leak', { size: players.size });
    }
    if (removed > 0) {
        logger.info('Stale session cleanup', { removed, playersRemaining: players.size });
    }
}

module.exports = {
    players,
    socketToPlayer,
    activeGames,
    gameTimers,
    lobbyPlayers,
    teamConfigs,
    socketRateLimits,
    roomPresenterMap,
    timerPausedState,
    pinValidationCache,
    // FASE 3: Funciones de limpieza proactiva
    invalidatePinCache,
    clearGameTimer,
    cleanupStaleSessions
};
