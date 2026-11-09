/**
 * @fileoverview Pending registration tokens for admin panel users
 */

const { pool } = require('../../config/database');
const { issueToken, consumeToken } = require('./admin-token-flow');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const SELECT_TOKEN_SQL = `SELECT id, username, email, password_hash, expires_at, used_at, terms_version, terms_accepted_at
     FROM admin_user_registration_tokens
     WHERE token_hash = $1
     LIMIT 1
     FOR UPDATE`;

const MARK_TOKEN_USED_SQL = `UPDATE admin_user_registration_tokens
     SET used_at = NOW()
     WHERE id = $1`;

/**
 * Crea un token de alta pendiente (24 h) y descarta los pendientes previos con el mismo usuario o email.
 * @param {Object} registration
 * @param {string} registration.username - Nombre de usuario
 * @param {string} registration.email - Email
 * @param {string} registration.passwordHash - Hash scrypt de la contraseña
 * @param {string} registration.termsVersion - Versión de los términos aceptada al registrarse
 * @returns {Promise<{token: string, expiresAt: Date}>} Token en claro (solo se guarda su SHA-256) y caducidad
 * @throws {Error} Si falla la consulta
 */
async function createPendingRegistration({ username, email, passwordHash, termsVersion }) {
    const { token, tokenHash, expiresAt } = issueToken(TOKEN_TTL_MS);

    await pool.query(
        `DELETE FROM admin_user_registration_tokens
         WHERE used_at IS NULL
           AND (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2))`,
        [username, email]
    );

    await pool.query(
        `INSERT INTO admin_user_registration_tokens
         (token_hash, username, email, password_hash, expires_at, terms_version, terms_accepted_at)
         VALUES ($1, LOWER($2), LOWER($3), $4, $5, $6, NOW())`,
        [tokenHash, username, email, passwordHash, expiresAt, termsVersion]
    );

    return {
        token,
        expiresAt
    };
}

async function createUserFromToken(client, tokenRow) {
    const userResult = await client.query(
        `INSERT INTO admin_users (username, email, password_hash, role, is_active, is_verified, terms_version, terms_accepted_at)
         VALUES (LOWER($1), LOWER($2), $3, 'editor', true, true, $4, $5)
         RETURNING id, username, email, role, is_active, is_verified, created_at`,
        [tokenRow.username, tokenRow.email, tokenRow.password_hash, tokenRow.terms_version, tokenRow.terms_accepted_at]
    );
    return userResult.rows[0];
}

/**
 * Canjea un token de alta: crea el usuario como editor verificado y marca el token como usado, en una transacción.
 * @param {string} rawToken - Token en claro recibido por email
 * @returns {Promise<Object>} Usuario creado {id, username, email, role, is_active, is_verified, created_at}
 * @throws {Error} code 'TOKEN_INVALID' si falta el token o no existe
 * @throws {Error} code 'TOKEN_ALREADY_USED' si ya se usó
 * @throws {Error} code 'TOKEN_EXPIRED' si caducó
 * @throws {Error} code 'USER_ALREADY_EXISTS' si el usuario o el email ya existen
 * @throws {Error} Si falla la consulta
 */
function consumeRegistrationToken(rawToken) {
    return consumeToken({
        rawToken,
        selectSql: SELECT_TOKEN_SQL,
        markUsedSql: MARK_TOKEN_USED_SQL,
        apply: createUserFromToken,
        uniqueViolation: { message: 'Usuario o email ya existe', code: 'USER_ALREADY_EXISTS' }
    });
}

module.exports = {
    createPendingRegistration,
    consumeRegistrationToken
};
