/**
 * @fileoverview Validación de «Toca la imagen» (hotspot):
 * - hotspotFields: claves propias de la pregunta (área, tolerancia, crédito de la imagen).
 * - hotspotQuestionRule: regla de pregunta completa (questionSchema.custom). Exige la imagen
 *   principal y un área válida, que deja normalizada.
 * - isValidTapPayload: forma del toque que manda el móvil.
 * Reglas del área: public/js/core/hotspot-area.js.
 */

'use strict';

const Joi = require('joi');
const Hotspot = require('../../public/js/core/hotspot-area');

const { LIMITS } = Hotspot;
const MAX_CREDIT_LENGTH = 300;

const hotspotFields = {
    // La forma la comprueba hotspotQuestionRule con las reglas compartidas del área
    hotspotArea: Joi.any().optional(),
    hotspotTolerance: Joi.number().integer().min(LIMITS.MIN_TOLERANCE).max(LIMITS.MAX_TOLERANCE).allow(null).optional(),
    imageCredit: Joi.string().max(MAX_CREDIT_LENGTH).allow(null, '').optional()
};

const ERROR_MESSAGES = {
    image_required: 'Toca la imagen necesita una imagen principal',
    missing: 'Falta marcar el área correcta sobre la imagen',
    too_few_points: `El área necesita al menos ${LIMITS.MIN_POINTS} vértices`,
    too_many_points: `El área no puede tener más de ${LIMITS.MAX_POINTS} vértices`,
    bad_point: 'Hay un vértice del área fuera de la imagen',
    bad_aspect: 'Falta la proporción de la imagen del área'
};

/**
 * Regla de pregunta completa para hotspot; el resto de tipos pasa sin cambios.
 * @param {Object} value - Pregunta ya validada clave a clave
 * @param {Object} helpers - Helpers de Joi
 * @returns {Object|Joi.ErrorReport} La pregunta con el área normalizada, o el error `hotspot.<código>`
 */
function hotspotQuestionRule(value, helpers) {
    if (!value || value.type !== 'hotspot') return value;
    if (value.tipo_contenido !== 'imagen' || !value.url_recurso) return helpers.error('hotspot.image_required');
    const code = Hotspot.areaError(value.hotspotArea);
    if (code) return helpers.error(`hotspot.${code}`);
    return { ...value, hotspotArea: Hotspot.normalizeArea(value.hotspotArea) };
}

const hotspotRuleMessages = Object.fromEntries(
    Object.entries(ERROR_MESSAGES).map(([code, message]) => [`hotspot.${code}`, message])
);

/**
 * Forma del toque que envía el jugador: { x, y } con números entre 0 y 1.
 * @param {*} tap
 * @returns {boolean}
 */
function isValidTapPayload(tap) {
    return Hotspot.normalizeTap(tap) !== null;
}

module.exports = { hotspotFields, hotspotQuestionRule, hotspotRuleMessages, isValidTapPayload };
