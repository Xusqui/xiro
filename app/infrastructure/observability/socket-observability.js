/**
 * @fileoverview Métricas y traza de los eventos Socket.IO entrantes.
 *
 * Solo se etiqueta con el nombre del evento si el socket tiene un handler para
 * él; cualquier otro nombre cuenta como 'unknown', así un cliente no puede crear
 * series nuevas inventando eventos.
 */

const { socketEvents } = require('./metrics-registry');
const { socketTraceMiddleware } = require('./trace-context');

/**
 * Instala el middleware en el socket. Llamar después de registrar los handlers.
 * @param {import('socket.io').Socket} socket
 */
function observeSocket(socket) {
    const trace = socketTraceMiddleware(socket);
    socket.use((packet, next) => {
        const event = Array.isArray(packet) ? packet[0] : undefined;
        const known = typeof event === 'string' && socket.listenerCount(event) > 0;
        socketEvents.inc({ event: known ? event : 'unknown' });
        trace(packet, next);
    });
}

module.exports = { observeSocket };
