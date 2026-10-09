'use strict';

/**
 * @fileoverview Cliente HTTP para un servidor Ollama (API nativa).
 * Exporta:
 *   normalizeBaseUrl(url) → string|null   URL http(s) sin barra final, o null si no es válida
 *   callOllama({ baseUrl, apiKey?, model, userPrompt, systemPrompt, timeout, maxTokens }) → Promise<string>
 *   listOllamaModels(baseUrl, apiKey?, timeout?) → Promise<Array<{ name, size, parameterSize, family }>>
 *
 * Ollama no tiene autenticación propia. La API key es opcional: se envía como
 * "Authorization: Bearer" para un proxy delante de Ollama (nginx, Caddy) o para Ollama Cloud. Los modelos locales son más lentos que los de Groq o
 * Gemini, por eso el timeout nunca baja de MIN_TIMEOUT.
 *
 * No se usa format: 'json': esa gramática obliga a devolver un objeto y los
 * prompts piden un array, así que el modelo envolvía la pregunta y el parser
 * acababa tomando el array de opciones como si fueran preguntas.
 */

const http = require('http');
const https = require('https');

const MIN_TIMEOUT = 300000;
const LIST_TIMEOUT = 10000;
// El contexto por defecto de Ollama (2048-4096 tokens) corta en silencio los
// prompts con texto de documento largo.
const NUM_CTX = 8192;
// maxTokens está calculado para el JSON de Groq; los modelos locales son más
// verbosos y, si razonan pese a think: false, el límite se agota antes de responder.
const MIN_NUM_PREDICT = 4096;
const THINK_BLOCK = /<think>[\s\S]*?<\/think>/gi;

function normalizeBaseUrl(url) {
    if (typeof url !== 'string' || !url.trim()) return null;
    try {
        const parsed = new URL(url.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        if (parsed.search || parsed.hash) return null;
        return parsed.toString().replace(/\/+$/, '');
    } catch {
        return null;
    }
}

function _buildHttpError(statusCode, parsed) {
    const msg = (typeof parsed?.error === 'string' && parsed.error) || `HTTP ${statusCode}`;
    const hint = statusCode === 401 || statusCode === 403 ? ' (API key ausente o incorrecta)' : '';
    return new Error(`Ollama API error: ${msg}${hint}`);
}

/**
 * Petición JSON a Ollama. Resuelve con el cuerpo parseado si el estado es 200.
 * @param {string} baseUrl
 * @param {string} apiPath - p. ej. '/api/chat'
 * @param {Object|null} payload - null para GET
 * @param {number} timeout ms
 * @param {string|null} [apiKey]
 * @returns {Promise<Object>}
 */
function _request(baseUrl, apiPath, payload, timeout, apiKey = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(baseUrl + apiPath);
        const transport = url.protocol === 'https:' ? https : http;
        const body = payload ? JSON.stringify(payload) : null;
        const headers = { 'Accept': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        if (body) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = transport.request(url, { method: body ? 'POST' : 'GET', headers }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed = null;
                let parseError = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parseError = e;
                }
                // Un proxy que rechaza la clave suele responder HTML, no JSON
                if (res.statusCode !== 200) {
                    return reject(_buildHttpError(res.statusCode, parsed));
                }
                if (parseError) {
                    return reject(new Error(`Error parseando respuesta de Ollama: ${parseError.message}`));
                }
                resolve(parsed);
            });
        });

        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error(`Timeout: Ollama no respondió en ${timeout / 1000}s`));
        });

        req.on('error', (err) => reject(new Error(`Error de red con Ollama: ${err.message}`)));
        if (body) req.write(body);
        req.end();
    });
}

/**
 * Llama a /api/chat sin streaming ni razonamiento y devuelve el texto de la respuesta.
 * @param {Object} params
 * @param {string} params.baseUrl
 * @param {string} params.model
 * @param {string} params.userPrompt
 * @param {string} params.systemPrompt
 * @param {number} params.timeout ms
 * @param {number} params.maxTokens tokens máximos de salida (num_predict)
 * @returns {Promise<string>}
 */
async function callOllama({ baseUrl, apiKey, model, userPrompt, systemPrompt, timeout, maxTokens }) {
    const parsed = await _request(baseUrl, '/api/chat', {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        stream: false,
        // Los modelos con razonamiento (qwen3, deepseek-r1…) gastaban todo num_predict
        // pensando y devolvían content vacío. Los modelos sin razonamiento lo ignoran.
        think: false,
        options: { temperature: 0.7, num_ctx: NUM_CTX, num_predict: Math.max(maxTokens * 3, MIN_NUM_PREDICT) }
    }, Math.max(timeout || 0, MIN_TIMEOUT), apiKey);

    // Versiones antiguas de Ollama dejan el razonamiento dentro de content
    const text = (parsed.message?.content || '').replace(THINK_BLOCK, '').trim();
    if (!text) throw new Error(`Ollama devolvió una respuesta vacía${_emptyReason(parsed)}`);
    return text;
}

/** Explica por qué no hay texto: límite de tokens agotado y/o razonamiento sin respuesta. */
function _emptyReason(parsed) {
    const reasons = [];
    if (parsed.done_reason) reasons.push(`done_reason: ${parsed.done_reason}`);
    if (parsed.message?.thinking) reasons.push('el modelo solo devolvió razonamiento');
    return reasons.length ? ` (${reasons.join(', ')})` : '';
}

/**
 * Lista los modelos instalados en el servidor Ollama (/api/tags).
 * @param {string} baseUrl
 * @param {string|null} [apiKey]
 * @param {number} [timeout] ms
 */
async function listOllamaModels(baseUrl, apiKey = null, timeout = LIST_TIMEOUT) {
    const parsed = await _request(baseUrl, '/api/tags', null, timeout, apiKey);
    return (parsed.models || [])
        .filter(m => m && typeof m.name === 'string')
        .map(m => ({
            name: m.name,
            size: Number(m.size) || 0,
            parameterSize: m.details?.parameter_size || null,
            family: m.details?.family || null
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { normalizeBaseUrl, callOllama, listOllamaModels };
