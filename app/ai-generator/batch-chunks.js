/**
 * @fileoverview Reparto del documento por secciones entre los lotes de la
 * generación (solo modo 'document'). Cada lote recibe un trozo distinto del
 * Markdown en vez del documento entero truncado: menos tokens por petición y
 * preguntas de todo el documento.
 * AI_CHUNK_CHARS (runtime-config) = 0 vuelve a enviar el documento entero.
 */

'use strict';

const { createChunkPlan } = require('./markdown/md-sections');
const runtimeConfig = require('../config/runtime-config');
const logger = require('../config/logger');

/**
 * @param {string} text - Markdown del documento
 * @param {{ mode: string, counts: number[], batchSize: number }} options
 *        counts: preguntas pedidas por tipo
 * @returns {{ next: () => string }|null} null = sin troceo
 */
function buildChunkPlan(text, { mode, counts, batchSize }) {
    const maxChars = Number(runtimeConfig.get('AI_CHUNK_CHARS')) || 0;
    if (mode !== 'document' || maxChars <= 0) return null;
    const totalBatches = counts.reduce((n, c) => n + Math.ceil(c / batchSize), 0);
    const plan = createChunkPlan(text, { maxChars, totalBatches });
    if (plan.chunks.length > 1) {
        const sizes = plan.chunks.map(c => c.length);
        const avg = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
        logger.info(`[ai-generator] Documento troceado en ${plan.chunks.length} secciones para ${totalBatches} lotes`, {
            docChars: text.length,
            chunkChars: maxChars,
            avgChars: avg,
            smallestChars: Math.min(...sizes),
            largestChars: Math.max(...sizes)
        });
        logger.debug('[ai-generator] Tamaño de cada trozo', { sizes });
    }
    return withBatchLog(plan, totalBatches);
}

/** Registra en debug qué trozo recibe cada lote (los reintentos no piden trozo nuevo). */
function withBatchLog(plan, totalBatches) {
    let batch = 0;
    const next = plan.next.bind(plan);
    plan.next = () => {
        const chunk = next();
        batch++;
        logger.debug(
            `[ai-generator] Lote ${batch}/${totalBatches}: trozo ${plan.lastIndex + 1}/${plan.chunks.length} (${chunk.length} caracteres)`
        );
        return chunk;
    };
    return plan;
}

module.exports = { buildChunkPlan };
