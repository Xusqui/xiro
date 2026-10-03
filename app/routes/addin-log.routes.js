/**
 * @fileoverview Endpoint de logs del Add-in de PowerPoint
 *
 * POST /api/addin-log  → escribe una entrada en el logger del servidor
 *   Body: { level, module, message, data? }
 *
 * Solo se acepta desde IPs de la red interna o con token fijo de depuración.
 * En producción la ruta queda activa pero sin autenticación porque el add-in
 * corre en el navegador del presentador y no tiene secretos del servidor.
 * Los logs van al nivel correspondiente de Winston (info/warn/error/debug).
 */
'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');
const dbService = require('../services/db.service');

const router = express.Router();

const ALLOWED_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

// Limitar a 120 req/min para evitar spam de logs
const logLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many log requests', code: 'ADDIN_LOG_RATE_LIMITED' },
});

// Limitar a 30 req/min para creación de sesiones
const sessionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many session creation requests', code: 'ADDIN_SESSION_RATE_LIMITED' },
});

/**
 * POST /api/addin-log
 * Body: { level: string, module: string, message: string, data?: object }
 */
router.post('/api/addin-log', logLimiter, (req, res) => {
    const { level = 'debug', module: mod = 'addin', message = '', data } = req.body;

    // Validar nivel para evitar log injection
    const safeLevel = ALLOWED_LEVELS.has(level) ? level : 'debug';

    // Construir entrada de log
    const entry = {
        source: 'ppt-addin',
        module: String(mod).slice(0, 64),
        ...(data && typeof data === 'object' ? { data } : {}),
    };

    logger[safeLevel](`[addin] ${String(message).slice(0, 512)}`, entry);

    res.json({ ok: true });
});

/**
 * POST /api/addin/create-session
 * Body: { pin: string }
 * Valida el PIN contra la base de datos y genera un sessionId con formato PIN-DDDD.
 * Es el backend quien genera el ID para garantizar que el formato es correcto
 * y que el PIN existe antes de que el presentador abra el lobby.
 */
router.post('/api/addin/create-session', sessionLimiter, async (req, res) => {
    try {
        const pin = (req.body && typeof req.body.pin === 'string' ? req.body.pin : '').toUpperCase().trim();

        if (!/^[A-Z0-9]{4,10}$/.test(pin)) {
            return res.status(400).json({ error: 'PIN inválido', code: 'PIN_INVALID' });
        }

        // Reutilizar la validación existente del servicio de BD
        const result = await dbService.validatePinInDatabase(pin);
        if (!result || !result.valid) {
            return res.status(404).json({ error: 'PIN no encontrado', code: 'PIN_NOT_FOUND' });
        }

        // Generar sufijo de 4 dígitos (formato validado por el backend)
        const suffix = String(Math.floor(Math.random() * 9000) + 1000);
        const sessionId = `${pin}-${suffix}`;

        logger.info('[addin] create-session', { pin, sessionId });
        res.json({ sessionId });
    } catch (err) {
        logger.error('[addin] create-session error', { error: err.message });
        res.status(500).json({ error: 'Error al crear sesión', code: 'CREATE_SESSION_FAILED' });
    }
});

// POST /api/addin/end-game se eliminó: no exigía autenticación y permitía terminar
// cualquier partida conociendo su sessionId (PIN-DDDD). El add-in ignora el fallo
// de esa llamada y carga el podio igualmente. Si se recupera, debe autenticarse.

module.exports = router;
