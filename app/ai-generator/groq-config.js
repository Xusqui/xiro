'use strict';

/**
 * @fileoverview Persiste la API key de Groq en un archivo JSON separado.
 * La clave NUNCA se almacena en variables de entorno ni en docker-compose.
 * Exporta: isGroqConfigured, getApiKey, setApiKey, deleteApiKey, getGroqModel
 */

const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'groq-key.json');

function _load() {
    try {
        if (!fs.existsSync(KEY_FILE)) return {};
        return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function _save(data) {
    fs.writeFileSync(KEY_FILE, JSON.stringify(data, null, 2), { mode: 0o600, encoding: 'utf8' });
}

function isGroqConfigured() {
    return Boolean(_load().apiKey);
}

function getApiKey() {
    return _load().apiKey || null;
}

function setApiKey(key, model = null) {
    const data = _load();
    data.apiKey = key;
    if (model) {
        data.model = model;
    }
    _save(data);
}

/**
 * Quita la clave conservando el modelo. No borra el archivo: en Docker está
 * montado como fichero suelto (bind mount) y unlink fallaría con EBUSY.
 */
function deleteApiKey() {
    if (!fs.existsSync(KEY_FILE)) return;
    const data = _load();
    delete data.apiKey;
    _save(data);
}

function getGroqModel() {
    return _load().model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

module.exports = { isGroqConfigured, getApiKey, setApiKey, deleteApiKey, getGroqModel };
