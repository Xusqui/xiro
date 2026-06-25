/**
 * @fileoverview Game Session Service - Persiste resultados de partidas finalizadas
 * @module services/db/game-session.service
 *
 * Cada partida que termina (completed o abandoned) se guarda aquí.
 * Sirve de base para la exportación CSV y el futuro historial de partidas.
 */

const { pool } = require('../../config/database');
const logger = require('../../config/logger');
const { resolveSessionLogsForSave } = require('../game-logs.service');

function isMissingSessionLogsColumnError(error) {
    if (!error) return false;
    const message = String(error.message || '');
    return error.code === '42703' && /session_logs/i.test(message);
}

/**
 * Determina si una partida es de test (no debe contar como real).
 * Formatos de session ID: 6 dígitos numéricos, TRIVIA-NNNN (trivial),
 * o GAMENAME-NNNN (custom/mix). Para GAMENAME-NNNN, el PIN base (antes del
 * guion) debe existir en alguna tabla de juego real.
 * @param {string} pin
 * @returns {Promise<boolean>}
 */
async function detectIsTestSession(pin) {
    const pinStr = String(pin).toUpperCase();
    if (/^\d{6}$/.test(pinStr) || /^TRIVIA-\d+$/i.test(pinStr)) {
        return false;
    }
    const basePin = pinStr.split('-')[0];
    try {
        const lookup = await pool.query(
            `SELECT 1 FROM custom_games WHERE pin = $1
             UNION ALL SELECT 1 FROM games WHERE pin = $1
             UNION ALL SELECT 1 FROM question_banks WHERE pin = $1
             UNION ALL SELECT 1 FROM quizzes WHERE pin = $1
             UNION ALL SELECT 1 FROM trivial_games WHERE pin = $1
             LIMIT 1`,
            [basePin]
        );
        return lookup.rows.length === 0;
    } catch (_) {
        return true; // Unknown format → treat as test on DB error
    }
}

/**
 * Inserta o actualiza la fila de game_sessions, con fallback si la columna session_logs
 * no existe todavía (migración pendiente).
 * @param {Array} insertParams
 * @param {string} pin
 * @param {number} [dbId] - Si se proporciona, realiza un UPDATE en lugar de INSERT
 * @returns {Promise<Object>} resultado de pool.query
 */
async function persistGameSessionRow(insertParams, pin, dbId = null) {
    try {
        if (dbId) {
            // Es un update. insertParams tiene 12 elementos.
            // (pin, game_type, duration_ms, started_at, player_count, question_count, reason, final_ranking, questions_snapshot, player_answers, session_logs, is_test)
            return await pool.query(
                `UPDATE game_sessions
                 SET pin = $1, game_type = $2, duration_ms = $3, started_at = $4, player_count = $5, question_count = $6, reason = $7, final_ranking = $8, questions_snapshot = $9, player_answers = $10, session_logs = $11, is_test = $12
                 WHERE id = $13
                 RETURNING id`,
                [...insertParams, dbId]
            );
        }

        return await pool.query(
            `INSERT INTO game_sessions
                (pin, game_type, duration_ms, started_at, player_count, question_count, reason, final_ranking, questions_snapshot, player_answers, session_logs, is_test)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            insertParams
        );
    } catch (insertError) {
        if (!isMissingSessionLogsColumnError(insertError)) {
            throw insertError;
        }

        logger.warn('game_sessions.session_logs column missing; saving session without persisted logs', {
            pin,
            recommendation: 'Run pending migrations to enable session log persistence'
        });

        const fallbackParams = insertParams.slice(0, 10).concat(insertParams[11]); // quita session_logs

        if (dbId) {
            return pool.query(
                `UPDATE game_sessions
                 SET pin = $1, game_type = $2, duration_ms = $3, started_at = $4, player_count = $5, question_count = $6, reason = $7, final_ranking = $8, questions_snapshot = $9, player_answers = $10, is_test = $11
                 WHERE id = $12
                 RETURNING id`,
                [...fallbackParams, dbId]
            );
        }

        return pool.query(
            `INSERT INTO game_sessions
                (pin, game_type, duration_ms, started_at, player_count, question_count, reason, final_ranking, questions_snapshot, player_answers, is_test)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            fallbackParams
        );
    }
}

/**
 * Guarda o actualiza el resultado de una partida.
 * Llamado desde EndGameUseCase o procesos de autoguardado.
 * No lanza — los errores se loguean pero no interrumpen el flujo.
 *
 * @param {Object} params
 * @param {string}  params.pin
 * @param {string}  [params.sessionId]
 * @param {number}  [params.dbId]           - ID interno de postgres (para hacer UPDATE)
 * @param {string}  [params.gameType]
 * @param {number}  [params.durationMs]
 * @param {number}  [params.startedAt]      - epoch ms when the game started (Date.now() at start-game)
 * @param {number}  params.playerCount
 * @param {number}  params.questionCount
 * @param {string}  [params.reason='completed']
 * @param {Array}   params.finalRanking     - [{name, pts, ...}]
 * @param {Array}   params.questionsSnapshot - [{question_text, correct_answer, question_type}]
 * @returns {Promise<number|null>} ID insertado/actualizado, o null si falló
 */
