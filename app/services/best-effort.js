'use strict';

/**
 * @fileoverview Ejecuta operaciones «best-effort» (limpieza de Redis, lápidas de sesión…)
 * que no deben tumbar el flujo principal, pero cuyo fallo sí debe quedar registrado.
 * @module services/best-effort
 */

const logger = require('../config/logger');

/**
 * Ejecuta `fn`. Si falla, registra un warn con el nombre de la operación y el contexto,
 * y devuelve `ok: false` sin relanzar el error.
 *
 * @param {string} operation - Nombre legible de la operación, para el log.
 * @param {Object} context - Campos extra del log (p. ej. `{ roomId }`).
 * @param {() => unknown} fn - Operación a ejecutar (síncrona o asíncrona).
 * @returns {Promise<{ ok: true, value: unknown } | { ok: false }>}
 */
async function bestEffort(operation, context, fn) {
    try {
        return { ok: true, value: await fn() };
    } catch (error) {
        // Lo lanzado no siempre es un Error (Promise.reject('texto'), reject() sin valor)
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`best-effort: fallo en ${operation}`, { ...context, error: message });
        return { ok: false };
    }
}

module.exports = { bestEffort };
