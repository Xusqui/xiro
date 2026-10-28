/** @fileoverview Servidor HTTP del actualizador. Solo escucha en la red interna de Docker y solo atiende al
 *  backend de Xiro!, que se autentica con UPDATER_TOKEN (compartido a través del .env). Una única acción:
 *  actualizar backend y backup a la versión indicada. */
'use strict';
const http = require('http');
const crypto = require('crypto');
const { discoverDeployment, linkWorkingDir } = require('./deployment');
const { createJob } = require('./update-job');

const MIN_TOKEN_LENGTH = 32;
const MAX_BODY_BYTES = 1024;

/**
 * Comprueba si la solicitud está autorizada
 * @param {Object} req - Objeto de solicitud HTTP
 * @param {string} token - Token de autenticación
 * @returns {boolean} Verdadero si la solicitud está autorizada
 */
function isAuthorized(req, token) {
    if (token.length < MIN_TOKEN_LENGTH) return false;
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return false;
    const providedToken = auth.slice(7);
    const expectedHash = crypto.createHash('sha256').update(token).digest();
    const providedHash = crypto.createHash('sha256').update(providedToken).digest();
    return crypto.timingSafeEqual(expectedHash, providedHash);
}

/**
 * Envía una respuesta JSON
 * @param {Object} res - Objeto de respuesta HTTP
 * @param {number} code - Código de estado HTTP
 * @param {Object} payload - Payload a enviar
 */
function sendJson(res, code, payload) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
}

/**
 * Lee el cuerpo de la solicitud como JSON
 * @param {Object} req - Objeto de solicitud HTTP
 * @returns {Promise<Object>} Promesa que se resuelve con el objeto JSON
 */
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                req.destroy();
                reject(new Error('Cuerpo demasiado grande'));
                return;
            }
            body += chunk.toString();
        });
        req.on('error', reject);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
    });
}

/**
 * Maneja la solicitud POST /update
 * @param {Object} req - Objeto de solicitud HTTP
 * @param {Object} res - Objeto de respuesta HTTP
 * @param {Object} job - Trabajo de actualización
 * @returns {Promise<void>}
 */
async function handleUpdate(req, res, job) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Método no permitido' });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const started = job.start(body.version);
        sendJson(
            res,
            started ? 202 : 409,
            started ? { started: true } : { error: 'Ya hay una actualización en curso' }
        );
    } catch (err) {
        sendJson(res, 400, { error: err.message });
    }
}

/**
 * Ruta autorizada para manejar solicitudes
 * @param {Object} req - Objeto de solicitud HTTP
 * @param {Object} res - Objeto de respuesta HTTP
 * @param {Object} job - Trabajo de actualización
 * @param {string} pathname - Ruta solicitada
 * @returns {Promise<void>}
 */
async function routeAuthorized(req, res, job, pathname) {
    if (pathname === '/status') {
        if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'Método no permitido' });
            return;
        }
        sendJson(res, 200, job.getStatus());
        return;
    }

    if (pathname === '/update') {
        await handleUpdate(req, res, job);
        return;
    }

    sendJson(res, 404, { error: 'No encontrado' });
}

/**
 * Crea el servidor HTTP
 * @param {Object} options - Opciones del servidor
 * @param {string} options.token - Token de autenticación
 * @param {Function} options.getJob - Función para obtener el trabajo de actualización
 * @param {Function} options.getSetupError - Función para obtener el error de configuración
 * @returns {Object} Servidor HTTP
 */
function createServer(options) {
    const ctx = {
        token: options.token || '',
        getJob: options.getJob,
        getSetupError: options.getSetupError || (() => null)
    };
    return http.createServer((req, res) => {
        handleRequest(req, res, ctx);
    });
}

/**
 * Maneja la solicitud HTTP al actualizador
 * @param {Object} req - Objeto de solicitud HTTP
 * @param {Object} res - Objeto de respuesta HTTP
 * @param {Object} ctx - Contexto del servidor
 */
async function handleRequest(req, res, ctx) {
    try {
        const url = new URL(req.url, 'http://updater');
        const pathname = url.pathname;

        if (pathname === '/health') {
            sendJson(res, 200, {
                ok: true,
                tokenConfigured: ctx.token.length >= MIN_TOKEN_LENGTH,
                ready: !!ctx.getJob(),
                setupError: ctx.getSetupError()
            });
            return;
        }

        if (ctx.token.length < MIN_TOKEN_LENGTH) {
            sendJson(res, 503, { error: 'UPDATER_TOKEN no está configurado (mínimo 32 caracteres)' });
            return;
        }

        if (!isAuthorized(req, ctx.token)) {
            sendJson(res, 401, { error: 'No autorizado' });
            return;
        }

        const job = ctx.getJob();
        if (!job) {
            sendJson(res, 503, { error: ctx.getSetupError() || 'El actualizador aún se está preparando' });
            return;
        }

        await routeAuthorized(req, res, job, pathname);
    } catch (err) {
        console.error(err.message);
        sendJson(res, 500, { error: 'Error interno' });
    }
}

/**
 * Función principal del servidor
 */
function main() {
    const token = process.env.UPDATER_TOKEN || '';
    const port = Number(process.env.PORT) || 8080;
    let job = null;
    let setupError = null;

    if (token.length < MIN_TOKEN_LENGTH) {
        console.warn(
            'UPDATER_TOKEN no está configurado o tiene menos de 32 caracteres: el botón de actualizar del panel no funcionará'
        );
    }

    const server = createServer({
        token,
        getJob: () => job,
        getSetupError: () => setupError
    });

    server.listen(port, '0.0.0.0', () => {
        console.log('Actualizador escuchando en el puerto ' + port);
    });

    discoverDeployment()
        .then(d => {
            linkWorkingDir(d.workingDir);
            job = createJob({ deployment: d });
            console.log('Despliegue detectado: proyecto ' + d.project + ' en ' + d.workingDir);
        })
        .catch(err => {
            setupError = err.message;
            console.error(err.message);
        });
}

if (require.main === module) {
    main();
}

module.exports = { createServer };
