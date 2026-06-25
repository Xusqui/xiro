/**
 * @fileoverview Re-exportación de compatibilidad — las implementaciones viven en domain/services/GameUtils.js
 *
 * Este archivo existe únicamente para no romper los importadores fuera de la capa de dominio
 * (sockets/, services/ raíz) que ya usan esta ruta.
 * El código de dominio (domain/strategies/, domain/events/) debe importar directamente
 * desde domain/services/GameUtils.
 */

module.exports = require('../domain/services/GameUtils');
