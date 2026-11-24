'use strict';

/**
 * @fileoverview Consumo de tokens de cada llamada a la IA, en el log.
 * Cada proveedor da el consumo con otro formato; los extractores lo pasan a
 * { input, output, total, reasoning? } o devuelven null si la respuesta no lo trae.
 * Exporta: usageFromOpenAI, usageFromGemini, usageFromOllama, logTokenUsage
 */

const logger = require('../config/logger');

const isCount = value => Number.isFinite(value) && value >= 0;

/**
 * Normaliza los contadores; total se calcula si el proveedor no lo da.
 * @param {*} input
 * @param {*} output
 * @param {*} [total]
 * @returns {{ input: number, output: number, total: number }|null}
 */
function _buildUsage(input, output, total) {
    if (!isCount(input) || !isCount(output)) return null;
    return { input, output, total: isCount(total) ? total : input + output };
}

/**
 * Formato OpenAI chat/completions (OpenAI, Groq y compatibles): campo usage. Los tokens de
 * razonamiento ya van dentro de completion_tokens; se indican aparte si los hay.
 * @param {Object|null} response - cuerpo parseado
 * @returns {{ input: number, output: number, total: number, reasoning?: number }|null}
 */
function usageFromOpenAI(response) {
    const usage = response?.usage;
    if (!usage) return null;
    const result = _buildUsage(usage.prompt_tokens, usage.completion_tokens, usage.total_tokens);
    const reasoning = usage.completion_tokens_details?.reasoning_tokens;
    return result && isCount(reasoning) && reasoning > 0 ? { ...result, reasoning } : result;
}

/**
 * Formato Gemini generateContent: usageMetadata. Los tokens de razonamiento
 * (thoughtsTokenCount) se facturan como salida, por eso se suman a output.
 * @param {Object|null} response - cuerpo parseado
 * @returns {{ input: number, output: number, total: number, reasoning?: number }|null}
 */
function usageFromGemini(response) {
    const meta = response?.usageMetadata;
    if (!meta) return null;
    const reasoning = isCount(meta.thoughtsTokenCount) ? meta.thoughtsTokenCount : 0;
    const candidates = isCount(meta.candidatesTokenCount) ? meta.candidatesTokenCount : 0;
    const usage = _buildUsage(meta.promptTokenCount, candidates + reasoning, meta.totalTokenCount);
    return usage && reasoning > 0 ? { ...usage, reasoning } : usage;
}

/**
 * Formato Ollama /api/chat: prompt_eval_count y eval_count.
 * @param {Object|null} response - cuerpo parseado
 * @returns {{ input: number, output: number, total: number }|null}
 */
function usageFromOllama(response) {
    return response ? _buildUsage(response.prompt_eval_count, response.eval_count) : null;
}

/**
 * Escribe en el log (info) el consumo de una llamada. Sin datos no escribe nada.
 * @param {string} provider - 'groq' | 'gemini' | 'ollama'
 * @param {string} model
 * @param {{ input: number, output: number, total: number, reasoning?: number }|null} usage
 * @returns {void}
 */
function logTokenUsage(provider, model, usage) {
    if (!usage) return;
    const reasoning = usage.reasoning ? ` (${usage.reasoning} de razonamiento)` : '';
    logger.info(
        `[ai-generator] Tokens ${provider}/${model}: entrada ${usage.input}, salida ${usage.output}${reasoning}, total ${usage.total}`,
        { provider, model, ...usage }
    );
}

module.exports = { usageFromOpenAI, usageFromGemini, usageFromOllama, logTokenUsage };
