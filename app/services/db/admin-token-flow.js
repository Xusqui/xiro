/**
 * @fileoverview Flujo común de los tokens de un solo uso del panel (alta, cambio de email, borrado de cuenta y
 * restablecimiento de contraseña): generación y canje transaccional. El SQL lo aporta cada servicio, escrito
 * entero, para que no haya nombres de tabla interpolados.
 */

const crypto = require('crypto');
const { pool } = require('../../config/database');
const logger = require('../../config/logger');

const UNIQUE_VIOLATION = '23505';

/**
 * Hash con el que se guarda y se busca un token; en la base de datos nunca está en claro.
 * @param {*} rawToken - Token en claro
 * @returns {string} SHA-256 en hexadecimal
 */
function hashToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

/**
 * Genera un token aleatorio con su hash y su caducidad.
 * @param {number} ttlMs - Validez en milisegundos
 * @returns {{token: string, tokenHash: string, expiresAt: Date}}
 */
function issueToken(ttlMs) {
    const token = crypto.randomBytes(32).toString('hex');
    return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) };
}

/**
 * Crea un Error con `code`, el campo que usan las rutas para responder.
 * @param {string} message - Mensaje
 * @param {string} code - Código de error
 * @returns {Error}
 */
function codedError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function assertTokenUsable(tokenRow) {
    if (!tokenRow) throw codedError('Token inválido', 'TOKEN_INVALID');
    if (tokenRow.used_at) throw codedError('Token ya utilizado', 'TOKEN_ALREADY_USED');
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) throw codedError('Token expirado', 'TOKEN_EXPIRED');
}

// Un fallo del propio ROLLBACK no debe tapar el error que lo provocó
async function rollbackKeepingError(client) {
    try {
        await client.query('ROLLBACK');
    } catch (rollbackError) {
        logger.warn('admin-token-flow: falló el rollback del canje del token', { error: rollbackError.message });
    }
}

/**
 * Canjea un token en una transacción: lo busca con bloqueo de fila, comprueba que siga siendo válido, aplica el
 * cambio y lo marca como usado. Si algo falla, deshace todo.
 * @param {Object} options
 * @param {string} options.rawToken - Token en claro
 * @param {string} options.selectSql - SELECT ... FOR UPDATE por token_hash ($1) con id, expires_at y used_at
 * @param {string} options.markUsedSql - UPDATE que marca el token por id ($1)
 * @param {function(Object, Object): Promise<*>} options.apply - Recibe (client, tokenRow) y devuelve el resultado
 * @param {{message: string, code: string}} [options.uniqueViolation] - Error que sustituye a un 23505
 * @param {boolean} [options.markUsedFirst=false] - Marcar el token antes de aplicar el cambio
 * @returns {Promise<*>} Lo que devuelva `apply`
 * @throws {Error} code 'TOKEN_INVALID', 'TOKEN_ALREADY_USED' o 'TOKEN_EXPIRED'; los errores de `apply` y de la consulta
 */
async function consumeToken({ rawToken, selectSql, markUsedSql, apply, uniqueViolation, markUsedFirst = false }) {
    if (!rawToken) throw codedError('Token inválido', 'TOKEN_INVALID');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(selectSql, [hashToken(rawToken)]);
        const tokenRow = rows[0];
        assertTokenUsable(tokenRow);

        if (markUsedFirst) await client.query(markUsedSql, [tokenRow.id]);
        const result = await apply(client, tokenRow);
        if (!markUsedFirst) await client.query(markUsedSql, [tokenRow.id]);

        await client.query('COMMIT');
        return result;
    } catch (error) {
        await rollbackKeepingError(client);
        if (uniqueViolation && error.code === UNIQUE_VIOLATION) {
            throw codedError(uniqueViolation.message, uniqueViolation.code);
        }
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { hashToken, issueToken, codedError, consumeToken };
