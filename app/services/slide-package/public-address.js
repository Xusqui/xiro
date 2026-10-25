'use strict';

/**
 * @fileoverview Direcciones a las que el servidor puede pedir imágenes de otras webs: solo IP públicas. Así una
 * URL de un paquete .xiroslide o de la IA no sirve para llegar a la red interna (Redis, PostgreSQL, el
 * contenedor updater, el router o los metadatos del proveedor de la nube). publicLookup se usa al conectar,
 * de modo que se comprueba la IP a la que de verdad se conecta: un DNS que cambie entre la comprobación y la
 * conexión no sirve de nada.
 */

const dns = require('dns');
const net = require('net');

// Propias, privadas, CGNAT, enlace local, documentación, pruebas de red, multicast y reservadas
const BLOCKED_V4 = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
];
// No especificada, loopback y compatibles con IPv4, NAT64, descarte, Teredo, documentación, 6to4, únicas
// locales, enlace local, site-local y multicast. Las IPv4 mapeadas (::ffff:…) no van aquí: Node compara cada
// IPv4 con ese rango y las bloquearía todas; se rechazan aparte (MAPPED_V4_RE).
const BLOCKED_V6 = [
    ['::', 96],
    ['64:ff9b::', 96],
    ['64:ff9b:1::', 48],
    ['100::', 64],
    ['2001::', 32],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['fc00::', 7],
    ['fe80::', 10],
    ['fec0::', 10],
    ['ff00::', 8]
];

// IPv4 mapeadas y traducidas (::ffff:a.b.c.d, ::ffff:0:a.b.c.d y sus formas hexadecimales): ningún servidor
// público las anuncia, así que se rechazan enteras
const MAPPED_V4_RE = /^::ffff:/i;

const blockList = new net.BlockList();
BLOCKED_V4.forEach(([address, prefix]) => blockList.addSubnet(address, prefix, 'ipv4'));
BLOCKED_V6.forEach(([address, prefix]) => blockList.addSubnet(address, prefix, 'ipv6'));

/**
 * true si la IP es pública (el servidor puede pedirle algo).
 * @param {string} address - IPv4 o IPv6, sin corchetes
 * @returns {boolean}
 */
function isPublicAddress(address) {
    const value = String(address || '');
    const family = net.isIP(value);
    if (family === 4) return !blockList.check(value, 'ipv4');
    if (family === 6) return !MAPPED_V4_RE.test(value) && !blockList.check(value, 'ipv6');
    return false;
}

function blockedError(hostname) {
    const err = new Error(`${hostname} no es una dirección pública`);
    err.code = 'IMAGE_HOST_BLOCKED';
    return err;
}

/**
 * Como dns.lookup, pero falla (IMAGE_HOST_BLOCKED) si el nombre resuelve a alguna IP no pública. Sirve para la
 * opción `lookup` de http.get / https.get, con o sin `all` (Node lo pide al elegir familia automáticamente).
 * @param {string} hostname
 * @param {Object|Function} options
 * @param {Function} [callback]
 */
function publicLookup(hostname, options, callback) {
    const done = typeof options === 'function' ? options : callback;
    const opts = options && typeof options === 'object' ? options : {};
    dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
        if (err) return done(err);
        if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) return done(blockedError(hostname));
        if (opts.all) return done(null, addresses);
        const first = addresses.find(a => !opts.family || a.family === opts.family) || addresses[0];
        return done(null, first.address, first.family);
    });
}

module.exports = { isPublicAddress, publicLookup };
