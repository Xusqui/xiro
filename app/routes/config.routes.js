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

        // Aplicar cambios en memoria (guardando los anteriores por si no se pueden persistir)
        const previous = {};
        for (const [key, value] of Object.entries(updates)) {
            previous[key] = runtimeConfig.get(key);
            runtimeConfig.set(key, value);
        }

        // Persistir en runtime-overrides.json (montado en el contenedor). Si falla,
        // no se da por guardado: este worker vuelve a los valores anteriores, no se
        // avisa al resto y el panel muestra el error (antes respondía «guardado» y el
        // cambio se perdía al recargar desde el fichero).
        try {
            runtimeConfig.persistAll();
        } catch (err) {
            for (const [key, value] of Object.entries(previous)) {
                if (value !== undefined) runtimeConfig.set(key, value);
            }
            logger.error('Runtime config not persisted', { error: err.message, code: err.code, keys: Object.keys(updates) });
            return res.status(500).json({
                success: false,
                code: 'CONFIG_PERSIST_FAILED',
                error: `No se pudo guardar la configuración (${err.code || err.message}). `
                    + 'Revisa en el servidor que config/runtime-overrides.json es un fichero y pertenece al uid 1001 (usuario del contenedor).'
            });
        }

        await applyLogLevelUpdateIfNeeded(updates, req.user.role);

        // Notificar a todos los workers via Redis para que recarguen su store
        try {
            const syncBus = RedisSyncBus.getInstance();
            syncBus.publish('config-updated', { originWorkerId: process.pid, keys: Object.keys(updates) }).catch(() => { });
        } catch (_) { /* Redis no disponible, solo afecta a otros workers */ }

        logger.info('Runtime config updated', {
            keys: Object.keys(updates),
            persisted: true,
            user: req.user.role
        });

        res.json({
            success: true,
            persisted: true,
            applied: Object.keys(updates),
        });
    } catch (err) {
        logger.error('Error updating runtime config', { error: err.message });
        res.status(500).json({ success: false, error: 'Error al actualizar configuración', code: 'UPDATE_CONFIG_FAILED' });
    }
});

module.exports = router;
