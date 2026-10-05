'use strict';

/**
 * @fileoverview Cliente HTTP para la API nativa de Gemini (generateContent).
 * Exporta:
 *   callGemini({ apiKey, model, userPrompt, systemPrompt, timeout }) → Promise<string>
 *
 * La clave va en la cabecera x-goog-api-key, que admite las «auth keys» (AQ.)
 * que emite Google AI Studio. El endpoint compatible con OpenAI no las acepta
 * como Bearer, por eso se usa el nativo.
 */

const https = require('https');

const GEMINI_HOST = 'generativelanguage.googleapis.com';

/**
 * Busca el retryDelay ("37s") que Gemini manda en los 429 y lo devuelve en segundos.
 * @param {Object} error - campo error de la respuesta
 * @returns {number|null}
 */
function _getRetryDelaySeconds(error) {
    const retryInfo = (error?.details || []).find(d => typeof d?.retryDelay === 'string');
    const seconds = retryInfo ? parseFloat(retryInfo.retryDelay) : NaN;
    return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Traduce un error HTTP de Gemini. Los 429 usan el mismo texto que Groq
 * ("Rate limit reached ... Please try again in Xs") para que el controlador
 * aplique la misma espera.
 */
function _buildHttpError(statusCode, parsed) {
    const msg = parsed?.error?.message || `HTTP ${statusCode}`;
    if (statusCode === 429) {
        const seconds = _getRetryDelaySeconds(parsed?.error);
        const wait = seconds !== null ? ` Please try again in ${seconds}s.` : '';
        return new Error(`Gemini API error: Rate limit reached.${wait} ${msg}`);
    }
    return new Error(`Gemini API error: ${msg}`);
}

/** Junta el texto de la respuesta, sin las partes de razonamiento interno. */
function _extractText(parsed) {
    const blockReason = parsed.promptFeedback?.blockReason;
    if (blockReason) {
        throw new Error(`Gemini bloqueó la petición (${blockReason})`);
    }
    const candidate = parsed.candidates?.[0];
    const text = (candidate?.content?.parts || [])
        .filter(part => !part.thought && typeof part.text === 'string')
        .map(part => part.text)
        .join('');
    if (!text) {
        const reason = candidate?.finishReason ? ` (${candidate.finishReason})` : '';
        throw new Error(`Gemini devolvió una respuesta vacía${reason}`);
    }
    return text;
}

/**
 * Llama a Gemini y devuelve el texto de la respuesta.
 * No se fija maxOutputTokens: en los modelos con razonamiento ese límite incluye
 * los tokens de pensamiento y cortaría el JSON. Tampoco se fija temperature:
 * Google recomienda dejar el valor por defecto en los modelos Gemini 3.
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {string} params.userPrompt
 * @param {string} params.systemPrompt
 * @param {number} params.timeout ms
 * @returns {Promise<string>}
 */
function callGemini({ apiKey, model, userPrompt, systemPrompt, timeout }) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
        });

        const options = {
            hostname: GEMINI_HOST,
            path: `/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            method: 'POST',
            headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    return reject(new Error(`Error parseando respuesta de Gemini: ${e.message}`));
                }
                if (res.statusCode !== 200) {
                    return reject(_buildHttpError(res.statusCode, parsed));
                }
                try {
                    resolve(_extractText(parsed));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error(`Timeout: Gemini no respondió en ${timeout / 1000}s`));
        });

        req.on('error', (err) => reject(new Error(`Error de red: ${err.message}`)));
        req.write(body);
        req.end();
    });
}

module.exports = { callGemini };
