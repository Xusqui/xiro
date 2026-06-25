/**
 * @fileoverview Carga variables de entorno desde .env si existen.
 * Se omiten claves ya definidas para no sobrescribir.
 */

const fs = require('fs');
const path = require('path');

function stripInlineComment(value) {
    const commentIndex = value.indexOf(' #');
    if (commentIndex === -1) return value.trim();
    return value.slice(0, commentIndex).trim();
}

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return false;

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) return;

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        value = stripInlineComment(value);

        if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
            process.env[key] = value;
        }
    });

    return true;
}

if (!process.env.XIRO_ENV_LOADED) {
    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '..', '.env'),
        path.resolve(__dirname, '..', '..', '.env')
    ];

    for (const candidate of candidates) {
        if (loadEnvFile(candidate)) {
            break;
        }
    }

    process.env.XIRO_ENV_LOADED = 'true';
}

/**
 * Lee un secreto desde variable de entorno directa o desde fichero (*_FILE).
 * El fichero tiene prioridad solo si la variable directa no está definida.
 * Escribe el valor resuelto de vuelta en process.env para que el resto del
 * código lo lea de forma transparente.
 * @param {string} envVar   - Nombre de la variable de entorno directa
 * @param {string} fileVar  - Nombre de la variable que apunta al fichero
 */
function resolveSecretFromFile(envVar, fileVar) {
    if (process.env[envVar]) return; // ya tiene valor, no hacer nada
    const filePath = process.env[fileVar];
    if (!filePath) return;
    try {
        const value = fs.readFileSync(filePath, 'utf8').trim();
        if (value) process.env[envVar] = value;
    } catch (_e) {
        // fichero no accesible — continuar sin él
    }
}

// Resolver secretos desde fichero si las vars directas no están definidas
resolveSecretFromFile('JWT_SECRET', 'JWT_SECRET_FILE');
resolveSecretFromFile('DB_PASSWORD', 'DB_PASSWORD_FILE');
resolveSecretFromFile('REDIS_PASSWORD', 'REDIS_PASSWORD_FILE');

module.exports = { loadEnvFile };
