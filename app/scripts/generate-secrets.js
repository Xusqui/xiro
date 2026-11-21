/**
 * @fileoverview Crea los secretos de Xiro! la primera vez que se arranca (db, redis, JWT y
 * actualizador). Cada secreto es un fichero en la carpeta de destino (un volumen de Docker),
 * que el resto de contenedores leen con las variables *_FILE. Idempotente: nunca reescribe
 * un fichero que ya existe, y adopta los valores de un .env anterior para no rotar nada.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MIN_LONG_SECRET_LENGTH = 32;
const PLACEHOLDER_PATTERN = /^CAMBIA/;
const READ_ONLY_MODE = 0o444;

const SECRETS = [
    { file: 'db_password', envVar: 'DB_PASSWORD', bytes: 24, minLength: 1 },
    { file: 'redis_password', envVar: 'REDIS_PASSWORD', bytes: 24, minLength: 1 },
    { file: 'jwt_secret', envVar: 'JWT_SECRET', bytes: 32, minLength: MIN_LONG_SECRET_LENGTH },
    { file: 'updater_token', envVar: 'UPDATER_TOKEN', bytes: 32, minLength: MIN_LONG_SECRET_LENGTH }
];

/**
 * Valor de un .env anterior que se puede adoptar tal cual.
 * @param {string|undefined} value - Valor de la variable de entorno
 * @param {number} minLength - Longitud mínima aceptable
 * @returns {string|null} El valor sin espacios, o null si falta, es un texto de relleno o es corto
 */
function usableSeed(value, minLength) {
    const seed = String(value || '').trim();
    if (seed.length < minLength || PLACEHOLDER_PATTERN.test(seed)) return null;
    return seed;
}

/**
 * Escribe un secreto nuevo, de solo lectura, sin pisar nada.
 * El chmod explícito evita que el umask del proceso (p. ej. 077) deje el fichero ilegible
 * para los otros contenedores, que lo leen con otro uid (Redis usa el 999).
 * @param {string} filePath - Ruta del fichero
 * @param {string} value - Contenido, sin salto de línea final
 * @returns {void}
 */
function writeSecret(filePath, value) {
    fs.writeFileSync(filePath, value, { mode: READ_ONLY_MODE, flag: 'wx' });
    fs.chmodSync(filePath, READ_ONLY_MODE);
}

/**
 * Crea los secretos que faltan en una carpeta.
 * @param {Object} options - Opciones
 * @param {string} options.dir - Carpeta de destino
 * @param {Object<string,string>} options.env - Variables de entorno con valores previos que adoptar
 * @returns {{created: string[], kept: string[]}} Nombres de fichero creados y conservados (nunca valores)
 * @throws {Error} Si no se indica la carpeta o no se puede escribir en ella
 */
function generateSecrets({ dir, env }) {
    if (!dir) throw new Error('Falta dir: la carpeta donde guardar los secretos');
    fs.mkdirSync(dir, { recursive: true });

    const result = { created: [], kept: [] };
    for (const secret of SECRETS) {
        const target = path.join(dir, secret.file);
        if (fs.existsSync(target)) {
            result.kept.push(secret.file);
            continue;
        }
        const value =
            usableSeed(env[secret.envVar], secret.minLength) ||
            crypto.randomBytes(secret.bytes).toString('hex');
        writeSecret(target, value);
        result.created.push(secret.file);
    }
    return result;
}

/**
 * Punto de entrada del contenedor «secrets»: registra solo los nombres de fichero.
 * @returns {void}
 */
function main() {
    try {
        const { created, kept } = generateSecrets({
            dir: process.env.SECRETS_DIR || '/secrets',
            env: process.env
        });
        console.log(`[secrets] creados: ${created.join(', ') || 'ninguno'}; conservados: ${kept.join(', ') || 'ninguno'}`);
    } catch (error) {
        console.error(`[secrets] no se pudieron preparar los secretos: ${error.message}`);
        process.exitCode = 1;
    }
}

if (require.main === module) main();

module.exports = { generateSecrets };
