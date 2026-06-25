/**
 * @fileoverview Pending registration tokens for admin panel users
 */

const crypto = require('crypto');
const { pool } = require('../../config/database');

const TOKEN_TTL_HOURS = 24;

function hashToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function buildToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function createPendingRegistration({ username, email, passwordHash }) {
    const token = buildToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await pool.query(
        `DELETE FROM admin_user_registration_tokens
         WHERE used_at IS NULL
           AND (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2))`,
        [username, email]
    );

    await pool.query(
        `INSERT INTO admin_user_registration_tokens
         (token_hash, username, email, password_hash, expires_at)
         VALUES ($1, LOWER($2), LOWER($3), $4, $5)`,
        [tokenHash, username, email, passwordHash, expiresAt]
    );

    return {
        token,
        expiresAt
    };
}

async function consumeRegistrationToken(rawToken) {
    if (!rawToken) {
        const err = new Error('Token inválido');
        err.code = 'TOKEN_INVALID';
        throw err;
    }

    const tokenHash = hashToken(rawToken);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const tokenResult = await client.query(
            `SELECT id, username, email, password_hash, expires_at, used_at
             FROM admin_user_registration_tokens
             WHERE token_hash = $1
             LIMIT 1
             FOR UPDATE`,
            [tokenHash]
        );

        const tokenRow = tokenResult.rows[0];

        if (!tokenRow) {
            const err = new Error('Token inválido');
            err.code = 'TOKEN_INVALID';
            throw err;
        }

        if (tokenRow.used_at) {
            const err = new Error('Token ya utilizado');
            err.code = 'TOKEN_ALREADY_USED';
            throw err;
        }

        if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
            const err = new Error('Token expirado');
            err.code = 'TOKEN_EXPIRED';
            throw err;
        }

        const userResult = await client.query(
            `INSERT INTO admin_users (username, email, password_hash, role, is_active, is_verified)
             VALUES (LOWER($1), LOWER($2), $3, 'editor', true, true)
             RETURNING id, username, email, role, is_active, is_verified, created_at`,
            [tokenRow.username, tokenRow.email, tokenRow.password_hash]
        );

        await client.query(
            `UPDATE admin_user_registration_tokens
             SET used_at = NOW()
             WHERE id = $1`,
            [tokenRow.id]
        );

        await client.query('COMMIT');
        return userResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');

        if (error.code === '23505') {
            const err = new Error('Usuario o email ya existe');
            err.code = 'USER_ALREADY_EXISTS';
            throw err;
        }

        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    createPendingRegistration,
    consumeRegistrationToken
};
