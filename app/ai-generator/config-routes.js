'use strict';

/**
 * @fileoverview Rutas de configuración de los proveedores de IA (Groq y Gemini).
 * GET    /api/ai-generator/config           → { provider, fallback, providers: { groq, gemini } }
 *                                               cada uno { configured, model, maskedKey }
 * POST   /api/ai-generator/config           → guarda clave/modelo  body: { provider, apiKey, model }
 * DELETE /api/ai-generator/config?provider= → elimina la clave de ese proveedor
 * PUT    /api/ai-generator/config/settings  → proveedor activo y respaldo  body: { provider, fallback }
 * Si no se indica provider en POST/DELETE se asume 'groq' (compatibilidad con el panel antiguo).
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { handleRouteError } = require('../routes/helpers/RouteErrorHandler');
const {
    PROVIDERS,
    isValidProvider,
    getSettings,
    setSettings,
    getApiKey,
    isConfigured,
    getModel,
    setApiKey,
    deleteApiKey
} = require('./ai-config');
const { validateApiKey, validateModel } = require('./ai-validator');
const logger = require('../config/logger');

const router = express.Router();

function _maskKey(key) {
    if (!key) return null;
    return key.substring(0, 4) + '•'.repeat(Math.max(key.length - 8, 4)) + key.substring(key.length - 4);
}

function _readProvider(value, res) {
    const provider = value || 'groq';
    if (!isValidProvider(provider)) {
        res.status(400).json({ success: false, error: 'Proveedor de IA desconocido', code: 'AI_PROVIDER_INVALID' });
        return null;
    }
    return provider;
}

/**
 * GET /api/ai-generator/config
 * Devuelve el proveedor activo, el respaldo y el estado de cada proveedor
 * (nunca la clave misma, solo enmascarada).
 */
router.get('/api/ai-generator/config', authenticateAdmin, (req, res) => {
    try {
        const providers = {};
        for (const provider of PROVIDERS) {
            providers[provider] = {
                configured: isConfigured(provider),
                model: getModel(provider),
                maskedKey: _maskKey(getApiKey(provider))
            };
        }
        res.json({ ...getSettings(), providers });
    } catch (err) {
        handleRouteError(err, res);
    }
});

/**
 * POST /api/ai-generator/config
 * Body: { provider: 'groq'|'gemini', apiKey?: string, model?: string }
 * Valida y persiste la clave. Sin apiKey, actualiza solo el modelo de una clave ya guardada.
 */
router.post('/api/ai-generator/config', authenticateAdmin, (req, res) => {
    try {
        const { apiKey, model } = req.body || {};
        const provider = _readProvider(req.body?.provider, res);
        if (!provider) return;

        let finalApiKey = typeof apiKey === 'string' ? apiKey.trim() : null;

        // Si no se envía clave pero ya hay una guardada (y se está actualizando el modelo)
        if (!finalApiKey && isConfigured(provider)) {
            finalApiKey = getApiKey(provider);
        }

        const keyCheck = validateApiKey(provider, finalApiKey);
        if (!keyCheck.valid) {
            return res.status(400).json({ success: false, error: keyCheck.error, code: keyCheck.code });
        }

        const finalModel = typeof model === 'string' && model.trim() ? model.trim() : null;
        if (finalModel) {
            const modelCheck = validateModel(finalModel);
            if (!modelCheck.valid) {
                return res.status(400).json({ success: false, error: modelCheck.error, code: modelCheck.code });
            }
        }

        setApiKey(provider, finalApiKey, finalModel);
        logger.info(`[ai-generator] Config de ${provider} actualizada`);
        res.json({ success: true, provider, model: getModel(provider) });
    } catch (err) {
        handleRouteError(err, res);
    }
});

/**
 * DELETE /api/ai-generator/config?provider=groq|gemini
 * Elimina la API key persistida de ese proveedor.
 */
router.delete('/api/ai-generator/config', authenticateAdmin, (req, res) => {
    try {
        const provider = _readProvider(req.query.provider, res);
        if (!provider) return;

        deleteApiKey(provider);
        logger.info(`[ai-generator] API key de ${provider} eliminada`);
        res.json({ success: true });
    } catch (err) {
        handleRouteError(err, res);
    }
});

/**
 * PUT /api/ai-generator/config/settings
 * Body: { provider: 'groq'|'gemini', fallback: boolean }
 */
router.put('/api/ai-generator/config/settings', authenticateAdmin, (req, res) => {
    try {
        const { provider, fallback } = req.body || {};
        if (!isValidProvider(provider)) {
            return res.status(400).json({ success: false, error: 'Proveedor de IA desconocido', code: 'AI_PROVIDER_INVALID' });
        }
        if (typeof fallback !== 'boolean') {
            return res.status(400).json({ success: false, error: 'El campo "fallback" debe ser booleano', code: 'AI_FALLBACK_INVALID' });
        }

        setSettings({ provider, fallback });
        logger.info(`[ai-generator] Proveedor activo: ${provider}, respaldo ${fallback ? 'activado' : 'desactivado'}`);
        res.json({ success: true, ...getSettings() });
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
