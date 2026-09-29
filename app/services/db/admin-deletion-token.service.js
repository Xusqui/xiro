/**
 * @fileoverview Pending deletion tokens for admin users
 */

const crypto = require('crypto');
const { pool } = require('../../config/database');
const adminUserService = require('./admin-user.service');

const TOKEN_TTL_HOURS = 24;

function hashToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function buildToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function createPendingDeletion({ userId }) {
    const token = buildToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

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

async function consumeDeletionToken(rawToken) {
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
            `SELECT id, user_id, expires_at, used_at
             FROM admin_user_deletion_tokens
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

        // Marcar token como usado antes de borrar el usuario para evitar race conditions
        // Aunque el borrado en cascada puede borrar este token si así estuviera configurado
        await client.query(
            `UPDATE admin_user_deletion_tokens
             SET used_at = NOW()
             WHERE id = $1`,
            [tokenRow.id]
        );
        
        // Obtener el usuario para poder devolver info
        const userResult = await client.query(
            `SELECT id, username, email, role FROM admin_users WHERE id = $1`,
            [tokenRow.user_id]
        );
        
        const user = userResult.rows[0];
        if (!user) {
            const err = new Error('Usuario no encontrado');
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        // Usamos el servicio principal para asegurar que aplican las reglas (no borrar último admin)
        // Pero OJO: deleteUserById ya tiene transacciones? No lo expone pool connect directo en su firma.
        // Si usamos el servicio principal `adminUserService.deleteUserById` internamente hace consultas sueltas con `pool.query`.
        // Para mantener atomicidad real y asegurarnos, llamamos a la funcion del servicio despues del commit del token, o lo hacemos aquí.
        // Vamos a hacer commit del token y luego delegar al adminUserService. Si falla el borrado, el token queda usado, pero el usuario debe repetir.
        await client.query('COMMIT');
        
        await adminUserService.deleteUserById(user.id);

        return {
            user
        };
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rbErr) {
                // Ignorar error de rollback
            }
        }
        throw error;
    } finally {
        if (client) {
            client.release();
        }
    }
}

module.exports = {
    createPendingDeletion,
    consumeDeletionToken
};
