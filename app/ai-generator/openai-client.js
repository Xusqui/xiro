'use strict';

/**
 * @fileoverview Cliente de la API de OpenAI (ChatGPT) por Chat Completions.
 * Exporta:
 *   callOpenAI({ apiKey, model, userPrompt, systemPrompt, timeout }) → Promise<string>
 *
 * Los modelos de texto actuales (gpt-6-luna, gpt-6.1-terra, gpt-6.2-sol, gpt-6.2-astra) razonan:
 * - reasoning_effort 'low' es el único valor que aceptan los cuatro ('none' lo rechazan
 *   Sol y Astra) y contiene el gasto en tokens de razonamiento, que se cobran como salida.
 * - No se fija límite de tokens: max_completion_tokens incluye el razonamiento y cortaría el
 *   JSON (como en Gemini). Tampoco temperature: se deja la de cada modelo.
 * - No se usa response_format json_object: obliga a devolver un objeto y las preguntas se
 *   piden como array (mismo motivo que en Ollama).
 */

const { postJson } = require('./https-json');
const { usageFromOpenAI, logTokenUsage } = require('./token-usage');

const OPENAI_HOST = 'api.openai.com';
const OPENAI_PATH = '/v1/chat/completions';
const REASONING_EFFORT = 'low';

/**
 * Traduce un error HTTP de OpenAI. Los 429 por límite de uso usan el texto de Groq
 * («Rate limit reached ... Please try again in Xs») para que el controlador espere o pase
 * al respaldo; el saldo agotado (insufficient_quota) también es 429, pero esperar no lo arregla.
 * @param {number} statusCode
 * @param {Object} headers - cabeceras de la respuesta
 * @param {Object} body - cuerpo parseado
 * @returns {Error}
 */
function _buildHttpError(statusCode, headers, body) {
    const msg = body?.error?.message || `HTTP ${statusCode}`;
    if (statusCode !== 429 || body?.error?.code === 'insufficient_quota') {
        return new Error(`OpenAI API error: ${msg}`);
    }
    const seconds = parseFloat(headers['retry-after']);
    const wait = Number.isFinite(seconds) ? ` Please try again in ${seconds}s.` : '';
    return new Error(`OpenAI API error: Rate limit reached.${wait} ${msg}`);
}

/**
 * Texto de la respuesta, o error si el modelo se negó o no devolvió nada.
 * @param {Object} body - cuerpo parseado de una respuesta 200
 * @returns {string}
 * @throws {Error}
 */
function _extractText(body) {
    const choice = body.choices?.[0];
    const refusal = choice?.message?.refusal;
    if (refusal) throw new Error(`OpenAI rechazó la petición: ${refusal}`);
    const text = choice?.message?.content;
    if (!text) {
        const reason = choice?.finish_reason ? ` (${choice.finish_reason})` : '';
        throw new Error(`OpenAI devolvió una respuesta vacía${reason}`);
    }
    return text;
}

/**
 * Llama a OpenAI y devuelve el texto de la respuesta.
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {string} params.userPrompt
 * @param {string} params.systemPrompt
 * @param {number} params.timeout ms
 * @returns {Promise<string>}
 * @throws {Error} error HTTP, red, timeout, negativa o respuesta vacía
 */
async function callOpenAI({ apiKey, model, userPrompt, systemPrompt, timeout }) {
    const { statusCode, headers, body } = await postJson({
        hostname: OPENAI_HOST,
        path: OPENAI_PATH,
        apiKey,
        payload: {
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            reasoning_effort: REASONING_EFFORT
        },
        timeout,
        label: 'OpenAI'
    });
    if (statusCode !== 200) throw _buildHttpError(statusCode, headers, body);
    const text = _extractText(body);
    logTokenUsage('openai', model, usageFromOpenAI(body));
    return text;
}

module.exports = { callOpenAI };
