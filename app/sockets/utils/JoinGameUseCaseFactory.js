/**
 * @fileoverview Construye JoinGameUseCase con las dependencias de socket. Lo comparten el alta de
 * jugadores y la del presentador.
 */

const JoinGameUseCase = require('../../application/use-cases/JoinGameUseCase');

/**
 * Crea el caso de uso de unirse a una sala.
 * @param {Object} dependencies - Maps de globalState, io y servicios (ver socket.handlers.js)
 * @returns {JoinGameUseCase}
 */
function buildJoinGameUseCase(dependencies) {
    const { players, socketToPlayer, lobbyPlayers, teamConfigs, activeGames, socketRateLimits, roomPresenterMap, io } =
        dependencies;

    return new JoinGameUseCase({
        players,
        socketToPlayer,
        lobbyPlayers,
        teamConfigs,
        activeGames,
        socketRateLimits,
        roomPresenterMap,
        io
    });
}

module.exports = { buildJoinGameUseCase };
