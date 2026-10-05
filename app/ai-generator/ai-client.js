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
const { getApiKey, getModel, getProviderPlan, getSettings } = require('./ai-config');

const DEFAULT_TIMEOUT = 60000;
const DEFAULT_SYSTEM = 'Eres un asistente experto en diseño de preguntas educativas. Responde SOLO con JSON válido, sin texto adicional.';

const CLIENTS = {
    groq: callGroq,
    gemini: callGemini
};

const PROVIDER_LABELS = {
    groq: 'Groq',
    gemini: 'Gemini'
};

/**
 * Llama al proveedor indicado y devuelve el texto de la respuesta.
 * @param {string|null} provider - 'groq' | 'gemini'
 * @param {string} userPrompt
 * @param {string} [systemPrompt]
 * @param {number} [timeout] ms
 * @param {number} [maxTokens] solo lo usa Groq
 * @returns {Promise<string>}
 */
function callLLM(provider, userPrompt, systemPrompt = DEFAULT_SYSTEM, timeout = DEFAULT_TIMEOUT, maxTokens = 4096) {
    const client = CLIENTS[provider];
    const apiKey = client ? getApiKey(provider) : null;
    if (!apiKey) {
        return Promise.reject(new Error('API key de IA no configurada. Configúrala en el Panel > IA.'));
    }
    return client({
        apiKey,
        model: getModel(provider),
        userPrompt,
        systemPrompt,
        timeout,
        maxTokens
    });
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
        ...(!primary && { reason: 'API key no configurada. Ve a Panel > IA para configurarla.' })
    };
}

module.exports = { callLLM, getProviderPlan, checkAIStatus, PROVIDER_LABELS };
