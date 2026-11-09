/**
 * @fileoverview Admin users database operations
 * @module services/db/admin-user.service
 */

const { pool } = require('../../config/database');

/**
 * Normaliza un nombre de usuario para comparar y guardar: recorta espacios y pasa a minúsculas.
 * @param {*} username - Valor recibido (null/undefined dan cadena vacía)
 * @returns {string}
 */
function normalizeUsername(username) {
    return String(username || '')
        .trim()
        .toLowerCase();
}

/**
 * Normaliza un email para comparar y guardar: recorta espacios y pasa a minúsculas.
 * @param {*} email - Valor recibido (null/undefined dan cadena vacía)
 * @returns {string}
 */
function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

/**
 * Indica si existe al menos un usuario del panel.
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<boolean>}
 * @throws {Error} Si falla la consulta
 */
async function hasAnyUsers(queryable = pool) {
    const result = await queryable.query('SELECT EXISTS(SELECT 1 FROM admin_users) AS has_users');
    return result.rows[0]?.has_users === true;
}

/**
 * Busca un usuario activo y verificado por nombre, sin distinguir mayúsculas.
 * @param {string} username - Nombre de usuario
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<Object|null>} {id, username, email, password_hash, role, is_active, is_verified} o null si no
 *   existe, está inactivo o sin verificar
 * @throws {Error} Si falla la consulta
 */
async function getActiveUserByUsername(username, queryable = pool) {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) return null;

    const result = await queryable.query(
        `SELECT id, username, email, password_hash, role, is_active, is_verified, terms_version
         FROM admin_users
         WHERE LOWER(username) = LOWER($1)
         LIMIT 1`,
        [normalizedUsername]
    );

    const user = result.rows[0];
    if (!user || !user.is_active || !user.is_verified) return null;

    return user;
}

/**
 * Busca un usuario activo y verificado por email, sin distinguir mayúsculas.
 * @param {string} email - Email
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<Object|null>} {id, username, email, password_hash, role, is_active, is_verified} o null si no
 *   existe, está inactivo o sin verificar
 * @throws {Error} Si falla la consulta
 */
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

/**
 * Busca un usuario activo y verificado por id.
 * @param {number} userId - ID del usuario
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<Object|null>} {id, username, email, password_hash, role, is_active, is_verified} o null
 * @throws {Error} Si falla la consulta
 */
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

/**
 * Busca cualquier usuario (activo o no) que ya use ese nombre o ese email.
 * @param {string} username - Nombre de usuario
 * @param {string} email - Email
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<Object|null>} {id, username, email} o null
 * @throws {Error} Si falla la consulta
 */
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

/**
 * Busca cualquier usuario (activo o no) por email.
 * @param {string} email - Email
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<Object|null>} {id, username, email} o null
 * @throws {Error} Si falla la consulta
 */
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

/**
 * Crea el primer usuario como admin verificado. La tabla se bloquea durante la transacción para que dos altas
 * simultáneas no creen dos admins.
 * @param {string} username - Nombre de usuario
 * @param {string} email - Email
 * @param {string} passwordHash - Hash scrypt de la contraseña
 * @returns {Promise<Object|null>} Usuario creado con `isFirstUser: true`, o null si ya había usuarios
 * @throws {Error} code 'INVALID_USERNAME' si el usuario o el email quedan vacíos tras normalizar
 * @throws {Error} code 'USERNAME_TAKEN' si el usuario o el email ya existen
 * @throws {Error} Si falla la consulta
 */
async function createFirstAdminUser(username, email, passwordHash, termsVersion) {
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

        const countResult = await client.query('SELECT COUNT(*)::int AS total FROM admin_users');

        if ((countResult.rows[0]?.total || 0) > 0) {
            await client.query('COMMIT');
            return null;
        }

        const insertResult = await client.query(
            `INSERT INTO admin_users (username, email, password_hash, role, is_verified, terms_version, terms_accepted_at)
             VALUES ($1, $2, $3, 'admin', true, $4, NOW())
             RETURNING id, username, email, role, is_active, is_verified, created_at`,
            [normalizedUsername, normalizedEmail, passwordHash, termsVersion]
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

/**
 * Crea un usuario verificado: admin si es el primero, editor en otro caso (con la tabla bloqueada durante la
 * transacción).
 * @param {string} username - Nombre de usuario
 * @param {string} email - Email
 * @param {string} passwordHash - Hash scrypt de la contraseña
 * @returns {Promise<Object>} Usuario creado {id, username, email, role, is_active, is_verified, created_at,
 *   isFirstUser}
 * @throws {Error} code 'INVALID_USERNAME' si el usuario o el email quedan vacíos tras normalizar
 * @throws {Error} code 'USERNAME_TAKEN' si el usuario o el email ya existen
 * @throws {Error} Si falla la consulta
 */
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

        const countResult = await client.query('SELECT COUNT(*)::int AS total FROM admin_users');

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

/**
 * Cambia el hash de la contraseña de un usuario.
 * @param {number} userId - ID del usuario
 * @param {string} passwordHash - Nuevo hash scrypt
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<boolean>} true si el usuario existía
 * @throws {Error} Si falla la consulta
 */
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

/**
 * Cambia el email de un usuario (normalizado).
 * @param {number} userId - ID del usuario
 * @param {string} newEmail - Nuevo email
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<Object|null>} {id, username, email, role} o null si no existe
 * @throws {Error} Si falla la consulta (p. ej. email duplicado, 23505)
 */
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

/**
 * Lista todos los usuarios: primero los admins y después por nombre.
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<Object[]>} Filas sin hash de contraseña
 * @throws {Error} Si falla la consulta
 */
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

/**
 * Borra un usuario.
 * @param {number} userId - ID del usuario
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<Object|null>} {id, username, email, role} del borrado o null si no existía
 * @throws {Error} Si falla la consulta
 */
async function deleteUserById(userId, queryable = pool) {
    const result = await queryable.query(
        `DELETE FROM admin_users
         WHERE id = $1
         RETURNING id, username, email, role`,
        [userId]
    );

    return result.rows[0] || null;
}

/**
 * Cambia el rol de un usuario.
 * @param {number} userId - ID del usuario
 * @param {'admin'|'editor'} newRole - Nuevo rol
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<Object|null>} {id, username, email, role} o null si no existe
 * @throws {Error} 'Rol inválido' si el rol no es admin ni editor
 * @throws {Error} Si falla la consulta
 */
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

/**
 * Guarda que la cuenta ha aceptado una versión de los términos.
 * @param {number} userId - Id de la cuenta
 * @param {string} termsVersion - Versión aceptada
 * @returns {Promise<void>}
 * @throws {Error} Si falla la consulta
 */
async function recordTermsAcceptance(userId, termsVersion) {
    await pool.query('UPDATE admin_users SET terms_version = $1, terms_accepted_at = NOW() WHERE id = $2', [
        termsVersion,
        userId
    ]);
}

module.exports = {
    normalizeUsername,
    normalizeEmail,
    hasAnyUsers,
    getActiveUserByUsername,
    recordTermsAcceptance,
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
