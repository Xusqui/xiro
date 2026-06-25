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

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

/**
 * Escapa un valor para CSV con separador ';'.
 * Si contiene punto y coma, doble comilla o salto de línea lo envuelve en comillas.
 */
function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/** Devuelve la fecha formateada como "DD/MM/YYYY HH:MM" en la zona local del servidor */
function formatDateTime(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "5m 32s" o "-" */
function formatDuration(ms) {
    if (!ms || ms < 0) return '-';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m ${sec}s`;
}

/** Nombre legible de tipo de juego */
function formatGameType(type) {
    const labels = {
        custom_game: 'Personalizado',
        bank: 'Banco de preguntas',
        game: 'Juego',
        quiz: 'Quiz',
        trivial: 'Trivial'
    };
    return labels[type] || (type || '-');
}

function appendMetadataLines(lines, session) {
    lines.push('XIRO! - Resultados de partida');
    lines.push(`PIN;${session.pin}`);
    lines.push(`Tipo;${formatGameType(session.game_type)}`);
    lines.push(`Fecha;${formatDateTime(session.played_at)}`);
    lines.push(`Duración;${formatDuration(session.duration_ms)}`);
    lines.push(`Jugadores;${session.player_count}`);
    lines.push(`Preguntas;${session.question_count}`);
    lines.push(`Resultado;${session.reason === 'completed' ? 'Completada' : 'Abandonada'}`);
    lines.push('');
}

function appendRankingLines(lines, session, ranking) {
    lines.push('RANKING FINAL');
    if (session.final_ranking[0]?.isTeam) {
        lines.push('Posición;Equipo;Puntuación');
    } else {
        lines.push('Posición;Jugador;Puntuación');
    }

    ranking.forEach((player, i) => {
        const score = player.scoreLabel || `${player.pts ?? player.score ?? 0}`;
        lines.push(`${i + 1};${escapeCsv(player.name)};${escapeCsv(score)}`);
    });
    lines.push('');
}

function resolveQuestionsContext(session) {
    const questions = session.questions_snapshot || [];
    const trivialMeta = questions?.isTrivialMeta ? questions : null;
    const questionsArray = trivialMeta ? [] : questions;
    return { trivialMeta, questionsArray };
}

function appendQuestionsLines(lines, questionsArray) {
    if (questionsArray.length === 0) {
        return;
    }

    lines.push('PREGUNTAS');
    lines.push('Nº;Tipo;Pregunta;Respuesta correcta');
    questionsArray.forEach((question, i) => {
        lines.push(
            `${i + 1};${escapeCsv(question.question_type)};${escapeCsv(question.question_text)};${escapeCsv(question.correct_answer)}`
        );
    });
    lines.push('');
}

function appendTrivialWedgesLines(lines, ranking, trivialMeta) {
    if (!trivialMeta) {
        return;
    }

    const label = ranking[0]?.isTeam ? 'Equipo' : 'Jugador';
    lines.push('CATEGORÍAS OBTENIDAS');
    lines.push(`${label};Categorías conseguidas;Total`);
    for (const entry of ranking) {
        const wedges = trivialMeta.playerWedges?.[entry.name] || [];
        lines.push(`${escapeCsv(entry.name)};${escapeCsv(wedges.join(', '))};${wedges.length}`);
    }
    lines.push('');
}

function buildDetailHeaders(lines, isTrivial) {
    lines.push('DETALLE POR PREGUNTA');
    if (isTrivial) {
        lines.push('Nº ronda;Categoría;Pregunta;Jugador;Respuesta dada;¿Correcto?;¡Cuña!;Puntos;Tiempo (ms)');
        return;
    }

    lines.push('Nº pregunta;Pregunta;Jugador;Respuesta dada;¿Correcto?;Puntos;Tiempo (ms)');
}

function buildQuestionLabel(qInfo, firstPlayerData, qIdx) {
    if (qInfo) {
        return escapeCsv(qInfo.question_text);
    }

    if (firstPlayerData?.questionText) {
        return escapeCsv(firstPlayerData.questionText);
    }

    return `Pregunta ${qIdx + 1}`;
}

function appendTrivialDetailLine(lines, payload) {
    const {
        qIdx,
        categoryName,
        questionText,
        nick,
        data,
        correct
    } = payload;

    const wedge = data.wedgeEarned ? escapeCsv(data.wedgeEarned) : '';
    lines.push(`${qIdx};${categoryName};${questionText};${escapeCsv(nick)};${escapeCsv(data.answer)};${correct};${wedge};${data.pointsEarned ?? 0};${data.responseTimeMs ?? ''}`);
}

function appendClassicDetailLine(lines, payload) {
    const { qIdx, questionText, nick, data, correct } = payload;
    lines.push(`${qIdx + 1};${questionText};${escapeCsv(nick)};${escapeCsv(data.answer)};${correct};${data.pointsEarned ?? 0};${data.responseTimeMs ?? ''}`);
}

function appendQuestionDetails(lines, session, questionsArray, trivialMeta) {
    const playerAnswers = session.player_answers || {};
    const questionIndices = Object.keys(playerAnswers).map(Number).sort((a, b) => a - b);
    const isTrivial = !!trivialMeta;

    if (questionIndices.length === 0) {
        return;
    }

    buildDetailHeaders(lines, isTrivial);

    for (const qIdx of questionIndices) {
        const qInfo = questionsArray[qIdx];
        const firstPlayerData = Object.values(playerAnswers[qIdx] || {})[0];
        const questionText = buildQuestionLabel(qInfo, firstPlayerData, qIdx);
        const playersAtQuestion = playerAnswers[qIdx] || {};
        const sorted = Object.entries(playersAtQuestion).sort((a, b) => (b[1].pointsEarned ?? 0) - (a[1].pointsEarned ?? 0));

        for (const [nick, data] of sorted) {
            const correct = data.isCorrect === null ? 'Encuesta' : data.isCorrect ? 'Sí' : 'No';
            if (isTrivial) {
                const categoryName = escapeCsv(data.categoryName || firstPlayerData?.categoryName || '');
                appendTrivialDetailLine(lines, {
                    qIdx,
                    categoryName,
                    questionText,
                    nick,
                    data,
                    correct
                });
            } else {
                appendClassicDetailLine(lines, { qIdx, questionText, nick, data, correct });
            }
        }
    }
}

/**
 * Construye el contenido CSV a partir de una fila de game_sessions.
 * Separador: punto y coma (compatible con Excel español/catalán).
 * BOM UTF-8 añadido por el llamador.
 */
function buildCsv(session) {
    const lines = [];
    const ranking = session.final_ranking || [];
    const { trivialMeta, questionsArray } = resolveQuestionsContext(session);

    appendMetadataLines(lines, session);
    appendRankingLines(lines, session, ranking);
    appendQuestionsLines(lines, questionsArray);
    appendTrivialWedgesLines(lines, ranking, trivialMeta);
    appendQuestionDetails(lines, session, questionsArray, trivialMeta);

    return lines.join('\r\n');
}

/** Nombre seguro para el archivo descargado */
function buildFilename(pin, playedAt) {
    const d = new Date(playedAt);
    const dateStr = d.toISOString().slice(0, 10); // "2026-03-19"
    return `xiro-${pin}-${dateStr}.csv`;
}

function buildLogsFilename(pin, playedAt, ext = 'txt') {
    const d = new Date(playedAt);
    const dateStr = d.toISOString().slice(0, 10);
    return `xiro-logs-${pin}-${dateStr}.${ext}`;
}

function getSessionLogs(session) {
    return Array.isArray(session?.session_logs) ? session.session_logs : [];
}

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

/**
 * GET /api/results/session/:id/export.csv
 * Devuelve una sesión concreta por ID como CSV descargable.
 */
router.get('/api/results/session/:id/export.csv', authenticateAdmin, authorizeAdmin, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id || id <= 0) {
            return res.status(400).json({ error: 'ID de sesión inválido', code: 'INVALID_SESSION_ID' });
        }
        const session = await getGameSessionById(id);
        if (!session) {
            return res.status(404).json({ error: `No hay sesión con ID ${id}`, code: 'SESSION_NOT_FOUND', params: { id } });
        }
        const csv = buildCsv(session);
        const filename = buildFilename(session.pin, session.played_at);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv);
        logger.info('Game session exported by id', { id, pin: session.pin });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/results/session/:id/export.json
 * Devuelve los datos crudos de la sesión por ID.
 */
router.get('/api/results/session/:id/export.json', authenticateAdmin, authorizeAdmin, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id || id <= 0) {
            return res.status(400).json({ error: 'ID de sesión inválido', code: 'INVALID_SESSION_ID' });
        }
        const session = await getGameSessionById(id);
        if (!session) {
            return res.status(404).json({ error: `No hay sesión con ID ${id}`, code: 'SESSION_NOT_FOUND', params: { id } });
        }
        res.json(session);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/results/session/:id/export-logs?format=txt|json
 * Descarga los logs persistidos de una sesión concreta.
 */
router.get('/api/results/session/:id/export-logs', authenticateAdmin, authorizeAdmin, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id || id <= 0) {
            return res.status(400).json({ error: 'ID de sesión inválido', code: 'INVALID_SESSION_ID' });
        }

        const format = String(req.query.format || 'txt').toLowerCase();
        if (!['txt', 'json'].includes(format)) {
            return res.status(400).json({ error: 'Formato inválido. Usa txt o json', code: 'INVALID_LOG_FORMAT' });
        }

        const session = await getGameSessionById(id);
        if (!session) {
            return res.status(404).json({ error: `No hay sesión con ID ${id}`, code: 'SESSION_NOT_FOUND', params: { id } });
        }

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

/**
 * GET /api/results/:pin/export.csv
 * Devuelve la última sesión del PIN como CSV descargable.
 */
router.get('/api/results/:pin/export.csv', async (req, res, next) => {
    try {
        const pin = String(req.params.pin).toUpperCase().trim();

        if (!pin || pin.length < 3 || pin.length > 20) {
            return res.status(400).json({ error: 'PIN inválido', code: 'PIN_INVALID' });
        }

        const session = await getLastGameSessionByPin(pin);

        if (!session) {
            return res.status(404).json({ error: `No hay resultados guardados para el PIN ${pin}`, code: 'NO_RESULTS_FOR_PIN', params: { pin } });
        }

        const csv = buildCsv(session);
        const filename = buildFilename(session.pin, session.played_at);

        // BOM UTF-8 para que Excel abra el CSV con tildes correctamente
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv);

        logger.info('Game session exported', { pin, sessionId: session.id });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/results/:pin/export.json
 * Devuelve los datos crudos de la sesión como JSON (útil para depuración o integraciones).
 */
router.get('/api/results/:pin/export.json', async (req, res, next) => {
    try {
        const pin = String(req.params.pin).toUpperCase().trim();

        if (!pin || pin.length < 3 || pin.length > 20) {
            return res.status(400).json({ error: 'PIN inválido', code: 'PIN_INVALID' });
        }

        const session = await getLastGameSessionByPin(pin);

        if (!session) {
            return res.status(404).json({ error: `No hay resultados guardados para el PIN ${pin}`, code: 'NO_RESULTS_FOR_PIN', params: { pin } });
        }

        res.json(session);
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// Public shared routes (no auth — accessed via non-guessable share_token)
// ---------------------------------------------------------------------------

/**
 * GET /api/results/shared/:shareToken/export.json
 * Public endpoint: returns session data by share_token UUID.
 */
router.get('/api/results/shared/:shareToken/export.json', async (req, res, next) => {
    try {
        const shareToken = req.params.shareToken;
        // Validate UUID v4 format
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shareToken)) {
            return res.status(400).json({ error: 'Token inválido', code: 'INVALID_SHARE_TOKEN' });
        }
        const session = await getGameSessionByShareToken(shareToken);
        if (!session) {
            return res.status(404).json({ error: 'Sesión no encontrada', code: 'SESSION_NOT_FOUND' });
        }
        res.json(session);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/results/shared/:shareToken/export.csv
 * Public endpoint: returns session CSV by share_token UUID.
 */
router.get('/api/results/shared/:shareToken/export.csv', async (req, res, next) => {
    try {
        const shareToken = req.params.shareToken;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shareToken)) {
            return res.status(400).json({ error: 'Token inválido', code: 'INVALID_SHARE_TOKEN' });
        }
        const session = await getGameSessionByShareToken(shareToken);
        if (!session) {
            return res.status(404).json({ error: 'Sesión no encontrada', code: 'SESSION_NOT_FOUND' });
        }
        const csv = buildCsv(session);
        const filename = buildFilename(session.pin, session.played_at);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
