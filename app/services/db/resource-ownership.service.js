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
    quiz: 'quizzes',
    canvas_slide: 'canvas_slide_library'
});

/**
 * Normaliza el rol del creador: solo 'editor' se conserva; cualquier otro valor (incluido null de filas antiguas)
 * cuenta como 'admin'.
 * @param {*} role - Rol guardado
 * @returns {'admin'|'editor'}
 */
function normalizeCreatorRole(role) {
    return role === 'editor' ? 'editor' : 'admin';
}

function resolveTable(resourceType) {
    const table = Object.hasOwn(RESOURCE_TABLES, resourceType) ? RESOURCE_TABLES[resourceType] : null;
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

/**
 * Lee quién creó un recurso.
 * @param {'bank'|'game'|'custom_game'|'trivial'|'quiz'|'canvas_slide'} resourceType - Tipo de recurso
 * @param {number} resourceId - ID del recurso
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<{role: string, userId: number|null}|null>} Creador, o null si no hay id o no existe
 * @throws {Error} code 'UNSUPPORTED_RESOURCE_TYPE' (status 500) si el tipo no está en la lista
 * @throws {Error} Si falla la consulta
 */
async function getResourceOwner(resourceType, resourceId, queryable = pool) {
    if (!resourceId) return null;

    const table = resolveTable(resourceType);
    const result = await queryable.query(`SELECT created_by_role, created_by_user_id FROM ${table} WHERE id = $1`, [
        resourceId
    ]);

    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
        role: normalizeCreatorRole(row.created_by_role),
        userId: normalizeActorUserId(row.created_by_user_id)
    };
}

/**
 * Lee el creador de un recurso y si está exento de licencia.
 * @param {'bank'|'game'|'custom_game'|'trivial'|'quiz'|'canvas_slide'} resourceType - Tipo de recurso
 * @param {number} resourceId - ID del recurso
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<{role: string, userId: number|null, licenseExempt: boolean}|null>} Datos, o null si no hay id o no
 *   existe
 * @throws {Error} code 'UNSUPPORTED_RESOURCE_TYPE' (status 500) si el tipo no está en la lista
 * @throws {Error} Si falla la consulta
 */
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

/**
 * Comprueba que el editor puede modificar el recurso: solo si lo creó él. Sin usuario válido no comprueba nada
 * (las rutas pasan null cuando actúa un admin).
 * @param {'bank'|'game'|'custom_game'|'trivial'|'quiz'|'canvas_slide'} resourceType - Tipo de recurso
 * @param {number} resourceId - ID del recurso
 * @param {number|string|null} actorUserId - ID del usuario que actúa
 * @param {Object} [queryable=pool] - Pool o cliente de una transacción en curso
 * @returns {Promise<void>}
 * @throws {Error} code 'NOT_FOUND' (status 404) si el recurso no existe
 * @throws {Error} code 'OWNER_FORBIDDEN' (status 403) si lo creó otro usuario
 * @throws {Error} code 'UNSUPPORTED_RESOURCE_TYPE' (status 500) si el tipo no está en la lista
 * @throws {Error} Si falla la consulta
 */
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
