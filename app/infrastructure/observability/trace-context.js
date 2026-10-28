/**
 * @fileoverview Contexto de traza por petición HTTP y por evento de socket.
 *
 * Cada petición o evento recibe un traceId que el logger añade a cada línea, así
 * se pueden seguir todas las líneas de una misma operación. Se respeta la cabecera
 * W3C `traceparent` (si un proxy o un cliente con OpenTelemetry ya trae una traza,
 * se reutiliza su trace-id) y, si no, `X-Request-Id`. El id se devuelve en la
 * respuesta como `X-Request-Id`.
 */

const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();

const TRACEPARENT_RE = /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/;
const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;
const INVALID_TRACE_ID = '0'.repeat(32);

function newTraceId() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Trace-id de una cabecera `traceparent` válida, o null.
 * @param {string|undefined} header
 * @returns {string|null}
 */
function parseTraceparent(header) {
    if (typeof header !== 'string') return null;
    const match = TRACEPARENT_RE.exec(header.trim().toLowerCase());
    if (!match || match[1] === INVALID_TRACE_ID) return null;
    return match[1];
}

/**
 * Elige el traceId de una petición: traceparent, X-Request-Id o uno nuevo.
 * X-Request-Id solo se acepta con caracteres seguros, para no inyectar texto
 * arbitrario en los logs.
 * @param {Object} headers
 * @returns {string}
 */
function traceIdFromHeaders(headers = {}) {
    const fromTraceparent = parseTraceparent(headers.traceparent);
    if (fromTraceparent) return fromTraceparent;

    const requestId = headers['x-request-id'];
    if (typeof requestId === 'string' && REQUEST_ID_RE.test(requestId)) return requestId;

    return newTraceId();
}

/** Middleware Express: abre el contexto de la petición. */
function traceMiddleware(req, res, next) {
    const traceId = traceIdFromHeaders(req.headers);
    res.setHeader('X-Request-Id', traceId);
    storage.run({ traceId }, next);
}

/**
 * Middleware de socket (`socket.use`): cada evento recibido abre su propio
 * contexto. Socket.IO entrega el evento en un process.nextTick programado
 * dentro de next(), que hereda el contexto.
 * @param {Object} socket
 * @returns {Function}
 */
function socketTraceMiddleware(_socket) {
    return (packet, next) => {
        const event = Array.isArray(packet) && typeof packet[0] === 'string' ? packet[0] : undefined;
        storage.run({ traceId: newTraceId(), socketEvent: event }, next);
    };
}

/** @returns {{traceId: string, socketEvent?: string}|undefined} */
function getTraceContext() {
    return storage.getStore();
}

module.exports = {
    traceMiddleware,
    socketTraceMiddleware,
    getTraceContext,
    traceIdFromHeaders,
    parseTraceparent
};
