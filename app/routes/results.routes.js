/**
 * @fileoverview Results Routes - Exportación de resultados de partidas
 * @module routes/results.routes
 *
 * GET /api/results/:pin/export.csv  → CSV con ranking + preguntas de la última partida
 * GET /api/results/:pin/export.json → JSON equivalente (útil para depuración)
 *
 * Seguridad: el PIN actúa como token de acceso. XIRO! es una aplicación
 * auto-hospedada en red local (Synology NAS), por lo que el nivel de
 * protección es apropiado para el contexto de uso.
 */

const express = require('express');
const router = express.Router();
const { getLastGameSessionByPin, getGameSessionById, getGameSessionByShareToken, listRecentGameSessions, deleteAllGameSessions, deleteGameSessionById, deleteGameSessionsByIds } = require('../services/db/game-session.service');
const { authenticateAdmin, authorizeAdmin } = require('../middlewares/auth');
const { formatSessionLogsAsText } = require('../services/game-logs.service');
const logger = require('../config/logger');
const { buildCsv } = require('../services/results-csv.service');
const { buildFilename, buildLogsFilename, getSessionLogs } = require('../services/results-format');

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/results/history?limit=50&includeTests=true
 * Lista las últimas sesiones (sin player_answers para aligerar la respuesta).
 * Por defecto excluye partidas de test (is_test=true).
 */
