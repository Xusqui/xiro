/**
 * @fileoverview Admin users database operations
 * @module services/db/admin-user.service
 */

const { pool } = require('../../config/database');

function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function hasAnyUsers(queryable = pool) {
    const result = await queryable.query(
        'SELECT EXISTS(SELECT 1 FROM admin_users) AS has_users'
    );
    return result.rows[0]?.has_users === true;
}

async function getActiveUserByUsername(username, queryable = pool) {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) return null;

    const result = await queryable.query(
        `SELECT id, username, email, password_hash, role, is_active, is_verified
         FROM admin_users
         WHERE LOWER(username) = LOWER($1)
         LIMIT 1`,
        [normalizedUsername]
    );

    const user = result.rows[0];
    if (!user || !user.is_active || !user.is_verified) return null;

    return user;
}

async function getActiveUserByEmail(email, queryable = pool) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;

    const result = await queryable.query(
        `SELECT id, username, email, password_hash, role, is_active, is_verified
         FROM admin_users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [normalizedEmail]
    );

    const user = result.rows[0];
    if (!user || !user.is_active || !user.is_verified) return null;

    return user;
}

async function getActiveUserById(userId, queryable = pool) {
    const result = await queryable.query(
        `SELECT id, username, email, password_hash, role, is_active, is_verified
         FROM admin_users
         WHERE id = $1
           AND is_active = true
           AND is_verified = true
         LIMIT 1`,
        [userId]
    );

    return result.rows[0] || null;
}

async function findExistingUserByUsernameOrEmail(username, email, queryable = pool) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);

    const result = await queryable.query(
        `SELECT id, username, email
         FROM admin_users
         WHERE LOWER(username) = LOWER($1)
            OR LOWER(email) = LOWER($2)
         LIMIT 1`,
        [normalizedUsername, normalizedEmail]
    );

    return result.rows[0] || null;
}

async function findUserByEmail(email, queryable = pool) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;

    const result = await queryable.query(
        `SELECT id, username, email
         FROM admin_users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [normalizedEmail]
    );

    return result.rows[0] || null;
}

async function createFirstAdminUser(username, email, passwordHash) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedUsername || !normalizedEmail) {
        const err = new Error('Usuario o email inválido');
        err.code = 'INVALID_USERNAME';
        throw err;
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query('LOCK TABLE admin_users IN EXCLUSIVE MODE');

        const countResult = await client.query(
            'SELECT COUNT(*)::int AS total FROM admin_users'
        );

        if ((countResult.rows[0]?.total || 0) > 0) {
            await client.query('COMMIT');
            return null;
        }

        const insertResult = await client.query(
            `INSERT INTO admin_users (username, email, password_hash, role, is_verified)
             VALUES ($1, $2, $3, 'admin', true)
             RETURNING id, username, email, role, is_active, is_verified, created_at`,
            [normalizedUsername, normalizedEmail, passwordHash]
        );

        await client.query('COMMIT');

        return {
            ...insertResult.rows[0],
            isFirstUser: true
        };
    } catch (error) {
        await client.query('ROLLBACK');

        if (error.code === '23505') {
            const err = new Error('El nombre de usuario o email ya existe');
            err.code = 'USERNAME_TAKEN';
            throw err;
        }

        throw error;
    } finally {
        client.release();
    }
}

async function createUserWithAutoRole(username, email, passwordHash) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedUsername || !normalizedEmail) {
        const err = new Error('Usuario o email inválido');
        err.code = 'INVALID_USERNAME';
        throw err;
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query('LOCK TABLE admin_users IN EXCLUSIVE MODE');

        const countResult = await client.query(
            'SELECT COUNT(*)::int AS total FROM admin_users'
        );

        const isFirstUser = countResult.rows[0]?.total === 0;
        const role = isFirstUser ? 'admin' : 'editor';

        const insertResult = await client.query(
            `INSERT INTO admin_users (username, email, password_hash, role, is_verified)
             VALUES ($1, $2, $3, $4, true)
             RETURNING id, username, email, role, is_active, is_verified, created_at`,
            [normalizedUsername, normalizedEmail, passwordHash, role]
        );

        await client.query('COMMIT');

        return {
            ...insertResult.rows[0],
            isFirstUser
        };
    } catch (error) {
        await client.query('ROLLBACK');

        if (error.code === '23505') {
            const err = new Error('El nombre de usuario o email ya existe');
            err.code = 'USERNAME_TAKEN';
            throw err;
        }

        throw error;
    } finally {
        client.release();
    }
}

async function updateUserPassword(userId, passwordHash, queryable = pool) {
    const result = await queryable.query(
        `UPDATE admin_users
         SET password_hash = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [userId, passwordHash]
    );

    return result.rowCount > 0;
}

async function updateUserEmail(userId, newEmail, queryable = pool) {
    const normalizedEmail = normalizeEmail(newEmail);

    const result = await queryable.query(
        `UPDATE admin_users
         SET email = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, username, email, role`,
        [userId, normalizedEmail]
    );

    return result.rows[0] || null;
}

async function listUsers(queryable = pool) {
    const result = await queryable.query(
        `SELECT id, username, email, role, is_active, is_verified, created_at, updated_at
         FROM admin_users
         ORDER BY
            CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
            LOWER(username) ASC`
    );

    return result.rows;
}

async function deleteUserById(userId, queryable = pool) {
    const result = await queryable.query(
        `DELETE FROM admin_users
         WHERE id = $1
         RETURNING id, username, email, role`,
        [userId]
    );

    return result.rows[0] || null;
}

async function updateUserRole(userId, newRole, queryable = pool) {
    if (!['admin', 'editor'].includes(newRole)) {
        throw new Error('Rol inválido');
    }

    const result = await queryable.query(
        `UPDATE admin_users
         SET role = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, username, email, role`,
        [userId, newRole]
    );

    return result.rows[0] || null;
}

module.exports = {
    normalizeUsername,
    normalizeEmail,
    hasAnyUsers,
    getActiveUserByUsername,
    getActiveUserByEmail,
    getActiveUserById,
    findExistingUserByUsernameOrEmail,
    findUserByEmail,
    createFirstAdminUser,
    createUserWithAutoRole,
    updateUserPassword,
    updateUserEmail,
    listUsers,
    deleteUserById,
    updateUserRole
};
