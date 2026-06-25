/**
 * @fileoverview Rutas de ajustes de interfaz de usuario
 * GET  /api/ui-settings          → devuelve ajustes (público, lectura en index.html)
 * POST /api/admin/ui-settings    → actualiza un ajuste (solo admin)
 */

'use strict';

const express = require('express');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const uiSettings = require('../config/ui-settings');
const runtimeConfig = require('../config/runtime-config');
const logger = require('../config/logger');

const router = express.Router();

/** Público — index.html lo consume para aplicar visibilidad */
router.get('/api/ui-settings', (req, res) => {
    const settings = uiSettings.getAll();
    settings.umamiServerUrl = runtimeConfig.get('UMAMI_SERVER_URL');
    settings.umamiWebsiteId = runtimeConfig.get('UMAMI_WEBSITE_ID');
    res.json(settings);
});

/** Admin — actualiza un ajuste de UI */
router.post('/api/admin/ui-settings', authenticateAdmin, authorizeAdmin, (req, res) => {
    try {
        const { key, value } = req.body;
        if (typeof key !== 'string' || !(key)) {
            return res.status(400).json({ success: false, error: 'Se requiere { key, value }', code: 'UI_SETTING_KEY_VALUE_REQUIRED' });
        }
        uiSettings.set(key, value);
        uiSettings.persistAll();
        logger.info('UI setting updated', { key, value });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
