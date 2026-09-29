/**
 * @fileoverview Helper consolidado para búsqueda de juegos
 * Elimina duplicación entre AdvanceQuestionUseCase, ReconnectPlayerUseCase y otros
 */

/**
 * Busca un juego por PIN (sessionId o pin de juego)
 * @param {Map} activeGames - Mapa de juegos activos
 * @param {string} pinOrSessionId - PIN o sessionId del juego
 * @returns {Object|null} { game, roomId } o null si no se encuentra
 */
function findGameByPin(activeGames, pinOrSessionId) {
    const sPin = String(pinOrSessionId);

    // Buscar por sessionId primero
    let game = activeGames.get(sPin);

    // Si no se encuentra, buscar por PIN
    if (!game) {
        for (const [, g] of activeGames.entries()) {
            if (g.pin === sPin) {
                game = g;
                break;
            }
        }
    }

    if (!game) {
        return null;
    }

    // Devolver el roomId canónico sin mutar el objeto game
    const roomId = game.roomId || sPin;

    return { game, roomId };
}

module.exports = {
    findGameByPin
};
