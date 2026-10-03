'use strict';

/**
 * instanceId estable para el licenciamiento, derivado de la huella de
 * hardware de la máquina (misma máquina → mismo id, incluso tras reinstalar).
 *
 * Fuentes por plataforma:
 *  - macOS:   IOPlatformUUID (`ioreg -rd1 -c IOPlatformExpertDevice`)
 *  - Linux:   /etc/machine-id (fallback /var/lib/dbus/machine-id)
 *  - Windows: MachineGuid (HKLM\SOFTWARE\Microsoft\Cryptography) +
 *             UUID de Win32_ComputerSystemProduct
 *
 * Si ninguna fuente está disponible, se genera un UUID aleatorio una sola
 * vez, se persiste en config/instance-id.json y se marca como 'fallback'.
 * La huella de hardware siempre tiene prioridad sobre el fallback persistido.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fingerprint = require('./instance-fingerprint');

// INSTANCE_ID_FILE permite aislarlo (jest.setup.js lo apunta a una ruta inexistente
// para que los tests no escriban el identificador real de la instalación).
const FALLBACK_FILE = process.env.INSTANCE_ID_FILE || path.join(__dirname, '..', 'config', 'instance-id.json');
const EXEC_OPTS = { encoding: 'utf8', timeout: 5000, windowsHide: true };

let _cache = null;

function _safeExec(exec, command, args) {
    try {
        return exec(command, args, EXEC_OPTS) || '';
    } catch (_error) {
        return '';
    }
}

function _safeRead(read, filePath) {
    try {
        return read(filePath, 'utf8') || '';
    } catch (_error) {
        return '';
    }
}

/** Recoge los identificadores crudos de la plataforma indicada. */
function collectHardwareIdentifiers(platform, { exec = execFileSync, read = fs.readFileSync, machineIdPath } = {}) {
    if (platform === 'darwin') {
        const ioreg = _safeExec(exec, 'ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']);
        return [fingerprint.parseIoregPlatformUuid(ioreg)];
    }
    if (platform === 'linux') {
        // En Docker no hay /etc/machine-id fiable: MACHINE_ID_PATH permite
        // montar el del host (p. ej. /host/machine-id en docker-compose).
        const candidates = [
            machineIdPath || process.env.MACHINE_ID_PATH,
            '/etc/machine-id',
            '/var/lib/dbus/machine-id'
        ].filter(Boolean);
        for (const candidate of candidates) {
            const machineId = fingerprint.parseMachineIdFile(_safeRead(read, candidate));
            if (machineId) return [machineId];
        }
        return [];
    }
    if (platform === 'win32') {
        const reg = _safeExec(exec, 'reg', [
            'query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'
        ]);
        const csproduct = _safeExec(exec, 'powershell', [
            '-NoProfile', '-Command', '(Get-CimInstance Win32_ComputerSystemProduct).UUID'
        ]);
        return [fingerprint.parseRegMachineGuid(reg), fingerprint.parseHardwareUuid(csproduct)];
    }
    return [];
}

function _loadOrCreateFallbackId({ read = fs.readFileSync, write = fs.writeFileSync, uuid = crypto.randomUUID, storePath = FALLBACK_FILE } = {}) {
    try {
        const stored = JSON.parse(read(storePath, 'utf8'));
        if (typeof stored?.fallbackInstanceId === 'string' && stored.fallbackInstanceId.length >= 3) {
            return stored.fallbackInstanceId;
        }
    } catch (_error) {
        // sin fichero previo o corrupto: se regenera abajo
    }
    const fallbackId = fingerprint.deriveInstanceId([uuid()]);
    try {
        write(storePath, JSON.stringify({ fallbackInstanceId: fallbackId }, null, 2), 'utf8');
        // Relectura para converger si varios workers PM2 escriben a la vez:
        // todos acaban usando el valor que quedó persistido.
        const persisted = JSON.parse(read(storePath, 'utf8'));
        if (typeof persisted?.fallbackInstanceId === 'string' && persisted.fallbackInstanceId.length >= 3) {
            return persisted.fallbackInstanceId;
        }
    } catch (_error) {
        // sin permisos de escritura: el id vivirá solo en memoria este proceso
    }
    return fallbackId;
}

/**
 * Devuelve `{ instanceId, source }` donde source es 'hardware' o 'fallback'.
 * El resultado se cachea en proceso (la huella no cambia en caliente).
 */
function getInstanceId(deps = {}) {
    if (_cache && !deps.noCache) return _cache;

    const platform = deps.platform || os.platform();
    const identifiers = collectHardwareIdentifiers(platform, deps);
    const hardwareId = fingerprint.deriveInstanceId(identifiers);

    const result = hardwareId
        ? { instanceId: hardwareId, source: 'hardware' }
        : { instanceId: _loadOrCreateFallbackId(deps), source: 'fallback' };

    if (!deps.noCache) _cache = result;
    return result;
}

/** Solo para tests. */
function _resetCache() {
    _cache = null;
}

module.exports = {
    FALLBACK_FILE,
    collectHardwareIdentifiers,
    getInstanceId,
    _resetCache
};
