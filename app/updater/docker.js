/** @fileoverview Ayudantes de bajo nivel para el actualizador: CLI de docker y API del daemon por el socket unix */
'use strict';
const { execFile } = require('child_process');
const http = require('http');
const SOCKET_PATH = process.env.DOCKER_SOCKET || '/var/run/docker.sock';

/**
 * Ejecuta un comando de docker
 * @param {string[]} args - Argumentos del comando
 * @param {Object} options - Opciones
 * @param {number} options.timeoutMs - Timeout en milisegundos
 * @returns {Promise<{ stdout: string, stderr: string }>} Resultado del comando
 */
function runDocker(args, options = {}) {
    const timeout = options.timeoutMs || 300000;
    return new Promise((resolve, reject) => {
        execFile('docker', args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                const firstArgs = args.slice(0, 2).join(' ');
                const message = String(stderr || '').trim() || error.message;
                const last500 = message.length > 500 ? message.substring(message.length - 500) : message;
                reject(new Error(`docker ${firstArgs} falló: ${last500}`));
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

/**
 * Hace una petición GET a la API de Docker
 * @param {string} apiPath - Ruta de la API
 * @param {Object} options - Opciones
 * @param {string} options.socketPath - Ruta del socket
 * @param {number} options.timeoutMs - Timeout en milisegundos
 * @returns {Promise<Object>} Respuesta JSON
 */
function dockerApiGet(apiPath, options = {}) {
    const socketPath = options.socketPath || SOCKET_PATH;
    const timeout = options.timeoutMs || 10000;
    return new Promise((resolve, reject) => {
        const req = http.get({ socketPath, path: apiPath, timeout }, (res) => {
            if (res.statusCode >= 400) {
                res.resume();
                reject(new Error(`Docker API ${res.statusCode} en ${apiPath}`));
                return;
            }

            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Respuesta inválida de Docker API en ${apiPath}: ${e.message}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(new Error(`Error de conexión con Docker API en ${apiPath}: ${err.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Timeout al conectar con Docker API en ${apiPath}`));
        });
    });
}

module.exports = { runDocker, dockerApiGet };
