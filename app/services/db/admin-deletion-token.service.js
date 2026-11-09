/**
 * @fileoverview Pending deletion tokens for admin users
 */

const { pool } = require('../../config/database');
const { issueToken, codedError, consumeToken } = require('./admin-token-flow');
const adminUserService = require('./admin-user.service');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const SELECT_TOKEN_SQL = `SELECT id, user_id, expires_at, used_at
     FROM admin_user_deletion_tokens
     WHERE token_hash = $1
     LIMIT 1
     FOR UPDATE`;

const MARK_TOKEN_USED_SQL = `UPDATE admin_user_deletion_tokens
     SET used_at = NOW()
     WHERE id = $1`;

/**
 * Crea un token de borrado de cuenta y descarta los pendientes previos del usuario.
 * @param {Object} deletion
 * @param {number} deletion.userId - ID del usuario
 * @returns {Promise<{token: string, expiresAt: Date}>} Token en claro (solo se guarda su SHA-256) y caducidad
 * @throws {Error} Si falla la consulta
 */
async function createPendingDeletion({ userId }) {
    const { token, tokenHash, expiresAt } = issueToken(TOKEN_TTL_MS);

    await pool.query(
        `DELETE FROM admin_user_deletion_tokens
         WHERE user_id = $1
           AND used_at IS NULL`,
        [userId]
    );

    await pool.query(
        `INSERT INTO admin_user_deletion_tokens
         (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
    );

    return {
        token,
        expiresAt
    };
}

async function findTokenOwner(client, tokenRow) {
    const userResult = await client.query(`SELECT id, username, email, role FROM admin_users WHERE id = $1`, [
        tokenRow.user_id
    ]);
    const user = userResult.rows[0];
    if (!user) throw codedError('Usuario no encontrado', 'USER_NOT_FOUND');
    return user;
}

/**
 * Canjea un token de borrado: marca el token como usado (con commit) y después borra el usuario. Si el borrado falla,
 * el token ya queda usado y hay que pedir otro.
 * @param {string} rawToken - Token en claro recibido por email
 * @returns {Promise<{user: Object}>} Usuario borrado {id, username, email, role}
 * @throws {Error} code 'TOKEN_INVALID' si falta el token o no existe
 * @throws {Error} code 'TOKEN_ALREADY_USED' si ya se usó
 * @throws {Error} code 'TOKEN_EXPIRED' si caducó
 * @throws {Error} code 'USER_NOT_FOUND' si el usuario ya no existe
 * @throws {Error} Si falla la consulta
 */
async function consumeDeletionToken(rawToken) {
    const user = await consumeToken({
        rawToken,
        selectSql: SELECT_TOKEN_SQL,
        markUsedSql: MARK_TOKEN_USED_SQL,
        apply: findTokenOwner,
        markUsedFirst: true
    });

    // Después de confirmar: deleteUserById usa el pool, no esta transacción. Si falla, el token queda usado
    // y el usuario tiene que pedir otro.
    await adminUserService.deleteUserById(user.id);

    return { user };
}

module.exports = {
    createPendingDeletion,
    consumeDeletionToken
};
