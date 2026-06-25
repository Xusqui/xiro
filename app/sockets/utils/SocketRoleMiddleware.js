/**
 * @fileoverview Middleware consolidado para asignación de rol de socket
 * Elimina duplicación entre server.js y socket.handlers.js
 */

/**
 * Crea middleware de autenticación/asignación de rol para Socket.IO
 * @returns {Function} Middleware para io.use()
 */
function createSocketRoleMiddleware() {
    return (socket, next) => {
        const role = (socket.handshake.auth && socket.handshake.auth.role) || socket.handshake.query.role;
        socket.data.role = role === 'host' ? 'host' : 'jugador';
        return next();
    };
}

module.exports = {
    createSocketRoleMiddleware
};
