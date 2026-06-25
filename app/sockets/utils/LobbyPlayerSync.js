/**
 * @fileoverview Helper consolidado para sincronización de lobby players
 * Elimina duplicación entre JoinGameCommand y RedisSyncBus
 */

/**
 * Añade un jugador al lobby de forma thread-safe
 * @param {Map} lobbyPlayers - Mapa de lobbies
 * @param {string} roomId - ID del room/juego
 * @param {string} nickname - Nickname del jugador
 * @returns {boolean} true si se añadió, false si ya existía
 */
function addPlayerToLobby(lobbyPlayers, roomId, nickname) {
    if (!lobbyPlayers.has(roomId)) {
        lobbyPlayers.set(roomId, []);
    }

    const lobby = lobbyPlayers.get(roomId);

    if (!lobby.includes(nickname)) {
        lobby.push(nickname);
        return true;
    }

    return false;
}

module.exports = {
    addPlayerToLobby
};
