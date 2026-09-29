/**
 * @fileoverview Lobby Management Utilities
 * Consolidación de lógica duplicada de manejo de lobbies
 */

/**
 * Elimina un jugador del lobby y sincroniza con otros workers
 * Consolida código duplicado en DisconnectHandler.js y GameUtils.js
 * 
 * @param {Map} lobbyPlayers - Map de lobbies
 * @param {string} roomId - ID de la sala
 * @param {string} nickname - Nickname del jugador
 * @returns {Promise<boolean>} true si se eliminó, false si no estaba en lobby
 */
async function removePlayerFromLobby(lobbyPlayers, roomId, nickname) {
    if (!roomId) return false;

    const lobby = lobbyPlayers.get(roomId);
    if (!lobby) return false;

    const idx = lobby.indexOf(nickname);
    if (idx === -1) return false;

    // Eliminar del lobby
    lobby.splice(idx, 1);

    // Sincronizar con otros workers vía Redis
    const { RedisSyncBus } = require('../sync/RedisSyncBus');
    const syncBus = RedisSyncBus.getInstance();
    await syncBus.publishLobbyPlayerLeft(roomId, nickname);

    return true;
}

/**
 * Verifica si una sala tiene jugadores en el lobby
 * 
 * @param {Map} lobbyPlayers - Map de lobbies
 * @param {string} roomId - ID de la sala
 * @returns {boolean} true si hay jugadores
 */
function hasLobbyPlayers(lobbyPlayers, roomId) {
    const lobby = lobbyPlayers.get(roomId);
    return lobby && lobby.length > 0;
}

/**
 * Obtiene cantidad de jugadores en un lobby
 * 
 * @param {Map} lobbyPlayers - Map de lobbies
 * @param {string} roomId - ID de la sala
 * @returns {number} Cantidad de jugadores
 */
function getLobbyPlayerCount(lobbyPlayers, roomId) {
    const lobby = lobbyPlayers.get(roomId);
    return lobby ? lobby.length : 0;
}

module.exports = {
    removePlayerFromLobby,
    hasLobbyPlayers,
    getLobbyPlayerCount
};
