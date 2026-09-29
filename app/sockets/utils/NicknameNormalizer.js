/**
 * @fileoverview Utilidad para normalizar nicknames a mayúsculas
 * 
 * REGLA CRÍTICA: Todos los nicknames deben almacenarse en MAYÚSCULAS
 * para evitar conflictos de case-sensitivity (xiro, Xiro, XIRO son el mismo jugador)
 */

/**
 * Normaliza un nickname a mayúsculas
 * @param {string} nickname - El nickname a normalizar
 * @returns {string} El nickname en mayúsculas
 */
function normalize(nickname) {
    if (typeof nickname !== 'string') {
        return '';
    }
    return nickname.toUpperCase().trim();
}

/**
 * Compara dos nicknames de forma case-insensitive
 * @param {string} nick1 - Primer nickname
 * @param {string} nick2 - Segundo nickname
 * @returns {boolean} true si son iguales (ignorando mayúsculas/minúsculas)
 */
function areEqual(nick1, nick2) {
    return normalize(nick1) === normalize(nick2);
}

module.exports = {
    normalize,
    areEqual
};
