/**
 * @fileoverview Ownership checks for editor write permissions
 * @module services/db/resource-ownership.service
 */

const { pool } = require('../../config/database');

const RESOURCE_TABLES = Object.freeze({
    bank: 'question_banks',
    game: 'games',
    custom_game: 'custom_games',
    trivial: 'trivial_games',
    quiz: 'quizzes'
});

function normalizeCreatorRole(role) {
    return role === 'editor' ? 'editor' : 'admin';
}

function resolveTable(resourceType) {
    const table = RESOURCE_TABLES[resourceType];
    if (!table) {
        const err = new Error(`Tipo de recurso no soportado: ${resourceType}`);
        err.status = 500;
        err.code = 'UNSUPPORTED_RESOURCE_TYPE';
        throw err;
    }
    return table;
}

function buildForbiddenError() {
    const err = new Error('No tienes permisos para modificar recursos creados por otro usuario');
    err.status = 403;
    err.code = 'OWNER_FORBIDDEN';
    return err;
}

function buildNotFoundError() {
    const err = new Error('No encontrado');
    err.status = 404;
    err.code = 'NOT_FOUND';
    return err;
}

function normalizeActorUserId(actorUserId) {
    const normalized = Number(actorUserId);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

async function getResourceOwner(resourceType, resourceId, queryable = pool) {
    if (!resourceId) return null;

    const table = resolveTable(resourceType);
    const result = await queryable.query(
        `SELECT created_by_role, created_by_user_id FROM ${table} WHERE id = $1`,
        [resourceId]
    );

    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
        role: normalizeCreatorRole(row.created_by_role),
        userId: normalizeActorUserId(row.created_by_user_id)
    };
}

async function getResourceLicenseInfo(resourceType, resourceId, queryable = pool) {
    if (!resourceId) return null;

    const table = resolveTable(resourceType);
    const result = await queryable.query(
        `SELECT created_by_role, created_by_user_id, license_exempt FROM ${table} WHERE id = $1`,
        [resourceId]
    );

    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
        role: normalizeCreatorRole(row.created_by_role),
        userId: normalizeActorUserId(row.created_by_user_id),
        licenseExempt: row.license_exempt === true
    };
}

async function assertEditorCanModifyResource(resourceType, resourceId, actorUserId, queryable = pool) {
    const actorId = normalizeActorUserId(actorUserId);
    if (!actorId) return;

    const owner = await getResourceOwner(resourceType, resourceId, queryable);

    if (!owner) {
        throw buildNotFoundError();
    }

    if (owner.userId !== actorId) {
        throw buildForbiddenError();
    }
}

module.exports = {
    assertEditorCanModifyResource,
    getResourceOwner,
    getResourceLicenseInfo,
    normalizeCreatorRole
};
