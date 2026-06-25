'use strict';

/**
 * @fileoverview Cliente HTTP para la API de Groq (OpenAI-compatible).
 * Exporta:
 *   callLLM(userPrompt, systemPrompt?, timeout?) → Promise<string>
 *   checkGroqStatus() → { available: boolean, model: string, provider: string, reason?: string }
 */

const https = require('https');
const { getApiKey, isGroqConfigured, getGroqModel } = require('./groq-config');

const GROQ_HOST = 'api.groq.com';
const GROQ_PATH = '/openai/v1/chat/completions';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_SYSTEM = 'Eres un asistente experto en diseño de preguntas educativas. Responde SOLO con JSON válido, sin texto adicional.';

/**
 * Llama a la API de Groq y devuelve el texto de la respuesta.
 * @param {string} userPrompt
 * @param {string} [systemPrompt]
 * @param {number} [timeout] ms
 * @param {number} [maxTokens] max_tokens reservados en Groq
 * @returns {Promise<string>}
 */
function callLLM(userPrompt, systemPrompt = DEFAULT_SYSTEM, timeout = DEFAULT_TIMEOUT, maxTokens = 4096) {
    return new Promise((resolve, reject) => {
        const apiKey = getApiKey();
        if (!apiKey) {
            return reject(new Error('Groq API key no configurada. Configúrala en el Panel > IA.'));
        }

        const body = JSON.stringify({
            model: getGroqModel(),
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

/**
 * Devuelve el estado del proveedor de IA.
 */
function checkGroqStatus() {
    const configured = isGroqConfigured();
    return {
        available: configured,
        model: getGroqModel(),
        provider: 'groq',
        ...(!configured && { reason: 'API key no configurada. Ve a Panel > IA para configurarla.' })
    };
}

module.exports = { callLLM, checkGroqStatus };
