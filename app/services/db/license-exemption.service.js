/**
 * @fileoverview Liberación de contenido de editores por el administrador
 * @module services/db/license-exemption.service
 *
 * El contenido "liberado" (license_exempt) se trata como contenido del
 * administrador a efectos del límite de participantes.
 */

const { pool } = require('../../config/database');

const RESOURCE_TABLES = Object.freeze({
    bank: 'question_banks',
    game: 'games',
    custom_game: 'custom_games',
    trivial: 'trivial_games',
    quiz: 'quizzes'
});

function resolveTable(resourceType) {
    const table = Object.hasOwn(RESOURCE_TABLES, resourceType) ? RESOURCE_TABLES[resourceType] : null;
    if (!table) {
        const err = new Error(`Tipo de recurso no soportado: ${resourceType}`);
        err.status = 400;
        err.code = 'UNSUPPORTED_RESOURCE_TYPE';
        throw err;
    }
    return table;
}

/**
 * Lista todo el contenido creado por editores con su estado de liberación.
 * @param {Object} queryable - Pool o cliente de PostgreSQL
 * @returns {Promise<Array<{type, id, name, pin, licenseExempt, ownerUsername}>>}
 */
async function listEditorContent(queryable = pool) {
    const result = await queryable.query(`
        SELECT x.type, x.id, x.name, x.pin, x.license_exempt, au.username AS owner_username
        FROM (
            SELECT 'bank' AS type, id, name, pin, license_exempt, created_by_user_id FROM question_banks WHERE created_by_role = 'editor'
            UNION ALL
            SELECT 'game', id, name, pin, license_exempt, created_by_user_id FROM games WHERE created_by_role = 'editor'
            UNION ALL
            SELECT 'custom_game', id, name, pin, license_exempt, created_by_user_id FROM custom_games WHERE created_by_role = 'editor'
            UNION ALL
            SELECT 'trivial', id, name, pin, license_exempt, created_by_user_id FROM trivial_games WHERE created_by_role = 'editor'
            UNION ALL
            SELECT 'quiz', id, 'Quiz ' || pin, pin, license_exempt, created_by_user_id FROM quizzes WHERE created_by_role = 'editor'
        ) x
        LEFT JOIN admin_users au ON au.id = x.created_by_user_id
        ORDER BY au.username NULLS LAST, x.type, x.name
    `);

    return result.rows.map(row => ({
        type: row.type,
        id: row.id,
        name: row.name,
        pin: row.pin,
        licenseExempt: row.license_exempt === true,
        ownerUsername: row.owner_username || null
    }));
}

/**
 * Marca o desmarca un contenido como liberado del límite de licencia.
 * @param {string} resourceType - bank|game|custom_game|trivial|quiz
 * @param {number} resourceId - ID del contenido
 * @param {boolean} exempt - true = liberado, false = restringido
 * @param {Object} queryable - Pool o cliente de PostgreSQL
 * @returns {Promise<{id: number, pin: string|null, licenseExempt: boolean}|null>}
 */
async function setLicenseExemption(resourceType, resourceId, exempt, queryable = pool) {
    const table = resolveTable(resourceType);
    const id = Number(resourceId);
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    const result = await queryable.query(
        `UPDATE ${table}
         SET license_exempt = $2
         WHERE id = $1
         RETURNING id, pin, license_exempt`,
        [id, exempt === true]
    );

    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
        id: row.id,
        pin: row.pin || null,
        licenseExempt: row.license_exempt === true
    };
}

module.exports = {
    listEditorContent,
    setLicenseExemption
};