router.get('/api/results/history', authenticateAdmin, authorizeAdmin, async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const includeTests = req.query.includeTests === 'true';
        const sessions = await listRecentGameSessions(limit, includeTests);
        // Omitir player_answers del listado (puede ser grande)
        const light = sessions.map(({ player_answers: _player_answers, questions_snapshot: _questions_snapshot, ...s }) => s);
        res.json(light);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/results/sessions/batch
 * Borra múltiples partidas por IDs. Solo accesible por admin.
 * Body: { ids: [1, 2, 3] }
 */
router.delete('/api/results/sessions/batch', authenticateAdmin, authorizeAdmin, async (req, res, next) => {
    try {
        const ids = req.body?.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de IDs', code: 'MISSING_IDS_ARRAY' });
        }
        const sanitized = ids.map(id => parseInt(id, 10)).filter(id => id > 0);
        if (sanitized.length === 0) return res.status(400).json({ error: 'IDs inválidos', code: 'INVALID_IDS' });
        const deleted = await deleteGameSessionsByIds(sanitized);
        logger.info('Game sessions batch deleted via admin', { deleted, admin: req.user?.role });
        res.json({ ok: true, deleted });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/results/history
 * Borra TODAS las partidas guardadas. Solo accesible por admin.
 */
router.delete('/api/results/history', authenticateAdmin, authorizeAdmin, async (req, res, next) => {
    try {
        const count = await deleteAllGameSessions();
        logger.info('Game history deleted via admin', { count, admin: req.user?.role });
        res.json({ ok: true, deleted: count });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/results/session/:id
 * Borra una partida concreta por ID. Solo accesible por admin.
 */
router.delete('/api/results/session/:id', authenticateAdmin, authorizeAdmin, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id || id <= 0) return res.status(400).json({ error: 'ID inválido', code: 'INVALID_ID' });
        const found = await deleteGameSessionById(id);
        if (!found) return res.status(404).json({ error: 'Sesión no encontrada', code: 'SESSION_NOT_FOUND' });
        logger.info('Game session deleted via admin', { id, admin: req.user?.role });
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// Exportación: búsqueda de la sesión (id, PIN o share_token) y envío del CSV.
// Cada buscador responde él mismo 400/404 y devuelve null en ese caso.
// ---------------------------------------------------------------------------

const SHARE_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseSessionId(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
        res.status(400).json({ error: 'ID de sesión inválido', code: 'INVALID_SESSION_ID' });
        return null;
    }
    return id;
}

async function findSessionById(id, res) {
    const session = await getGameSessionById(id);
    if (!session) {
        res.status(404).json({ error: `No hay sesión con ID ${id}`, code: 'SESSION_NOT_FOUND', params: { id } });
        return null;
    }
    return session;
}

function loadSessionById(req, res) {
    const id = parseSessionId(req, res);
    return id ? findSessionById(id, res) : Promise.resolve(null);
}

async function loadSessionByPin(req, res) {
    const pin = String(req.params.pin).toUpperCase().trim();
    if (!pin || pin.length < 3 || pin.length > 20) {
        res.status(400).json({ error: 'PIN inválido', code: 'PIN_INVALID' });
        return null;
    }
    const session = await getLastGameSessionByPin(pin);
    if (!session) {
        res.status(404).json({ error: `No hay resultados guardados para el PIN ${pin}`, code: 'NO_RESULTS_FOR_PIN', params: { pin } });
        return null;
    }
    return session;
}

async function loadSessionByShareToken(req, res) {
    const shareToken = req.params.shareToken;
    if (!SHARE_TOKEN_PATTERN.test(shareToken)) {
        res.status(400).json({ error: 'Token inválido', code: 'INVALID_SHARE_TOKEN' });
        return null;
    }
    const session = await getGameSessionByShareToken(shareToken);
    if (!session) {
        res.status(404).json({ error: 'Sesión no encontrada', code: 'SESSION_NOT_FOUND' });
        return null;
    }
    return session;
}

/** Envía el CSV con BOM UTF-8 para que Excel abra bien las tildes. */
function sendCsv(res, session) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${buildFilename(session.pin, session.played_at)}"`);
    res.send('\uFEFF' + buildCsv(session));
}

/**
 * Registra GET <base>/export.csv y GET <base>/export.json para un modo de búsqueda.
 * @param {string} base - Ruta sin el sufijo de exportación.
 * @param {Array} middlewares - Autenticación (vacío en las rutas públicas).
 * @param {Function} loadSession - Buscador que responde 400/404 por sí mismo.
 * @param {Function} [logExport] - Log tras exportar el CSV.
 */
function registerExportRoutes(base, middlewares, loadSession, logExport) {
    router.get(`${base}/export.csv`, ...middlewares, async (req, res, next) => {
        try {
            const session = await loadSession(req, res);
            if (!session) return;
            sendCsv(res, session);
            if (logExport) logExport(req, session);
        } catch (err) {
            next(err);
        }
    });

    router.get(`${base}/export.json`, ...middlewares, async (req, res, next) => {
        try {
            const session = await loadSession(req, res);
            if (session) res.json(session);
        } catch (err) {
            next(err);
        }
    });
}

registerExportRoutes('/api/results/session/:id', [authenticateAdmin, authorizeAdmin], loadSessionById,
    (req, session) => logger.info('Game session exported by id', { id: session.id, pin: session.pin }));

/**
 * GET /api/results/session/:id/export-logs?format=txt|json
 * Descarga los logs persistidos de una sesión concreta.
 */
router.get('/api/results/session/:id/export-logs', authenticateAdmin, authorizeAdmin, async (req, res, next) => {
    try {
        const id = parseSessionId(req, res);
        if (!id) return;

        const format = String(req.query.format || 'txt').toLowerCase();
        if (!['txt', 'json'].includes(format)) {
            return res.status(400).json({ error: 'Formato inválido. Usa txt o json', code: 'INVALID_LOG_FORMAT' });
        }

        const session = await findSessionById(id, res);
        if (!session) return;

        const sessionLogs = getSessionLogs(session);
        if (format === 'json') {
            const filename = buildLogsFilename(session.pin, session.played_at, 'json');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(JSON.stringify({
                id: session.id,
                pin: session.pin,
                game_type: session.game_type,
                played_at: session.played_at,
                reason: session.reason,
                events: sessionLogs
            }, null, 2));
            return;
        }

        const txt = formatSessionLogsAsText(session, sessionLogs);
        const filename = buildLogsFilename(session.pin, session.played_at, 'txt');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + txt);

        logger.info('Game session logs exported', {
            id,
            pin: session.pin,
            format,
            count: sessionLogs.length
        });
    } catch (err) {
        next(err);
    }
});

// El PIN actúa como token de acceso (ver cabecera del fichero)
registerExportRoutes('/api/results/:pin', [], loadSessionByPin,
    (req, session) => logger.info('Game session exported', { pin: session.pin, sessionId: session.id }));

// Rutas públicas compartidas (sin auth — acceso mediante share_token UUID no adivinable)
registerExportRoutes('/api/results/shared/:shareToken', [], loadSessionByShareToken);

module.exports = router;
