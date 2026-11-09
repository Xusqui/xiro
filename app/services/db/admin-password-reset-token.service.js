/**
 * @fileoverview Pending password reset tokens for admin panel users
 */

const { pool } = require('../../config/database');
const { issueToken, codedError, consumeToken } = require('./admin-token-flow');

const TOKEN_TTL_MS = 60 * 60 * 1000;

const SELECT_TOKEN_SQL = `SELECT id, user_id, expires_at, used_at
     FROM admin_user_password_reset_tokens
     WHERE token_hash = $1
     LIMIT 1
     FOR UPDATE`;

const MARK_TOKEN_USED_SQL = `UPDATE admin_user_password_reset_tokens
     SET used_at = NOW()
     WHERE id = $1`;

/**
 * Crea un token de restablecimiento de contraseña (60 min) y descarta los pendientes previos del usuario.
 * @param {Object} reset
 * @param {number} reset.userId - ID del usuario
 * @returns {Promise<{token: string, expiresAt: Date}>} Token en claro (solo se guarda su SHA-256) y caducidad
 * @throws {Error} Si falla la consulta
 */
async function createPendingPasswordReset({ userId }) {
    const { token, tokenHash, expiresAt } = issueToken(TOKEN_TTL_MS);

    await pool.query(
        `DELETE FROM admin_user_password_reset_tokens
         WHERE user_id = $1
           AND used_at IS NULL`,
        [userId]
    );

    await pool.query(
        `INSERT INTO admin_user_password_reset_tokens
         (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
    );

    return {
        token,
        expiresAt
    };
}

async function applyNewPassword(client, tokenRow, newPasswordHash) {
    const updateResult = await client.query(
        `UPDATE admin_users
         SET password_hash = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, username, email, role`,
        [tokenRow.user_id, newPasswordHash]
    );

    if (updateResult.rowCount === 0) throw codedError('Usuario no encontrado', 'USER_NOT_FOUND');

    return updateResult.rows[0];
}

/**
 * Canjea un token de restablecimiento: guarda la contraseña nueva y marca el token como usado, en una transacción.
 * @param {string} rawToken - Token en claro recibido por email
 * @param {string} newPasswordHash - Hash scrypt de la contraseña nueva
 * @returns {Promise<Object>} Usuario actualizado {id, username, email, role}
 * @throws {Error} code 'TOKEN_INVALID' si falta el token o no existe
 * @throws {Error} code 'TOKEN_ALREADY_USED' si ya se usó
 * @throws {Error} code 'TOKEN_EXPIRED' si caducó
 * @throws {Error} code 'USER_NOT_FOUND' si el usuario ya no existe
 * @throws {Error} Si falla la consulta
 */
function consumePasswordResetToken(rawToken, newPasswordHash) {
    return consumeToken({
        rawToken,
        selectSql: SELECT_TOKEN_SQL,
        markUsedSql: MARK_TOKEN_USED_SQL,
        apply: (client, tokenRow) => applyNewPassword(client, tokenRow, newPasswordHash)
    });
}

module.exports = {
    createPendingPasswordReset,
    consumePasswordResetToken
};
