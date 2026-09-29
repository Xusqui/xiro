/**
 * @fileoverview End Game Handler (Use Case Pattern)
 * Permite al presentador terminar el juego manualmente
 */

const EndGameUseCase = require('../../application/use-cases/EndGameUseCase');
const { validateSocket, schemas } = require('../../validation');
const { pushSessionLog } = require('../../services/game-logs.service');

/**
 * Creates handler for manual game ending
 * @param {Object} dependencies - Handler dependencies
 * @returns {Function} Handler function
 */
function createEndGameHandler(dependencies) {
    return async function handleEndGame(socket, data) {
        // Validar input
        const validation = validateSocket(schemas.endGame, data);
        if (!validation.valid) {
            socket.emit('error', {
                message: validation.error
            });
            return;
        }

        const { roomIdOrPin, reason = 'manual' } = validation.value;

        await pushSessionLog(roomIdOrPin, {
            level: 'info',
            event: 'game-ended',
            actor: 'presenter',
            message: 'Presenter requested end-game',
            data: { reason }
        });

        // Ejecutar Use Case
        const useCase = new EndGameUseCase(dependencies);
        const result = await useCase.execute({
            roomId: roomIdOrPin,
            reason
        });

        if (!result.success) {
            socket.emit('error', {
                message: result.message || 'Error al finalizar el juego',
                code: result.code || 'END_GAME_FAILED'
            });
        }
        // No emitir success aquí - el Use Case ya emite 'game-over'
    };
}

module.exports = createEndGameHandler;
