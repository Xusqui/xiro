/**
 * @fileoverview Propaga las invalidaciones de las cachés en memoria a todos los workers PM2
 * @module services/cache-invalidation-bus
 *
 * Cada caché borra en local y publica; los demás workers ejecutan `<op>Local`, que no republica.
 * Sin attach() (tests, scripts sueltos, Redis caído) broadcast no hace nada y queda el TTL.
 */

const crypto = require('crypto');
const logger = require('../config/logger');

const CHANNEL = 'cache-invalidate';
// pid no basta: dos contenedores pueden compartir Redis con el mismo pid
const ORIGIN = `${process.pid}-${crypto.randomUUID()}`;

const caches = new Map(); // nombre → { target, ops }
let publisher = null;

/**
 * Registra una caché cuyas operaciones se propagan
 * @param {string} name - Nombre en el mensaje ('pin', 'questionBank')
 * @param {Object} target - Instancia con un método `<op>Local` por operación
 * @param {string[]} ops - Operaciones permitidas
 */
function registerCache(name, target, ops) {
    caches.set(name, { target, ops: new Set(ops) });
}

/** Avisa al resto de workers. No espera ni lanza: si Redis falla queda el TTL. */
function broadcast(name, op, args = []) {
    if (!publisher) return;
    const message = JSON.stringify({ origin: ORIGIN, name, op, args });
    Promise.resolve()
        .then(() => publisher.publish(CHANNEL, message))
        .catch(error =>
            logger.warn('No se pudo propagar la invalidación de caché', { name, op, error: error.message })
        );
}

function handleMessage(message) {
    let data;
    try {
        data = JSON.parse(message);
    } catch (_error) {
        logger.warn('Mensaje de invalidación de caché con JSON inválido');
        return;
    }
    if (!data || data.origin === ORIGIN) return;

    const cache = caches.get(data.name);
    if (!cache || !cache.ops.has(data.op)) return;

    try {
        cache.target[`${data.op}Local`](...(Array.isArray(data.args) ? data.args : []));
    } catch (error) {
        logger.warn('Error aplicando una invalidación de caché remota', {
            name: data.name,
            op: data.op,
            error: error.message
        });
    }
}

/**
 * Conecta el bus a Redis. Lo llama RedisSyncBus al preparar sus suscripciones.
 * @param {Object} pub - Cliente Redis de publicación
 * @param {Object} sub - Cliente Redis en modo suscripción
 */
async function attach(pub, sub) {
    await sub.subscribe(CHANNEL, handleMessage);
    publisher = pub;
}

function detach() {
    publisher = null;
}

module.exports = {
    CHANNEL,
    registerCache,
    broadcast,
    attach,
    detach,
    handleMessage
};
