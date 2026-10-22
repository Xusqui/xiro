/**
 * @fileoverview Clasifica errores de PostgreSQL para el circuit breaker
 * @module infrastructure/resilience/pg-error-classifier
 *
 * Un error de datos (PIN duplicado, FK, sintaxis) significa que la base de datos
 * respondió bien: no debe abrir el circuito. Solo cuentan los fallos de
 * infraestructura (conexión, recursos, timeouts, apagado del servidor).
 */

// Clases SQLSTATE que la base de datos devuelve sin estar caída
const CLIENT_ERROR_CLASSES = new Set([
    '21', // cardinality_violation
    '22', // data_exception
    '23', // integrity_constraint_violation (unique, FK, check, not null)
    '25', // invalid_transaction_state
    '40', // transaction_rollback (deadlock, serialization)
    '42', // syntax_error_or_access_rule_violation
    '44', // with_check_option_violation
    'P0' // plpgsql RAISE
]);

const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

/**
 * Indica si un error debe contar como fallo de la base de datos
 * @param {Error} error - Error lanzado por pg
 * @returns {boolean} true si es un fallo de infraestructura
 */
function isInfrastructureError(error) {
    const code = error && error.code;
    if (typeof code !== 'string' || !SQLSTATE_PATTERN.test(code)) return true;
    return !CLIENT_ERROR_CLASSES.has(code.slice(0, 2));
}

module.exports = { isInfrastructureError, CLIENT_ERROR_CLASSES };
