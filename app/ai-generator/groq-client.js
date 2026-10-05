'use strict';

/**
 * @fileoverview Cliente HTTP para la API de Groq (OpenAI-compatible).
 * Exporta:
 *   callGroq({ apiKey, model, userPrompt, systemPrompt, timeout, maxTokens }) → Promise<string>
 */

const https = require('https');

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
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode !== 200) {
                        const msg = parsed.error?.message || `HTTP ${res.statusCode}`;
                        return reject(new Error(`Groq API error: ${msg}`));
                    }
                    const text = parsed.choices?.[0]?.message?.content;
                    if (!text) return reject(new Error('Groq devolvió una respuesta vacía'));
                    resolve(text);
                } catch (e) {
                    reject(new Error(`Error parseando respuesta de Groq: ${e.message}`));
                }
            });
        });

        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error(`Timeout: Groq no respondió en ${timeout / 1000}s`));
        });

        req.on('error', (err) => reject(new Error(`Error de red: ${err.message}`)));
        req.write(body);
        req.end();
    });
}

module.exports = { callGroq };
