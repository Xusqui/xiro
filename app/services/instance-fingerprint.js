'use strict';

/**
 * Derivación pura del instanceId de licencia a partir de identificadores
 * estables de la máquina. Sin I/O: las funciones de este módulo reciben
 * strings y devuelven strings, para poder testearse de forma determinista.
 *
 * Formato final: 'xiro-' + hex SHA-256 (64 chars) sobre los identificadores
 * concatenados con separador fijo y sal constante de la app. Nunca se envían
 * los identificadores de hardware en crudo, solo el hash.
 */

const crypto = require('crypto');

const FINGERPRINT_SALT = 'xiro-license-v1';
const SEPARATOR = '|';
const ID_PREFIX = 'xiro-';
const HASH_HEX_LENGTH = 64;

// UUIDs de placa conocidos como inválidos (BIOS sin serializar)
const BOGUS_UUIDS = new Set([
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '00000000-0000-0000-0000-000000000000',
    '03000200-0400-0500-0006-000700080009'
]);

function normalizeIdentifier(value) {
    if (typeof value !== 'string') return '';
    const normalized = value.trim().toLowerCase();
    return BOGUS_UUIDS.has(normalized) ? '' : normalized;
}

/**
 * Deriva el instanceId a partir de una lista de identificadores de plataforma.
 * Ignora entradas vacías o inválidas; devuelve null si no queda ninguna.
 */
function deriveInstanceId(identifiers) {
    const list = Array.isArray(identifiers) ? identifiers : [];
    const normalized = list.map(normalizeIdentifier).filter((v) => v.length > 0);
    if (normalized.length === 0) return null;

    const material = [FINGERPRINT_SALT, ...normalized].join(SEPARATOR);
    const digest = crypto.createHash('sha256').update(material, 'utf8').digest('hex');
    return `${ID_PREFIX}${digest.slice(0, HASH_HEX_LENGTH)}`;
}

/** macOS: extrae IOPlatformUUID de `ioreg -rd1 -c IOPlatformExpertDevice`. */
function parseIoregPlatformUuid(text) {
    const match = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(String(text || ''));
    return match ? match[1] : '';
}

/** Windows: extrae MachineGuid de la salida de `reg query`. */
function parseRegMachineGuid(text) {
    const match = /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(String(text || ''));
    return match ? match[1] : '';
}

/** Windows: extrae el UUID de Win32_ComputerSystemProduct (wmic/PowerShell). */
function parseHardwareUuid(text) {
    const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
        .exec(String(text || ''));
    return match ? match[1] : '';
}

/** Linux: contenido de /etc/machine-id (una línea hex). */
function parseMachineIdFile(text) {
    const line = String(text || '').trim().split('\n')[0].trim();
    return /^[0-9a-f]{32}$/i.test(line) ? line : '';
}

module.exports = {
    FINGERPRINT_SALT,
    ID_PREFIX,
    normalizeIdentifier,
    deriveInstanceId,
    parseIoregPlatformUuid,
    parseRegMachineGuid,
    parseHardwareUuid,
    parseMachineIdFile
};
