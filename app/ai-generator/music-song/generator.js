'use strict';

/**
 * @fileoverview Canción con IA: pide a un proveedor la progresión, el tempo y el motivo, valida la
 * respuesta (spec.js) y, si no vale, reintenta pasándole el motivo del rechazo. Si el proveedor
 * configurado falla (cuota, red…) prueba el de respaldo; un proveedor elegido a mano no tiene respaldo.
 */

const { callLLMOptions, getProviderPlan } = require('../ai-client');
const { SYSTEM_PROMPT, buildMusicSongPrompt, buildRetryPrompt } = require('./prompt');
const { parseSongReply } = require('./spec');
const logger = require('../../config/logger');

const ATTEMPTS = 3;
const TIMEOUT = 180000;
const MAX_TOKENS = 2048;

function codedError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function providersToTry(provider) {
    if (provider) return [provider];
    const { primary, fallback } = getProviderPlan();
    return [primary, fallback].filter(Boolean);
}

/** Hasta ATTEMPTS respuestas de un proveedor; solo se reintenta si la respuesta no es válida. */
async function askProvider({ prompt, provider, model }) {
    let userPrompt = buildMusicSongPrompt(prompt);
    let lastInvalid = null;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const reply = await callLLMOptions({ provider, model, userPrompt, systemPrompt: SYSTEM_PROMPT, timeout: TIMEOUT, maxTokens: MAX_TOKENS, json: true });
        try {
            return { ...parseSongReply(reply), provider, model: model || null, attempts: attempt };
        } catch (error) {
            if (error.code !== 'AI_MUSIC_INVALID') throw error;
            lastInvalid = error;
            userPrompt = buildRetryPrompt(prompt, error.message);
        }
    }
    throw lastInvalid;
}

/**
 * @param {Object} params
 * @param {string} params.prompt - Descripción del tema escrita por el admin
 * @param {string} [params.provider] - 'groq' | 'gemini' | 'openai' | 'ollama'; sin él, el configurado (con respaldo)
 * @param {string} [params.model] - Modelo del proveedor elegido
 * @returns {Promise<{title: string, tempo: number, song: Object, provider: string, model: ?string, attempts: number}>}
 * @throws {Error} con `code`: AI_MUSIC_NO_PROVIDER, AI_MUSIC_INVALID u otro error del proveedor
 */
async function generateMusicSong({ prompt, provider, model }) {
    const providers = providersToTry(provider);
    if (!providers.length) throw codedError('AI_MUSIC_NO_PROVIDER', 'Proveedor de IA no configurado. Ve a Panel > IA para configurarlo.');
    let lastError = null;
    for (const candidate of providers) {
        try {
            return await askProvider({ prompt, provider: candidate, model });
        } catch (error) {
            lastError = error;
            logger.warn('[ai-generator] Canción con IA: proveedor sin resultado', { provider: candidate, code: error.code, error: error.message });
        }
    }
    throw lastError;
}

module.exports = { generateMusicSong };
