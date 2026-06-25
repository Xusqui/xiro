'use strict';

/**
 * @fileoverview Rutas de configuración de Groq para el módulo ia-generator.
 * GET    /api/ai-generator/config  → { configured: bool, model: string }
 * POST   /api/ai-generator/config  → guarda la API key  body: { apiKey }
 * DELETE /api/ai-generator/config  → elimina la API key
 */

const express = require('express');
const { authenticateAdmin } = require('../middlewares/auth');
const { handleRouteError } = require('../routes/helpers/RouteErrorHandler');
const { isGroqConfigured, setApiKey, deleteApiKey, getGroqModel, getApiKey } = require('./groq-config');
const { validateApiKey } = require('./groq-validator');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/ai-generator/config
 * Devuelve si la clave está configurada y el modelo activo (nunca la clave misma).
 */
router.get('/api/ai-generator/config', authenticateAdmin, (req, res) => {
    try {
        const key = getApiKey();
        let maskedKey = null;
        if (key) {
            maskedKey = key.substring(0, 4) + '•'.repeat(Math.max(key.length - 8, 4)) + key.substring(key.length - 4);
        }
        res.json({ configured: isGroqConfigured(), model: getGroqModel(), maskedKey });
    } catch (err) {
        handleRouteError(err, res);
    }
});

/**
 * POST /api/ai-generator/config
 * Body: { apiKey: string, model: string }
 * Valida y persiste la clave.
 */
router.post('/api/ai-generator/config', authenticateAdmin, (req, res) => {
    try {
        const { apiKey, model } = req.body || {};

        let finalApiKey = apiKey ? apiKey.trim() : null;

        // Si no se envía clave pero ya hay una guardada (y se está actualizando el modelo)
        if (!finalApiKey && isGroqConfigured()) {
            finalApiKey = require('./groq-config').getApiKey();
        }

        const { valid, error } = validateApiKey(finalApiKey);
        if (!valid) {
            return res.status(400).json({ success: false, error });
        }

        setApiKey(finalApiKey, model ? model.trim() : null);
        logger.info('[ai-generator] Groq config actualizada');
        res.json({ success: true, model: getGroqModel() });
    } catch (err) {
        handleRouteError(err, res);
    }
});

/**
 * DELETE /api/ai-generator/config
 * Elimina la API key persistida.
 */
router.delete('/api/ai-generator/config', authenticateAdmin, (req, res) => {
    try {
        deleteApiKey();
        logger.info('[ai-generator] Groq API key eliminada');
        res.json({ success: true });
    } catch (err) {
        handleRouteError(err, res);
    }
});

module.exports = router;
