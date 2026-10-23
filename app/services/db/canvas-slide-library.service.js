/**
 * @fileoverview Biblioteca de diapositivas libres: lienzos con nombre que se pueden usar en cualquier
 * juego personalizado. Un editor solo renombra o borra lo que creó; un administrador, todo.
 * Las consultas llevan todos los valores como parámetros ($1, $2…).
 * @module services/db/canvas-slide-library.service
 */
'use strict';

const { pool } = require('../../config/database');
const { assertEditorCanModifyResource, normalizeCreatorRole } = require('./resource-ownership.service');

const MAX_ITEMS = 500;

function normalizeUserId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

/** Diapositivas de la biblioteca, las más recientes primero, con el nombre de quien las creó. */
async function listLibrarySlides() {
    const result = await pool.query(
        `SELECT csl.id, csl.name, csl.slide_canvas, csl.created_by_role, csl.created_by_user_id,
                au.username AS created_by_username, csl.created_at, csl.updated_at
         FROM canvas_slide_library csl
         LEFT JOIN admin_users au ON au.id = csl.created_by_user_id
         ORDER BY csl.updated_at DESC, csl.id DESC
         LIMIT $1`,
        [MAX_ITEMS]
    );
    return result.rows;
}

/**
 * Guarda una diapositiva en la biblioteca.
 * @param {Object} data
 * @param {string} data.name - Nombre visible
 * @param {Object} data.slideCanvas - Lienzo ya validado con canvasSchema
 * @param {string} [data.creatorRole] - Rol de quien la guarda
 * @param {number|null} [data.creatorUserId] - Usuario que la guarda
 * @returns {Promise<Object>} Fila creada
 */
async function createLibrarySlide({ name, slideCanvas, creatorRole, creatorUserId }) {
    const result = await pool.query(
        `INSERT INTO canvas_slide_library (name, slide_canvas, created_by_role, created_by_user_id)
         VALUES ($1, $2::jsonb, $3, $4)
         RETURNING id, name, slide_canvas, created_by_role, created_by_user_id, created_at, updated_at`,
        [name, JSON.stringify(slideCanvas), normalizeCreatorRole(creatorRole), normalizeUserId(creatorUserId)]
    );
    return result.rows[0];
}

/** Cambia el nombre; devuelve la fila o null si no existe. */
async function renameLibrarySlide(id, name, actorUserId = null) {
    await assertEditorCanModifyResource('canvas_slide', id, actorUserId, pool);
    const result = await pool.query(
        'UPDATE canvas_slide_library SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, updated_at',
        [name, id]
    );
    return result.rows[0] || null;
}

/** Borra la diapositiva; false si no existía. */
async function deleteLibrarySlide(id, actorUserId = null) {
    await assertEditorCanModifyResource('canvas_slide', id, actorUserId, pool);
    const result = await pool.query('DELETE FROM canvas_slide_library WHERE id = $1', [id]);
    return result.rowCount > 0;
}

module.exports = { listLibrarySlides, createLibrarySlide, renameLibrarySlide, deleteLibrarySlide };
