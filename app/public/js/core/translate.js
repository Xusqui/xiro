/**
 * @fileoverview Traducción para los módulos ES del presentador y del jugador.
 * Única envoltura de window._t (i18n-core.js). Existe para fijar un solo orden de
 * argumentos en el cliente y para no romper si i18n aún no ha cargado (o en tests).
 */

/**
 * Traduce una clave del diccionario.
 * @param {string} key - Clave i18n
 * @param {string} [fallback] - Texto si la clave no existe o i18n no ha cargado
 * @param {Object<string, *>} [vars] - Valores para los {marcadores} del texto
 * @returns {string} Texto traducido, el de reserva o, en último caso, la clave
 */
export function t(key, fallback, vars) {
    const translate = globalThis._t;
    if (typeof translate === 'function') {
        return translate(key, vars || null, fallback);
    }
    return String(fallback ?? key ?? '');
}
