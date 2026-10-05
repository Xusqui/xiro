'use strict';

/**
 * @fileoverview Valida el formato de las API keys y modelos de los proveedores de IA.
 * Solo comprueba el formato; no llama a ningún servicio externo.
 * Exporta:
 *   validateApiKey(provider, key) → { valid: boolean, error?: string, code?: string }
 *   validateModel(model)          → { valid: boolean, error?: string, code?: string }
 */

const GROQ_MIN_LENGTH = 50;

// Desde mayo de 2026 Google AI Studio emite «auth keys» que empiezan por "AQ.";
// las claves antiguas "AIza" dejaron de funcionar en septiembre de 2026.
const GEMINI_KEY_PATTERN = /^AQ\.[^.][A-Za-z0-9._-]{29,509}$/;

// El modelo va en la URL de Gemini: solo caracteres de identificador.
const MODEL_PATTERN = /^[A-Za-z0-9._/:-]{1,100}$/;

function _validateGroqKey(trimmed) {
    if (!trimmed.startsWith('gsk_')) {
        return { valid: false, error: 'La API key de Groq debe comenzar con "gsk_"', code: 'GROQ_API_KEY_INVALID_PREFIX' };
    }
    if (trimmed.length < GROQ_MIN_LENGTH) {
        return { valid: false, error: 'La API key parece demasiado corta', code: 'GROQ_API_KEY_TOO_SHORT' };
    }
    return { valid: true };
}

function _validateGeminiKey(trimmed) {
    if (!trimmed.startsWith('AQ.')) {
        return { valid: false, error: 'La API key de Gemini debe comenzar con "AQ."', code: 'GEMINI_API_KEY_INVALID_PREFIX' };
    }
    if (!GEMINI_KEY_PATTERN.test(trimmed)) {
        return { valid: false, error: 'La API key de Gemini no tiene un formato válido', code: 'GEMINI_API_KEY_INVALID_FORMAT' };
    }
    return { valid: true };
}

const KEY_VALIDATORS = {
    groq: _validateGroqKey,
    gemini: _validateGeminiKey
};

function validateApiKey(provider, key) {
    const validator = KEY_VALIDATORS[provider];
    if (!validator) {
        return { valid: false, error: 'Proveedor de IA desconocido', code: 'AI_PROVIDER_INVALID' };
    }
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'La API key es obligatoria', code: 'AI_API_KEY_REQUIRED' };
    }
    return validator(key.trim());
}

function validateModel(model) {
    if (typeof model !== 'string' || !MODEL_PATTERN.test(model.trim())) {
        return { valid: false, error: 'El modelo indicado no es válido', code: 'AI_MODEL_INVALID' };
    }
    return { valid: true };
}

module.exports = { validateApiKey, validateModel };
