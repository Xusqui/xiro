'use strict';

/**
 * @fileoverview Descarga una imagen (o el JSON de una API) de otra web. La usan la importación de .xiroslide,
 * que guarda en /uploads/ las imágenes enlazadas (la CSP de XiRo solo enseña imágenes del propio servidor),
 * y las diapositivas con IA. Solo http(s) en los puertos 80 y 443, sin usuario ni contraseña en la URL y solo
 * hacia IP públicas (public-address.js), con 3 redirecciones como mucho, un plazo para todo y un tamaño
 * máximo. El tipo real de la imagen lo decide después image-type.js, no la cabecera Content-Type.
 */

const http = require('http');
const https = require('https');
const net = require('net');
const { isPublicAddress, publicLookup } = require('./public-address');
const { MAX_ASSET_BYTES } = require('../../public/js/core/slide-package');
const { version } = require('../../package.json');

const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
const REDIRECTS = [301, 302, 303, 307, 308];
const PORTS = ['', '80', '443'];
// Wikimedia y otras webs piden un User-Agent que diga quién llama
const USER_AGENT = `XiRo/${version} (+https://github.com/Xusqui/xiro)`;
const TRANSPORTS = { 'http:': http, 'https:': https };

function remoteError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * URL que se puede pedir, o error con código: http(s), puerto 80 o 443, sin credenciales y, si es una IP, pública.
 * @param {string|URL} raw
 * @returns {URL}
 */
function checkRemoteUrl(raw) {
    let url;
    try {
        url = new URL(String(raw));
    } catch (_err) {
        throw remoteError('IMAGE_URL_INVALID', 'La dirección de la imagen no es válida');
    }
    if (!TRANSPORTS[url.protocol] || url.username || url.password || !PORTS.includes(url.port)) {
        throw remoteError('IMAGE_URL_INVALID', 'La dirección de la imagen no es válida');
    }
    const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
    if (net.isIP(host) && !isPublicAddress(host)) throw remoteError('IMAGE_HOST_BLOCKED', `${host} no es una dirección pública`);
    return url;
}

/** Cuerpo de una respuesta 200 sin pasar de maxBytes. */
function readBody(res, maxBytes) {
    return new Promise((resolve, reject) => {
        if (Number(res.headers['content-length']) > maxBytes) {
            res.destroy();
            reject(remoteError('ASSET_TOO_LARGE', 'La imagen pesa demasiado'));
            return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', chunk => {
            size += chunk.length;
            if (size > maxBytes) res.destroy(remoteError('ASSET_TOO_LARGE', 'La imagen pesa demasiado'));
            else chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
    });
}

/** Una petición GET: { status, location } si no es 200, o { status: 200, body, contentType }. */
function requestOnce(url, { maxBytes, accept, signal, transports }) {
    return new Promise((resolve, reject) => {
        const headers = { 'User-Agent': USER_AGENT, Accept: accept };
        // agent: false = conexión nueva siempre: un socket reutilizado del agente global no pasaría por publicLookup
        const req = transports[url.protocol].get(url, { headers, lookup: publicLookup, agent: false, signal }, res => {
            if (res.statusCode !== 200) {
                res.resume();
                resolve({ status: res.statusCode, location: res.headers.location || null });
                return;
            }
            const contentType = String(res.headers['content-type'] || '');
            readBody(res, maxBytes).then(body => resolve({ status: 200, body, contentType }), reject);
        });
        req.on('error', reject);
    });
}

/**
 * Descarga una URL. Falla con err.code IMAGE_URL_INVALID, IMAGE_HOST_BLOCKED, IMAGE_HTTP_ERROR,
 * ASSET_TOO_LARGE, IMAGE_TIMEOUT o el de la red (ENOTFOUND, ECONNREFUSED…).
 * @param {string} raw - URL http(s)
 * @param {Object} [options]
 * @param {number} [options.maxBytes] - Tamaño máximo; por defecto, el de una imagen de un paquete (5 MB)
 * @param {string} [options.accept] - Cabecera Accept; por defecto, imágenes
 * @param {number} [options.timeoutMs] - Plazo para todo, redirecciones incluidas
 * @param {AbortSignal} [options.signal] - Para cancelar
 * @param {Object} [options.transports] - { 'http:', 'https:' } con get(), inyectable en tests
 * @returns {Promise<{body: Buffer, contentType: string, url: string}>}
 */
async function fetchRemote(raw, options = {}) {
    const { maxBytes = MAX_ASSET_BYTES, accept = 'image/*', timeoutMs = TIMEOUT_MS, transports = TRANSPORTS } = options;
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    let url = checkRemoteUrl(raw);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        let res;
        try {
            res = await requestOnce(url, { maxBytes, accept, signal, transports });
        } catch (err) {
            if (timeout.aborted) throw remoteError('IMAGE_TIMEOUT', 'La web tarda demasiado en responder');
            throw err;
        }
        if (res.status === 200) return { body: res.body, contentType: res.contentType, url: url.href };
        if (!REDIRECTS.includes(res.status) || !res.location) throw remoteError('IMAGE_HTTP_ERROR', `La web respondió ${res.status}`);
        url = checkRemoteUrl(new URL(res.location, url));
    }
    throw remoteError('IMAGE_HTTP_ERROR', 'Demasiadas redirecciones');
}

/**
 * Contenido de una imagen de otra web (fetchRemote con sus valores por defecto).
 * @param {string} url
 * @param {Object} [options] - Las de fetchRemote
 * @returns {Promise<Buffer>}
 */
async function fetchImage(url, options) {
    return (await fetchRemote(url, options)).body;
}

module.exports = { checkRemoteUrl, fetchRemote, fetchImage, USER_AGENT };
