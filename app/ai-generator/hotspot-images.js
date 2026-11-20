/**
 * @fileoverview Imágenes de las preguntas «Toca la imagen» (hotspot) generadas por la IA: con la
 * búsqueda que escribió la IA (imageQuery) se trae una imagen libre de Wikimedia Commons, mapas y
 * diagramas incluidos, se guarda en /uploads y se anota su crédito (autor y licencia). Sin imagen,
 * la pregunta llega sin ella y el editor pide subirla. imageQuery se quita siempre: la validación
 * de bancos no admite esa clave.
 * @module ai-generator/hotspot-images
 */

'use strict';

const { searchPhoto } = require('./canvas-slides/commons');
const { storeImageBuffer } = require('../services/image-store');
const logger = require('../config/logger');

const MAX_CREDIT_LENGTH = 300;

const defaultStore = (buffer) => storeImageBuffer(buffer, { prefix: 'hotspot' });

async function resolveImage(query, { findImage, storeImage, signal }) {
    if (signal?.aborted) return null;
    try {
        const found = await findImage(query, { drawings: true, signal });
        const url = found ? await storeImage(found.buffer) : null;
        return url ? { url, credit: String(found.credit || '').slice(0, MAX_CREDIT_LENGTH) || null } : null;
    } catch (err) {
        logger.warn(`[ai-generator] Toca la imagen: sin imagen para «${query}»: ${err.message}`);
        return null;
    }
}

function withImage(question, image) {
    const { imageQuery: _query, ...rest } = question;
    return { ...rest, tipo_contenido: 'imagen', url_recurso: image ? image.url : null, imageCredit: image ? image.credit : null };
}

/**
 * Añade imagen y crédito a las preguntas hotspot; el resto sale igual.
 * @param {Array<Object>} questions - Preguntas normalizadas (schema-builder)
 * @param {Object} [deps]
 * @param {Function} [deps.findImage] - Como searchPhoto de commons.js (inyectable en tests)
 * @param {Function} [deps.storeImage] - buffer → URL de /uploads o null (inyectable en tests)
 * @param {AbortSignal} [deps.signal] - Cancelación (el cliente se desconectó)
 * @returns {Promise<Array<Object>>} Preguntas nuevas, en el mismo orden
 */
async function attachHotspotImages(questions, { findImage = searchPhoto, storeImage = defaultStore, signal } = {}) {
    // Una búsqueda por texto distinto: varias preguntas suelen compartir el mismo mapa
    const byQuery = new Map();
    const result = [];
    for (const question of questions) {
        if (question.type !== 'hotspot') {
            result.push(question);
            continue;
        }
        const query = String(question.imageQuery || '').trim();
        const key = query.toLowerCase();
        if (key && !byQuery.has(key)) byQuery.set(key, await resolveImage(query, { findImage, storeImage, signal }));
        result.push(withImage(question, key ? byQuery.get(key) : null));
    }
    return result;
}

module.exports = { attachHotspotImages };
