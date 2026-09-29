'use strict';

/**
 * @fileoverview Valida el formato de la API key de Groq.
 * Exporta: validateApiKey(key) → { valid: boolean, error?: string }
 */

const MIN_LENGTH = 50;

function validateApiKey(key) {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'La API key es obligatoria', code: 'GROQ_API_KEY_REQUIRED' };
    }
    const trimmed = key.trim();
    if (!trimmed.startsWith('gsk_')) {
        return { valid: false, error: 'La API key de Groq debe comenzar con "gsk_"', code: 'GROQ_API_KEY_INVALID_PREFIX' };
    }
    if (trimmed.length < MIN_LENGTH) {
        return { valid: false, error: 'La API key parece demasiado corta', code: 'GROQ_API_KEY_TOO_SHORT' };
    }
    return { valid: true };
}

module.exports = { validateApiKey };
