/**
 * @fileoverview Esquema y validación de «Toca la imagen» (hotspot) para el generador de IA.
 * La IA escribe el enunciado y una búsqueda corta en inglés (image_query); el servidor trae la
 * imagen de Wikimedia Commons (hotspot-images.js). El área no la marca la IA, que no ve la
 * imagen: llega sin área y el editor la dibuja antes de guardar el banco.
 */

'use strict';

const { LIMITS } = require('../../public/js/core/hotspot-area');

const MAX_QUERY_LENGTH = 100;

function nonEmptyText(value, max = Infinity) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

/**
 * Indica si la pregunta de la IA es válida.
 * @param {Object} q - Pregunta devuelta por la IA
 * @returns {boolean}
 */
function validate(q) {
    return nonEmptyText(q.question_text) && nonEmptyText(q.image_query, MAX_QUERY_LENGTH);
}

/**
 * Convierte la pregunta de la IA al formato de subida de bancos: imagen por buscar (imageQuery)
 * y área pendiente (null).
 * @param {Object} q - Pregunta devuelta por la IA
 * @returns {Object} Pregunta normalizada
 */
function normalize(q) {
    return {
        questionText: q.question_text,
        type: 'hotspot',
        tipo_contenido: 'imagen',
        url_recurso: null,
        time_limit: q.time_limit || 20,
        maxPoints: LIMITS.DEFAULT_MAX_POINTS,
        hotspotTolerance: LIMITS.DEFAULT_TOLERANCE,
        hotspotArea: null,
        imageQuery: q.image_query.trim(),
        imageCredit: null,
        options: []
    };
}

module.exports = { validate, normalize, MAX_QUERY_LENGTH };
