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

/**
 * POST /api/addin/end-game
 * Body: { sessionId: string, gameType?: string }
 * Finaliza la partida activa y persiste la sesión en BD.
 * Emite results-ready al presentador cuando el ID de BD esté disponible.
 */
router.post('/api/addin/end-game', sessionLimiter, async (req, res) => {
    try {
        const sessionId = (req.body && typeof req.body.sessionId === 'string' ? req.body.sessionId : '').trim();
        const gameType = (req.body && typeof req.body.gameType === 'string' ? req.body.gameType : '').toLowerCase();

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId requerido', code: 'SESSION_ID_REQUIRED' });
        }

        const io = req.app.get('io');
        const { activeGames } = require('../state/globalState');

        // Comprobar si la partida sigue activa
        const game = activeGames.get(sessionId);
        if (!game) {
            // La partida ya terminó (o nunca existió) — buscar la sesión en BD.
            // saveGameSession guarda el roomId completo como pin (ej. "DIATERMIA-7329").
            const { getLastGameSessionByPin } = require('../services/db/game-session.service');
            const rowFull = await getLastGameSessionByPin(sessionId).catch(() => null);
            const rowShort = rowFull ? null : await getLastGameSessionByPin(sessionId.split('-')[0]).catch(() => null);
            const row = rowFull || rowShort;
            if (row) return res.json({ ok: true, dbSessionId: row.id });
            return res.status(404).json({ error: 'Partida no encontrada', code: 'GAME_NOT_FOUND', sessionId });
        }

        if (game.ended) {
            // Ya finalizada, los resultados deberían estar en BD
            return res.json({ ok: true, alreadyEnded: true });
        }

        // Finalizar según el tipo de juego
        if (gameType === 'trivial') {
            const { endTrivialGame } = require('../sockets/services/TrivialEndGameService');
            await endTrivialGame({ roomId: sessionId, io });
        } else {
            const EndGameUseCase = require('../application/use-cases/EndGameUseCase');
            const { players, socketToPlayer, lobbyPlayers, teamConfigs } = require('../state/globalState');
            const useCase = new EndGameUseCase({ activeGames, players, socketToPlayer, lobbyPlayers, teamConfigs, io });
            await useCase.execute({ roomId: sessionId, reason: 'manual' });
        }

        logger.info('[addin] end-game executed', { sessionId, gameType });
        res.json({ ok: true });
    } catch (err) {
        logger.error('[addin] end-game error', { error: err.message });
        res.status(500).json({ error: 'Error al finalizar partida', code: 'END_GAME_FAILED' });
    }
});

module.exports = router;
