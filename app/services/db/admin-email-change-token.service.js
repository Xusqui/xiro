/**
 * @fileoverview Pending email change tokens for admin users
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

async function createPendingEmailChange({ userId, oldEmail, newEmail }) {
    const token = buildToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

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

async function consumeEmailChangeToken(rawToken) {
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
            `SELECT id, user_id, old_email, new_email, expires_at, used_at
             FROM admin_user_email_change_tokens
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

        const updateResult = await client.query(
            `UPDATE admin_users
             SET email = LOWER($2),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, username, email, role`,
            [tokenRow.user_id, tokenRow.new_email]
        );

        if (updateResult.rowCount === 0) {
            const err = new Error('Usuario no encontrado');
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        await client.query(
            `UPDATE admin_user_email_change_tokens
             SET used_at = NOW()
             WHERE id = $1`,
            [tokenRow.id]
        );

        await client.query('COMMIT');

        return {
            user: updateResult.rows[0],
            oldEmail: tokenRow.old_email,
            newEmail: tokenRow.new_email
        };
    } catch (error) {
        await client.query('ROLLBACK');

        if (error.code === '23505') {
            const err = new Error('El correo ya está en uso');
            err.code = 'EMAIL_ALREADY_IN_USE';
            throw err;
        }

        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    createPendingEmailChange,
    consumeEmailChangeToken
};
