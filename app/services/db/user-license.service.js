/**
 * @fileoverview Persistencia de la licencia individual por usuario
 * @module services/db/user-license.service
 */

const { pool } = require('../../config/database');

function normalizeUserId(userId) {
    const parsed = Number(userId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Obtiene la licencia individual de un usuario activo, con metadatos.
 * @param {number} userId - ID del usuario (admin_users.id)
 * @param {Object} queryable - Pool o cliente de PostgreSQL
 * @returns {Promise<{license: string, updatedAtMs: number}>}
 */
async function getUserLicenseWithMeta(userId, queryable = pool) {
    const uid = normalizeUserId(userId);
    if (!uid) {
        return { license: '', updatedAtMs: 0 };
    }

    const result = await queryable.query(
        `SELECT license_key, license_updated_at
         FROM admin_users
         WHERE id = $1 AND is_active = true
         LIMIT 1`,
        [uid]
    );

    if (!result.rows.length) {
        return { license: '', updatedAtMs: 0 };
    }

    const row = result.rows[0];
    const updatedAtMs = row.license_updated_at
        ? new Date(row.license_updated_at).getTime()
        : 0;

    return {
        license: String(row.license_key || '').trim(),
        updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0
    };
}

/**
 * Guarda (o borra, con cadena vacía) la licencia individual de un usuario.
 * @param {number} userId - ID del usuario (admin_users.id)
 * @param {string} license - Clave de licencia; vacía para eliminarla
 * @param {Object} queryable - Pool o cliente de PostgreSQL
 * @returns {Promise<string|null>} Licencia normalizada, o null si el usuario no existe
 */
async function setUserLicense(userId, license, queryable = pool) {
    const uid = normalizeUserId(userId);
    if (!uid) {
        return null;
    }

    const normalizedLicense = String(license || '').trim();
    const result = await queryable.query(
        `UPDATE admin_users
         SET license_key = $2, license_updated_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND is_active = true
         RETURNING license_key`,
        [uid, normalizedLicense]
    );

    if (!result.rows.length) {
        return null;
    }

    return String(result.rows[0].license_key || '').trim();
}

module.exports = {
    getUserLicenseWithMeta,
    setUserLicense
};
