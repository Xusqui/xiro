/**
 * @fileoverview Pending email change tokens for admin users
 */

const { pool } = require('../../config/database');
const { issueToken, codedError, consumeToken } = require('./admin-token-flow');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const SELECT_TOKEN_SQL = `SELECT id, user_id, old_email, new_email, expires_at, used_at
     FROM admin_user_email_change_tokens
     WHERE token_hash = $1
     LIMIT 1
     FOR UPDATE`;

const MARK_TOKEN_USED_SQL = `UPDATE admin_user_email_change_tokens
     SET used_at = NOW()
     WHERE id = $1`;

/**
 * Crea un token de cambio de email y descarta los pendientes previos del usuario.
 * @param {Object} change
 * @param {number} change.userId - ID del usuario
 * @param {string} change.oldEmail - Email actual
 * @param {string} change.newEmail - Email nuevo
 * @returns {Promise<{token: string, expiresAt: Date}>} Token en claro (solo se guarda su SHA-256) y caducidad
 * @throws {Error} Si falla la consulta
 */
async function createPendingEmailChange({ userId, oldEmail, newEmail }) {
    const { token, tokenHash, expiresAt } = issueToken(TOKEN_TTL_MS);

    await pool.query(
        `DELETE FROM admin_user_email_change_tokens
         WHERE user_id = $1
           AND used_at IS NULL`,
        [userId]
    );

    await pool.query(
        `INSERT INTO admin_user_email_change_tokens
         (user_id, old_email, new_email, token_hash, expires_at)
         VALUES ($1, LOWER($2), LOWER($3), $4, $5)`,
        [userId, oldEmail, newEmail, tokenHash, expiresAt]
    );

    return {
        token,
        expiresAt
    };
}

async function applyEmailChange(client, tokenRow) {
    const updateResult = await client.query(
        `UPDATE admin_users
         SET email = LOWER($2),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, username, email, role`,
        [tokenRow.user_id, tokenRow.new_email]
    );

    if (updateResult.rowCount === 0) throw codedError('Usuario no encontrado', 'USER_NOT_FOUND');

    return { user: updateResult.rows[0], oldEmail: tokenRow.old_email, newEmail: tokenRow.new_email };
}

/**
 * Canjea un token de cambio de email: aplica el email nuevo y marca el token como usado, en una transacción.
 * @param {string} rawToken - Token en claro recibido por email
 * @returns {Promise<{user: Object, oldEmail: string, newEmail: string}>} Usuario actualizado {id, username, email,
 *   role} y los dos emails
 * @throws {Error} code 'TOKEN_INVALID' si falta el token o no existe
 * @throws {Error} code 'TOKEN_ALREADY_USED' si ya se usó
 * @throws {Error} code 'TOKEN_EXPIRED' si caducó
 * @throws {Error} code 'USER_NOT_FOUND' si el usuario ya no existe
 * @throws {Error} code 'EMAIL_ALREADY_IN_USE' si otro usuario tiene ese email
 * @throws {Error} Si falla la consulta
 */
function consumeEmailChangeToken(rawToken) {
    return consumeToken({
        rawToken,
        selectSql: SELECT_TOKEN_SQL,
        markUsedSql: MARK_TOKEN_USED_SQL,
        apply: applyEmailChange,
        uniqueViolation: { message: 'El correo ya está en uso', code: 'EMAIL_ALREADY_IN_USE' }
    });
}

module.exports = {
    createPendingEmailChange,
    consumeEmailChangeToken
};
