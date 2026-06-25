/**
 * @fileoverview Validador consolidado para Join Game
 * Elimina duplicación entre JoinGameCommand y JoinGameUseCase
 */

/**
 * Valida los datos de entrada para unirse a un juego
 * @param {Object} input - Datos de entrada
 * @param {string} input.pin - PIN del juego
 * @param {string} input.nickname - Nickname del jugador
 * @param {Object} input.socket - Socket del jugador
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateJoinGameInput({ pin, nickname, socket }) {
    const errors = [];

    if (!pin || typeof pin !== 'string') {
        errors.push('PIN is required and must be a string');
    }

    if (!nickname || typeof nickname !== 'string') {
        errors.push('Nickname is required and must be a string');
    }

    if (nickname && nickname.length > 20) {
        errors.push('Nickname must be 20 characters or less');
    }

    if (!socket || typeof socket.emit !== 'function') {
        errors.push('socket is required and must be a Socket.IO instance');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateJoinGameInput
};
