/**
 * @fileoverview Player Lookup Helper - Búsquedas optimizadas de jugadores
 * 
 * Problema: Array.from(players.values()).find() es O(n) y se ejecuta frecuentemente
 * Solución: Crear índices temporales para búsquedas O(1)
 */

/**
 * Buscar jugador por nickname y roomId (optimizado)
 * @param {Map} players - Map global de players
 * @param {string} nickname - Nickname a buscar
 * @param {string} roomId - Room ID
 * @param {string} excludeId - ID de jugador a excluir (opcional)
 * @returns {Object|null} Player encontrado o null
 */
function findPlayerByNickname(players, nickname, roomId, excludeId = null) {
    // Iterar una sola vez en lugar de Array.from + find
    for (const player of players.values()) {
        if (player.nickname === nickname &&
            player.roomId === roomId &&
            player.id !== excludeId) {
            return player;
        }
    }
    return null;
}

/**
 * Crear índice de players por roomId para búsquedas O(1)
 * Útil cuando se necesitan hacer múltiples búsquedas en la misma room
 * 
 * @param {Map} players - Map global de players
 * @param {string} roomId - Room ID
 * @returns {Map<string, Object>} Map de nickname → player
 */
function createRoomPlayersIndex(players, roomId) {
    const index = new Map();

    for (const player of players.values()) {
        if (player.roomId === roomId) {
            index.set(player.nickname, player);
        }
    }

    return index;
}

/**
 * Obtener todos los jugadores de una room (optimizado)
 * @param {Map} players - Map global de players
 * @param {string} roomId - Room ID
 * @returns {Array<Object>} Array de players
 */
function getPlayersByRoom(players, roomId) {
    const roomPlayers = [];

    for (const player of players.values()) {
        if (player.roomId === roomId) {
            roomPlayers.push(player);
        }
    }

    return roomPlayers;
}

/**
 * Contar jugadores en una room (optimizado)
 * @param {Map} players - Map global de players
 * @param {string} roomId - Room ID
 * @returns {number} Cantidad de jugadores
 */
function countPlayersInRoom(players, roomId) {
    let count = 0;

    for (const player of players.values()) {
        if (player.roomId === roomId) {
            count++;
        }
    }

    return count;
}

module.exports = {
    findPlayerByNickname,
    createRoomPlayersIndex,
    getPlayersByRoom,
    countPlayersInRoom
};
