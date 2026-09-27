/**
 * @fileoverview Bulk visible_to_presenter toggling for admin "hide/show all" actions
 * @module services/db/presenter-visibility.service
 */

const { pool } = require('../../config/database');
const pinCache = require('../pin-cache.service');

const RESOURCE_TABLES = Object.freeze({
    bank: 'question_banks',
    game: 'games',
    custom_game: 'custom_games',
    trivial: 'trivial_games'
});

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

/**
 * Marca visible/oculto para el presentador todos los recursos de un tipo.
 * Un editor sólo afecta a sus propios recursos; un admin (actorUserId null) afecta a todos.
 * @param {string} resourceType - bank|game|custom_game|trivial
 * @param {boolean} visible
 * @param {number|null} actorUserId - null = sin restricción de propietario
 * @returns {Promise<{updated: number}>}
 */
async function setAllVisibleToPresenter(resourceType, visible, actorUserId = null) {
    const table = resolveTable(resourceType);

    const result = await pool.query(
        `UPDATE ${table}
         SET visible_to_presenter = $1
         WHERE ($2::int IS NULL OR created_by_user_id = $2)
         RETURNING pin`,
        [visible, actorUserId]
    );

    for (const row of result.rows) {
        if (!row.pin) continue;
        pinCache.invalidate(row.pin);
        pinCache.invalidate(`presenter:${row.pin}`);
    }

    return { updated: result.rowCount };
}

module.exports = { setAllVisibleToPresenter };