async function saveGameSession({
    pin,
    sessionId,
    dbId,
    gameType,
    durationMs,
    startedAt,
    playerCount,
    questionCount,
    reason = 'completed',
    finalRanking,
    questionsSnapshot,
    playerAnswers = {},
    sessionLogs
}) {
    const isTest = await detectIsTestSession(pin);
    try {
        const persistedSessionLogs = await resolveSessionLogsForSave({
            sessionId: sessionId || String(pin).toUpperCase(),
            sessionLogs
        });
        const startedAtTs = startedAt ? new Date(startedAt).toISOString() : null;
        const insertParams = [
            String(pin).toUpperCase(),
            gameType || null,
            durationMs || null,
            startedAtTs,
            playerCount || 0,
            questionCount || 0,
            reason,
            JSON.stringify(finalRanking || []),
            JSON.stringify(questionsSnapshot || []),
            JSON.stringify(playerAnswers || {}),
            JSON.stringify(persistedSessionLogs || []),
            isTest
        ];

        const result = await persistGameSessionRow(insertParams, pin, dbId);

        const id = result.rows[0].id;
        logger.info('Game session saved', {
            id,
            pin,
            reason,
            playerCount,
            isTest,
            sessionLogCount: persistedSessionLogs.length
        });
        return id;
    } catch (error) {
        logger.error('Failed to save game session', { pin, error: error.message });
        return null;
    }
}

/**
 * Devuelve la sesión más reciente para un PIN dado.
 * @param {string} pin
 * @returns {Promise<Object|null>}
 */
async function getLastGameSessionByPin(pin) {
    try {
        const result = await pool.query(
            `SELECT * FROM game_sessions
             WHERE pin = $1
             ORDER BY played_at DESC
             LIMIT 1`,
            [String(pin).toUpperCase()]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to get game session', { pin, error: error.message });
        return null;
    }
}

/**
 * Devuelve una sesión por ID.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getGameSessionById(id) {
    try {
        const result = await pool.query(
            'SELECT * FROM game_sessions WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to get game session by id', { id, error: error.message });
        return null;
    }
}

/**
 * Lista las N sesiones más recientes (para futura vista de historial).
 * @param {number} [limit=50]
 * @param {boolean} [includeTests=false]
 * @returns {Promise<Array>}
 */
async function listRecentGameSessions(limit = 50, includeTests = false) {
    try {
        const result = await pool.query(
            `SELECT id, pin, share_token, game_type, played_at, started_at,
                    COALESCE(
                        CASE WHEN started_at IS NOT NULL
                             THEN EXTRACT(EPOCH FROM (played_at - started_at))::BIGINT * 1000
                        END,
                        duration_ms
                    ) AS duration_ms,
                    player_count, question_count, reason, is_test
             FROM game_sessions
             WHERE ($1 OR is_test = FALSE)
             ORDER BY played_at DESC
             LIMIT $2`,
            [includeTests, limit]
        );
        return result.rows;
    } catch (error) {
        logger.error('Failed to list game sessions', { error: error.message });
        return [];
    }
}

async function deleteAllGameSessions() {
    const result = await pool.query('DELETE FROM game_sessions');
    logger.info('All game sessions deleted', { count: result.rowCount });
    return result.rowCount;
}

async function deleteGameSessionById(id) {
    const result = await pool.query('DELETE FROM game_sessions WHERE id = $1', [id]);
    logger.info('Game session deleted', { id, found: result.rowCount > 0 });
    return result.rowCount > 0;
}

/**
 * Borra múltiples sesiones por array de IDs.
 * @param {number[]} ids
 * @returns {Promise<number>} número de filas borradas
 */
async function deleteGameSessionsByIds(ids) {
    if (!ids || ids.length === 0) return 0;
    const result = await pool.query(
        'DELETE FROM game_sessions WHERE id = ANY($1::int[])',
        [ids]
    );
    logger.info('Game sessions batch deleted', { count: result.rowCount, ids });
    return result.rowCount;
}

/**
 * Devuelve una sesión por share_token (UUID público).
 * @param {string} shareToken
 * @returns {Promise<Object|null>}
 */
async function getGameSessionByShareToken(shareToken) {
    try {
        const result = await pool.query(
            'SELECT * FROM game_sessions WHERE share_token = $1',
            [shareToken]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to get game session by share_token', { shareToken, error: error.message });
        return null;
    }
}

module.exports = {
    saveGameSession,
    getLastGameSessionByPin,
    getGameSessionById,
    getGameSessionByShareToken,
    listRecentGameSessions,
    deleteAllGameSessions,
    deleteGameSessionById,
    deleteGameSessionsByIds
};
