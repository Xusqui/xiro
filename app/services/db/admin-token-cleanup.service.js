'use strict';

/**
 * @fileoverview Borra los tokens de cuenta caducados, que guardan correos y hashes
 * de contraseña y no sirven para nada una vez vencidos.
 */

const { pool } = require('../../config/database');
const logger = require('../../config/logger');

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PURGE_STATEMENTS = [
    'DELETE FROM admin_user_registration_tokens WHERE expires_at < NOW()',
    'DELETE FROM admin_user_email_change_tokens WHERE expires_at < NOW()',
    'DELETE FROM admin_user_deletion_tokens WHERE expires_at < NOW()',
    'DELETE FROM admin_user_password_reset_tokens WHERE expires_at < NOW()'
];

/**
 * @returns {Promise<number>} Tokens borrados
 * @throws {Error} Si falla la consulta
 */
async function purgeExpiredAdminTokens() {
    let removed = 0;
    for (const statement of PURGE_STATEMENTS) {
        const result = await pool.query(statement);
        removed += result.rowCount;
    }
    return removed;
}

function runPurge() {
    return purgeExpiredAdminTokens()
        .then(removed => logger.info('Expired admin tokens purged', { removed }))
        .catch(error => logger.error('Expired admin token purge failed', { error: error.message }));
}

/**
 * Purga al arrancar y luego cada 24 h. Debe llamarse desde un solo worker.
 * @returns {NodeJS.Timeout} Temporizador de la purga
 */
function startAdminTokenCleanup() {
    runPurge();
    return setInterval(runPurge, CLEANUP_INTERVAL_MS).unref();
}

module.exports = { purgeExpiredAdminTokens, startAdminTokenCleanup };
