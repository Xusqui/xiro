'use strict';

/**
 * @fileoverview Persiste la configuración de los proveedores de IA (Groq, Gemini y Ollama)
 * en groq-key.json. El nombre se conserva porque docker-compose lo monta como
 * fichero suelto; cambiarlo obligaría a tocar los despliegues.
 * Las claves NUNCA se almacenan en variables de entorno ni en docker-compose.
 *
 * Formato:
 *   { provider: 'groq'|'gemini'|'ollama', fallback: bool,
 *     groq:   { apiKey, model },
 *     gemini: { apiKey, model },
 *     ollama: { baseUrl, model, apiKey? } }
 * En Ollama la API key es opcional (proxy con autenticación u Ollama Cloud):
 * se considera configurado cuando tiene URL y modelo.
 * El formato antiguo ({ apiKey, model } en la raíz, solo Groq) se migra al leer.
 */

const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'groq-key.json');

// El orden marca la preferencia al elegir el proveedor de respaldo
const PROVIDERS = ['groq', 'gemini', 'ollama'];
const DEFAULT_PROVIDER = 'groq';
const DEFAULT_FALLBACK = true;
const DEFAULT_MODELS = {
    groq: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    gemini: () => 'gemini-3.5-flash-lite',
    ollama: () => null // depende de los modelos instalados en el servidor Ollama
};

function isValidProvider(provider) {
    return PROVIDERS.includes(provider);
}

function _readFile() {
    try {
        if (!fs.existsSync(KEY_FILE)) return {};
        return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')) || {};
    } catch {
        return {};
    }
}

/** Lee el fichero y lo normaliza al formato actual (migra el formato plano de Groq). */
function _load() {
    const raw = _readFile();
    const groq = { ...(raw.groq || {}) };
    if (raw.apiKey && !groq.apiKey) groq.apiKey = raw.apiKey;
    if (raw.model && !groq.model) groq.model = raw.model;

    return {
        provider: isValidProvider(raw.provider) ? raw.provider : DEFAULT_PROVIDER,
        fallback: typeof raw.fallback === 'boolean' ? raw.fallback : DEFAULT_FALLBACK,
        groq,
        gemini: { ...(raw.gemini || {}) },
        ollama: { ...(raw.ollama || {}) }
    };
}

function _save(data) {
    fs.writeFileSync(KEY_FILE, JSON.stringify(data, null, 2), { mode: 0o600, encoding: 'utf8' });
}

function getSettings() {
    const { provider, fallback } = _load();
    return { provider, fallback };
}

function setSettings({ provider, fallback }) {
    const data = _load();
    if (isValidProvider(provider)) data.provider = provider;
    if (typeof fallback === 'boolean') data.fallback = fallback;
    _save(data);
}

function getApiKey(provider) {
    if (!isValidProvider(provider)) return null;
    return _load()[provider].apiKey || null;
}

function getBaseUrl(provider) {
    if (provider !== 'ollama') return null;
    return _load().ollama.baseUrl || null;
}

function isConfigured(provider) {
    if (provider === 'ollama') return Boolean(getBaseUrl(provider) && getModel(provider));
    return Boolean(getApiKey(provider));
}

function getModel(provider) {
    if (!isValidProvider(provider)) return null;
    return _load()[provider].model || DEFAULT_MODELS[provider]();
}

function setApiKey(provider, key, model = null) {
    const data = _load();
    data[provider].apiKey = key;
    if (model) {
        data[provider].model = model;
    }
    _save(data);
}

/** apiKey null la quita: Ollama sin autenticación. */
function setOllamaConfig(baseUrl, model, apiKey = null) {
    const data = _load();
    data.ollama.baseUrl = baseUrl;
    data.ollama.model = model;
    if (apiKey) data.ollama.apiKey = apiKey;
    else delete data.ollama.apiKey;
    _save(data);
}

/**
 * Quita la clave (en Ollama, también la URL) conservando el modelo. No borra el archivo: en Docker está
 * montado como fichero suelto (bind mount) y unlink fallaría con EBUSY.
 */
function deleteApiKey(provider) {
    if (!fs.existsSync(KEY_FILE)) return;
    const data = _load();
    delete data[provider].apiKey;
    if (provider === 'ollama') delete data.ollama.baseUrl;
    _save(data);
}

/**
 * Decide qué proveedor usar y cuál de respaldo.
 * - Si el activo está configurado, es el principal; el respaldo (si el fallback
 *   está activado) es el primer otro proveedor configurado, en el orden de PROVIDERS.
 * - Si el activo no está configurado y el fallback está activado, los dos
 *   primeros proveedores configurados hacen de principal y respaldo.
 * @returns {{ primary: string|null, fallback: string|null }}
 */
function getProviderPlan() {
    const { provider, fallback } = getSettings();
    const others = PROVIDERS.filter(p => p !== provider && isConfigured(p));

    if (isConfigured(provider)) {
        return { primary: provider, fallback: fallback && others.length ? others[0] : null };
    }
    if (fallback && others.length) {
        return { primary: others[0], fallback: others[1] || null };
    }
    return { primary: null, fallback: null };
}

module.exports = {
    PROVIDERS,
    isValidProvider,
    getSettings,
    setSettings,
    getApiKey,
    getBaseUrl,
    isConfigured,
    getModel,
    setApiKey,
    setOllamaConfig,
    deleteApiKey,
    getProviderPlan
};
