'use strict';

/**
 * @fileoverview Cliente HTTP para la API de Groq (OpenAI-compatible).
 * Exporta:
 *   callGroq({ apiKey, model, userPrompt, systemPrompt, timeout, maxTokens }) → Promise<string>
 */

const { postJson } = require('./https-json');
const { usageFromOpenAI, logTokenUsage } = require('./token-usage');

const GROQ_HOST = 'api.groq.com';
const GROQ_PATH = '/openai/v1/chat/completions';

/**
 * Llama a la API de Groq y devuelve el texto de la respuesta.
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {string} params.userPrompt
 * @param {string} params.systemPrompt
 * @param {number} params.timeout ms
 * @param {number} params.maxTokens max_tokens reservados en Groq
 * @returns {Promise<string>}
 * @throws {Error} error HTTP, red, timeout, JSON inválido o respuesta vacía
 */
async function callGroq({ apiKey, model, userPrompt, systemPrompt, timeout, maxTokens }) {
    const { statusCode, body } = await postJson({
        hostname: GROQ_HOST,
        path: GROQ_PATH,
        apiKey,
        payload: {
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: maxTokens,
            temperature: 0.7 // Aumentado desde 0.3 para evitar que el modelo se obsesione matemáticamente con el mismo párrafo iteración tras iteración
        },
        timeout,
        label: 'Groq'
    });
    if (statusCode !== 200) {
        throw new Error(`Groq API error: ${body?.error?.message || `HTTP ${statusCode}`}`);
    }
    const text = body.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq devolvió una respuesta vacía');
    logTokenUsage('groq', model, usageFromOpenAI(body));
    return text;
}

module.exports = { callGroq };
