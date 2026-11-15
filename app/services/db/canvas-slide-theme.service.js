/**
 * @fileoverview Temas propios de las diapositivas libres: temas con nombre que se pueden usar en cualquier juego
 * personalizado. Un editor solo renombra o borra lo que creó; un administrador, todo.
 * Las consultas llevan todos los valores como parámetros ($1, $2…).
 * @module services/db/canvas-slide-theme.service
 */
'use strict';

const { pool } = require('../../config/database');
const { assertEditorCanModifyResource, normalizeCreatorRole } = require('./resource-ownership.service');

const MAX_ITEMS = 200;

function normalizeUserId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

/** Temas propios, los más recientes primero, con el nombre de quien los creó. */
async function listThemes() {
    const result = await pool.query(
        `SELECT ct.id, ct.name, ct.theme, ct.created_by_role, ct.created_by_user_id,
                au.username AS created_by_username, ct.created_at, ct.updated_at
         FROM canvas_slide_themes ct
         LEFT JOIN admin_users au ON au.id = ct.created_by_user_id
         ORDER BY ct.updated_at DESC, ct.id DESC
         LIMIT $1`,
        [MAX_ITEMS]
    );
    return result.rows;
}

/**
 * Guarda un tema propio.
 * @param {Object} data
 * @param {string} data.name - Nombre visible
 * @param {Object} data.theme - Tema ya validado con themeSchema
 * @param {string} [data.creatorRole] - Rol de quien lo guarda
 * @param {number|null} [data.creatorUserId] - Usuario que lo guarda
 * @returns {Promise<Object>} Fila creada
 */
async function createTheme({ name, theme, creatorRole, creatorUserId }) {
    const result = await pool.query(
        `INSERT INTO canvas_slide_themes (name, theme, created_by_role, created_by_user_id)
         VALUES ($1, $2::jsonb, $3, $4)
         RETURNING id, name, theme, created_by_role, created_by_user_id, created_at, updated_at`,
        [name, JSON.stringify(theme), normalizeCreatorRole(creatorRole), normalizeUserId(creatorUserId)]
    );
    return result.rows[0];
}

/**
 * Cambia el nombre, también dentro del tema (el del JSON admite 40 caracteres, como themeSchema; el de la tabla,
 * 120); devuelve la fila o null si no existe.
 */
async function renameTheme(id, name, actorUserId = null) {
    await assertEditorCanModifyResource('canvas_theme', id, actorUserId, pool);
    const result = await pool.query(
        `UPDATE canvas_slide_themes
         SET name = $1, theme = jsonb_set(theme, '{name}', to_jsonb(LEFT($1::text, 40)), true), updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, updated_at`,
        [name, id]
    );
    return result.rows[0] || null;
}

/** Borra el tema; false si no existía. */
async function deleteTheme(id, actorUserId = null) {
    await assertEditorCanModifyResource('canvas_theme', id, actorUserId, pool);
    const result = await pool.query('DELETE FROM canvas_slide_themes WHERE id = $1', [id]);
    return result.rowCount > 0;
}

module.exports = { listThemes, createTheme, renameTheme, deleteTheme };
