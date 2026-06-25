/**
 * @fileoverview Servicio para actualizar parámetros en el archivo .env
 * Preserva comentarios, espacios y otras variables no gestionadas.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Localiza el archivo .env usando la misma lógica que env.js
 */
function findEnvFile() {
    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '..', '.env'),
        path.resolve(__dirname, '..', '..', '.env'),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return null;
}

/**
 * Actualiza el valor de una clave en el archivo .env.
 * Si la clave no existe en el archivo, la añade al final.
 * Preserva todos los comentarios y otras variables.
 *
 * @param {string} envKey  - Nombre de la variable (ej: 'MAX_PLAYERS_PER_GAME')
 * @param {string} newValue - Nuevo valor (se convierte a string)
 * @returns {{ ok: boolean, error?: string }}
 */
function updateEnvKey(envKey, newValue) {
    const filePath = findEnvFile();
    if (!filePath) {
        return { ok: false, error: 'No se encontró el archivo .env', code: 'ENV_FILE_NOT_FOUND' };
    }

    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        return { ok: false, error: `No se pudo leer .env: ${err.message}`, code: 'ENV_READ_FAILED', params: { detail: err.message } };
    }

    const lines = content.split('\n');
    let found = false;

    const updated = lines.map(line => {
        const trimmed = line.trim();
        // Saltar comentarios y líneas vacías
        if (!trimmed || trimmed.startsWith('#')) return line;

        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return line;

        const lineKey = line.slice(0, eqIdx).trim();
        if (lineKey !== envKey) return line;

        found = true;
        // Preservar si había comentario inline al final de la línea
        const valueAndComment = line.slice(eqIdx + 1);
        const commentIdx = valueAndComment.indexOf('  #');
        const inlineComment = commentIdx !== -1
            ? valueAndComment.slice(commentIdx)
            : '';

        return `${envKey}=${newValue}${inlineComment}`;
    });

    if (!found) {
        updated.push(`${envKey}=${newValue}`);
    }

    try {
        fs.writeFileSync(filePath, updated.join('\n'), 'utf8');
        return { ok: true };
    } catch (err) {
        return { ok: false, error: `No se pudo escribir .env: ${err.message}`, code: 'ENV_WRITE_FAILED', params: { detail: err.message } };
    }
}

/**
 * Actualiza múltiples claves en una sola operación de lectura/escritura.
 * @param {Object} updates - { envKey: newValue, ... }
 * @returns {{ ok: boolean, error?: string }}
 */
function updateEnvKeys(updates) {
    const filePath = findEnvFile();
    if (!filePath) {
        return { ok: false, error: 'No se encontró el archivo .env', code: 'ENV_FILE_NOT_FOUND' };
    }

    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        return { ok: false, error: `No se pudo leer .env: ${err.message}`, code: 'ENV_READ_FAILED', params: { detail: err.message } };
    }

    const found = {};
    const lines = content.split('\n');

    const updated = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return line;
        const lineKey = line.slice(0, eqIdx).trim();
        if (!(lineKey in updates)) return line;

        found[lineKey] = true;
        const valueAndComment = line.slice(eqIdx + 1);
        const commentIdx = valueAndComment.indexOf('  #');
        const inlineComment = commentIdx !== -1 ? valueAndComment.slice(commentIdx) : '';
        return `${lineKey}=${updates[lineKey]}${inlineComment}`;
    });

    // Añadir las claves que no existían
    for (const [key, val] of Object.entries(updates)) {
        if (!found[key]) updated.push(`${key}=${val}`);
    }

    try {
        fs.writeFileSync(filePath, updated.join('\n'), 'utf8');
        return { ok: true };
    } catch (err) {
        return { ok: false, error: `No se pudo escribir .env: ${err.message}`, code: 'ENV_WRITE_FAILED', params: { detail: err.message } };
    }
}

module.exports = { updateEnvKey, updateEnvKeys, findEnvFile };
