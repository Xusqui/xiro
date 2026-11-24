'use strict';

/**
 * @fileoverview Punto único de llamada a la IA: elige el cliente según el proveedor.
 * Exporta:
 *   callLLM(provider, userPrompt, systemPrompt?, timeout?, maxTokens?) → Promise<string>
 *   getProviderPlan() → { primary, fallback } (ver ai-config)
 *   checkAIStatus() → { available, provider, providerLabel, model, fallbackProvider, fallbackModel, reason? }
 */

const { callGroq } = require('./groq-client');
const { callGemini } = require('./gemini-client');
const { callOllama } = require('./ollama-client');
const { callOpenAI } = require('./openai-client');
const { getApiKey, getBaseUrl, getModel, getProviderPlan, getSettings } = require('./ai-config');

const DEFAULT_TIMEOUT = 60000;
const DEFAULT_SYSTEM =
    'Eres un asistente experto en diseño de preguntas educativas. Responde SOLO con JSON válido, sin texto adicional.';

const CLIENTS = {
    groq: callGroq,
    gemini: callGemini,
    openai: callOpenAI,
    ollama: callOllama
};

const PROVIDER_LABELS = {
    groq: 'Groq',
    gemini: 'Gemini',
    openai: 'OpenAI',
    ollama: 'Ollama'
};

/**
 * Llama al proveedor indicado y devuelve el texto de la respuesta.
 * @param {Object} params
 * @param {string|null} params.provider - 'groq' | 'gemini' | 'openai' | 'ollama'
 * @param {string} [params.model] - modelo a usar; sin él, el configurado del proveedor
 * @param {string} params.userPrompt
 * @param {string} [params.systemPrompt]
 * @param {number} [params.timeout] ms
 * @param {number} [params.maxTokens] lo usan Groq y Ollama (Gemini y OpenAI no fijan límite)
 * @param {boolean} [params.json] la respuesta es un objeto JSON (Ollama lo fuerza con format: 'json')
 * @returns {Promise<string>}
 */
function callLLMOptions({
    provider,
    model,
    userPrompt,
    systemPrompt = DEFAULT_SYSTEM,
    timeout = DEFAULT_TIMEOUT,
    maxTokens = 4096,
    json = false
}) {
    const client = CLIENTS[provider];
    const chosenModel = model || getModel(provider);
    if (provider === 'ollama') {
        const baseUrl = getBaseUrl(provider);
        if (!baseUrl || !chosenModel) {
            return Promise.reject(new Error('Ollama no configurado. Indica la URL y el modelo en el Panel > IA.'));
        }
        return client({
            baseUrl,
            apiKey: getApiKey(provider),
            model: chosenModel,
            userPrompt,
            systemPrompt,
            timeout,
            maxTokens,
            ...(json && { json })
        });
    }
    const apiKey = client ? getApiKey(provider) : null;
    if (!apiKey) {
        return Promise.reject(new Error('API key de IA no configurada. Configúrala en el Panel > IA.'));
    }
    return client({ apiKey, model: chosenModel, userPrompt, systemPrompt, timeout, maxTokens });
}

/**
 * Llama al proveedor indicado con su modelo configurado (ver callLLMOptions).
 * @param {string|null} provider - 'groq' | 'gemini' | 'openai' | 'ollama'
 * @param {string} userPrompt
 * @param {string} [systemPrompt]
 * @param {number} [timeout] ms
 * @param {number} [maxTokens] lo usan Groq y Ollama
 * @returns {Promise<string>}
 */
function callLLM(provider, userPrompt, systemPrompt = DEFAULT_SYSTEM, timeout = DEFAULT_TIMEOUT, maxTokens = 4096) {
    return callLLMOptions({ provider, userPrompt, systemPrompt, timeout, maxTokens });
}

/**
 * Devuelve el estado del proveedor de IA que se usará al generar.
 */
function checkAIStatus() {
    const { primary, fallback } = getProviderPlan();
    const provider = primary || getSettings().provider;
    return {
        available: Boolean(primary),
        provider,
        providerLabel: PROVIDER_LABELS[provider],
        model: getModel(provider),
        fallbackProvider: fallback,
        fallbackModel: fallback ? getModel(fallback) : null,
        ...(!primary && { reason: 'Proveedor de IA no configurado. Ve a Panel > IA para configurarlo.' })
    };
}

module.exports = { callLLM, callLLMOptions, getProviderPlan, checkAIStatus, PROVIDER_LABELS };
