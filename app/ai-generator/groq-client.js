'use strict';

/**
 * @fileoverview Cliente HTTP para la API de Groq (OpenAI-compatible).
 * Exporta:
 *   callGroq({ apiKey, model, userPrompt, systemPrompt, timeout, maxTokens }) → Promise<string>
 */

const https = require('https');
const { usageFromOpenAI, logTokenUsage } = require('./token-usage');

const GROQ_HOST = 'api.groq.com';
const GROQ_PATH = '/openai/v1/chat/completions';

/**
 * Interpreta el cuerpo de Groq: texto de la respuesta, o error con el motivo.
 * Deja en el log los tokens gastados.
 * @param {number} statusCode
 * @param {string} data - cuerpo sin parsear
 * @param {string} model
 * @returns {string}
 * @throws {Error} JSON inválido, error HTTP o respuesta vacía
 */
function _readResponse(statusCode, data, model) {
    let parsed;
    try {
        parsed = JSON.parse(data);
    } catch (e) {
        throw new Error(`Error parseando respuesta de Groq: ${e.message}`);
    }
    if (statusCode !== 200) {
        throw new Error(`Groq API error: ${parsed?.error?.message || `HTTP ${statusCode}`}`);
    }
    const text = parsed.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq devolvió una respuesta vacía');
    logTokenUsage('groq', model, usageFromOpenAI(parsed));
    return text;
}

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
 */
function callGroq({ apiKey, model, userPrompt, systemPrompt, timeout, maxTokens }) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: maxTokens,
            temperature: 0.7 // Aumentado desde 0.3 para evitar que el modelo se obsesione matemáticamente con el mismo párrafo iteración tras iteración
        });

        const options = {
            hostname: GROQ_HOST,
            path: GROQ_PATH,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(_readResponse(res.statusCode, data, model));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error(`Timeout: Groq no respondió en ${timeout / 1000}s`));
        });

        req.on('error', err => reject(new Error(`Error de red: ${err.message}`)));
        req.write(body);
        req.end();
    });
}

module.exports = { callGroq };
