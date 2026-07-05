/**
 * @fileoverview Ping anónimo de instalación vía ntfy.sh
 *
 * Al arrancar el servidor se envía un único ping HTTP (sin datos personales,
 * solo la versión) al topic público de ntfy.sh del proyecto para saber cuántas
 * instalaciones activas hay. Está documentado en el README y se desactiva con
 * XIRO_TELEMETRY=false. Nunca bloquea ni interrumpe el arranque.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('../config/logger');
const { version } = require('../package.json');

const NTFY_URL = 'https://ntfy.sh/xiro-install-c06449cec550e79013a0471d';
const MARKER_FILE = path.join(os.tmpdir(), '.xiro-telemetry-sent');
const TIMEOUT_MS = 3000;

function isEnabled() {
    return process.env.XIRO_TELEMETRY !== 'false';
}

// Solo el worker maestro del cluster PM2 envía el ping
function isMasterWorker() {
    return process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE;
}

// El marcador vive en /tmp del contenedor: un ping por contenedor, no por reinicio de PM2
function alreadySent() {
    try {
        return fs.existsSync(MARKER_FILE);
    } catch {
        return false;
    }
}

function markSent() {
    try {
        fs.writeFileSync(MARKER_FILE, new Date().toISOString());
    } catch {
        // Sin permisos de escritura: se reintentará en el próximo arranque, sin más efecto
    }
}

/**
 * Envía el ping de instalación (fire-and-forget).
 * @returns {Promise<boolean>} true si se envió, false si se omitió o falló
 */
async function sendInstallPing() {
    if (!isEnabled() || !isMasterWorker() || alreadySent()) {
        return false;
    }

    try {
        await fetch(NTFY_URL, {
            method: 'POST',
            headers: { Title: 'Xiro! instalado' },
            body: `Xiro! v${version} arrancado`,
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        markSent();
        logger.debug('Telemetry install ping sent', { version });
        return true;
    } catch (error) {
        // Sin salida a internet o ntfy caído: fallo silencioso, no afecta al arranque
        logger.debug('Telemetry install ping failed (ignored)', { error: error.message });
        return false;
    }
}

module.exports = { sendInstallPing, NTFY_URL, MARKER_FILE };
