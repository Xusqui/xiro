'use strict';

/**
 * @fileoverview Rutas de configuración de Ollama (servidor de modelos local).
 * POST /api/ai-generator/ollama/models → { success, baseUrl, models: [{ name, size, parameterSize, family }] }
 *                                        body: { baseUrl?, apiKey? }; sin baseUrl usa la URL guardada
 * POST /api/ai-generator/ollama/config → guarda URL, modelo y API key opcional  body: { baseUrl, model, apiKey? }
 *                                        comprueba que el servidor responde y que el modelo está instalado
 * El borrado usa DELETE /api/ai-generator/config?provider=ollama (config-routes).
 * Las peticiones a Ollama salen del servidor, no del navegador: la URL debe ser
 * accesible desde el contenedor (p. ej. http://192.168.1.10:11434).
 *
 * La API key es opcional (proxy con autenticación delante de Ollama u Ollama Cloud).
 * Va en el cuerpo, nunca en la URL, para que no quede en logs. Si llega vacía se
 * reutiliza la guardada, pero solo para la misma URL: nunca se envía a otro servidor.
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { handleRouteError } = require('../routes/helpers/RouteErrorHandler');
const { getApiKey, getBaseUrl, setOllamaConfig } = require('./ai-config');
const { validateModel } = require('./ai-validator');
const { normalizeBaseUrl, listOllamaModels } = require('./ollama-client');
const logger = require('../config/logger');

const router = express.Router();

// Caracteres imprimibles sin espacios: va tal cual en la cabecera Authorization
const API_KEY_PATTERN = /^[\x21-\x7E]{8,512}$/;

function _badRequest(res, error, code) {
    res.status(400).json({ success: false, error, code });
}

function _unreachable(res, err) {
    logger.warn(`[ai-generator] Ollama no accesible: ${err.message}`);
    res.status(502).json({ success: false, error: `No se pudo contactar con Ollama: ${err.message}`, code: 'OLLAMA_UNREACHABLE' });
}

/**
 * Decide qué API key usar con baseUrl.
 * @returns {{ apiKey: string|null } | { error: string }}
 */
function _resolveApiKey(baseUrl, rawKey) {
    const typed = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (typed) {
        return API_KEY_PATTERN.test(typed)
            ? { apiKey: typed }
            : { error: 'La API key debe tener entre 8 y 512 caracteres, sin espacios' };
    }
    return { apiKey: baseUrl === getBaseUrl('ollama') ? getApiKey('ollama') : null };
}

router.post('/api/ai-generator/ollama/models', authenticateAdmin, async (req, res) => {
    try {
        const { baseUrl: rawUrl, apiKey: rawKey } = req.body || {};
        const baseUrl = rawUrl ? normalizeBaseUrl(String(rawUrl)) : getBaseUrl('ollama');
        if (!baseUrl) {
            return _badRequest(res, 'Indica una URL de Ollama válida (http:// o https://)', 'OLLAMA_URL_INVALID');
        }
        const key = _resolveApiKey(baseUrl, rawKey);
        if (key.error) return _badRequest(res, key.error, 'OLLAMA_API_KEY_INVALID');

        let models;
        try {
            models = await listOllamaModels(baseUrl, key.apiKey);
        } catch (err) {
            return _unreachable(res, err);
        }
        res.json({ success: true, baseUrl, models });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post('/api/ai-generator/ollama/config', authenticateAdmin, async (req, res) => {
    try {
        const { baseUrl: rawUrl, model: rawModel, apiKey: rawKey } = req.body || {};
        const baseUrl = normalizeBaseUrl(rawUrl);
        if (!baseUrl) {
            return _badRequest(res, 'Indica una URL de Ollama válida (http:// o https://)', 'OLLAMA_URL_INVALID');
        }

        const model = typeof rawModel === 'string' ? rawModel.trim() : '';
        if (!validateModel(model).valid) {
            return _badRequest(res, 'Elige uno de los modelos instalados en Ollama', 'OLLAMA_MODEL_REQUIRED');
        }

        const key = _resolveApiKey(baseUrl, rawKey);
        if (key.error) return _badRequest(res, key.error, 'OLLAMA_API_KEY_INVALID');

        let models;
        try {
            models = await listOllamaModels(baseUrl, key.apiKey);
        } catch (err) {
            return _unreachable(res, err);
        }
        if (!models.some(m => m.name === model)) {
            return _badRequest(res, `El modelo "${model}" no está instalado en ese servidor Ollama`, 'OLLAMA_MODEL_NOT_FOUND');
        }

        setOllamaConfig(baseUrl, model, key.apiKey);
        logger.info(`[ai-generator] Config de ollama actualizada (${baseUrl}, ${model}, ${key.apiKey ? 'con' : 'sin'} API key)`);
        res.json({ success: true, provider: 'ollama', baseUrl, model });
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
