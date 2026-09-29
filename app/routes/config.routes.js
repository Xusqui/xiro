/**
 * @fileoverview Rutas de configuración dinámica del servidor
 * GET  /api/admin/config        → devuelve valores actuales (solo admin)
 * POST /api/admin/config        → actualiza uno o varios parámetros (solo admin)
 */

'use strict';

const express = require('express');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const runtimeConfig = require('../config/runtime-config');
const logger = require('../config/logger');
const { RedisSyncBus } = require('../sockets/sync/RedisSyncBus');
const { getRedisClient } = require('../config/redis');

const router = express.Router();

function collectConfigValidationErrors(updates, schema) {
    const errors = {};
    for (const [key, value] of Object.entries(updates)) {
        if (!(key in schema)) {
            errors[key] = 'Parámetro desconocido';
            continue;
        }

        const validationError = runtimeConfig.validate(key, value);
        if (validationError) {
            errors[key] = validationError;
        }
    }
    return errors;
}

async function applyLogLevelUpdateIfNeeded(updates, userRole) {
    if (!('LOG_LEVEL' in updates)) {
        return;
    }

    logger.setLogLevel(updates.LOG_LEVEL);

    const redisLevelMap = { debug: 'debug', info: 'notice', warn: 'warning', error: 'warning' };
    const redisLevel = redisLevelMap[updates.LOG_LEVEL] || 'notice';

    try {
        const redisClient = await getRedisClient();
        if (redisClient?.isReady) {
            await redisClient.sendCommand(['CONFIG', 'SET', 'loglevel', redisLevel]);
        }
    } catch (_) {
        // Redis no disponible, se ignora para no bloquear el cambio local.
    }

    logger.info('Log level changed', {
        newLevel: updates.LOG_LEVEL,
        redisLevel,
        by: userRole
    });
}

/**
 * GET /api/admin/config
 * Devuelve todos los parámetros dinámicos con su valor actual y schema
 */
router.get('/api/admin/config', authenticateAdmin, authorizeAdmin, (req, res) => {
    try {
        const all = runtimeConfig.getAll();
        // Serializar para el cliente (sin el objeto schema completo, solo lo útil)
        const response = {};
        for (const [key, entry] of Object.entries(all)) {
            response[key] = {
                value: entry.schema.sensitive ? (entry.value ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '') : entry.value,
                type: entry.schema.type,
                sensitive: entry.schema.sensitive || false,
                ...(entry.schema.min !== undefined && { min: entry.schema.min }),
                ...(entry.schema.max !== undefined && { max: entry.schema.max }),
                ...(entry.schema.values && { values: entry.schema.values }),
            };
        }
        res.json({ success: true, config: response });
    } catch (err) {
        logger.error('Error getting runtime config', { error: err.message });
        res.status(500).json({ success: false, error: 'Error al obtener configuración', code: 'GET_CONFIG_FAILED' });
    }
});

/**
 * POST /api/admin/config
 * Body: { updates: { KEY: value, ... } }
 * Actualiza en memoria, process.env y persiste en .env
 */
router.post('/api/admin/config', authenticateAdmin, authorizeAdmin, async (req, res) => {
    try {
        const { updates } = req.body;
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
            return res.status(400).json({ success: false, error: 'Body debe incluir { updates: { ... } }', code: 'CONFIG_BODY_INVALID' });
        }

        const schema = runtimeConfig.getSchema();
        const errors = collectConfigValidationErrors(updates, schema);

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        // Aplicar cambios en memoria
        for (const [key, value] of Object.entries(updates)) {
            runtimeConfig.set(key, value);
        }

        await applyLogLevelUpdateIfNeeded(updates, req.user.role);

        // Persistir en runtime-overrides.json (dentro de app/, montado en el contenedor)
        let persisted = true;
        let persistError = null;
        try {
            runtimeConfig.persistAll();
        } catch (err) {
            persisted = false;
            persistError = err.message;
        }

        // Notificar a todos los workers via Redis para que recarguen su store
        try {
            const syncBus = RedisSyncBus.getInstance();
            syncBus.publish('config-updated', { originWorkerId: process.pid, keys: Object.keys(updates) }).catch(() => { });
        } catch (_) { /* Redis no disponible, solo afecta a otros workers */ }

        logger.info('Runtime config updated', {
            keys: Object.keys(updates),
            persisted,
            user: req.user.role
        });

        res.json({
            success: true,
            persisted,
            persistError,
            applied: Object.keys(updates),
        });
    } catch (err) {
        logger.error('Error updating runtime config', { error: err.message });
        res.status(500).json({ success: false, error: 'Error al actualizar configuración', code: 'UPDATE_CONFIG_FAILED' });
    }
});

module.exports = router;
