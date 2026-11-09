/**
 * @fileoverview Autoguardado de la sesión tras revelar una pregunta: fusiona las respuestas de Redis con
 * las de memoria y guarda la partida en la base de datos. Lo usa GameEndManager.revealAnswer.
 */

const { getRedisClient } = require('../../config/redis');
const FB = require('../../public/js/core/fill-blanks-text.js');
const { saveGameSession } = require('../../services/db/game-session.service');
const logger = require('../../config/logger');

function mergeRedisPlayerAnswers(mergedAnswers, allEntries, roomId) {
    for (const [field, val] of Object.entries(allEntries)) {
        const colonIdx = field.indexOf(':');
        const qIdx = Number(field.substring(0, colonIdx));
        const nick = field.substring(colonIdx + 1);

        if (!mergedAnswers[qIdx]) {
            mergedAnswers[qIdx] = {};
        }

        if (!mergedAnswers[qIdx][nick]) {
            try {
                mergedAnswers[qIdx][nick] = JSON.parse(val);
            } catch (err) {
                logger.debug('RevealAutoSave: respuesta malformada en Redis, se descarta', {
                    roomId,
                    field,
                    error: err.message
                });
            }
        }
    }
}

async function loadRedisAutoSaveData(roomId, mergedAnswers) {
    let redisStartTime = null;
    let redisDbSessionId = null;
    try {
        const rc = await getRedisClient();
        const allEntries = await rc.hGetAll(`game:playeranswers:${roomId}`);

        if (allEntries && Object.keys(allEntries).length > 0) {
            mergeRedisPlayerAnswers(mergedAnswers, allEntries, roomId);
        }

        const startTs = await rc.get(`game:started:${roomId}`);
        if (startTs) {
            redisStartTime = Number(startTs);
        }

        const SessionStore = require('../../services/SessionStore');
        const redisSession = await SessionStore.load(roomId);
        if (redisSession && redisSession.dbSessionId) {
            redisDbSessionId = redisSession.dbSessionId;
        }
    } catch (err) {
        // Ignore best-effort Redis lookup errors
        logger.debug('No se pudieron leer datos de Redis para autoguardado', { roomId, error: err.message });
    }
    return { redisStartTime, redisDbSessionId };
}

function buildAutoSaveParams({
    roomId,
    game,
    ranking,
    gameStartTime,
    mergedPlayerAnswers,
    questionsSnapshot,
    dbSessionId
}) {
    const playerCount =
        ranking.length || (Array.isArray(game.players) ? game.players.length : Object.keys(game.scores || {}).length);
    const durationMs = gameStartTime ? Date.now() - gameStartTime : null;

    return {
        pin: game.roomId || game.pin,
        sessionId: roomId,
        dbId: dbSessionId || null,
        gameType: game.gameType || null,
        startedAt: gameStartTime,
        durationMs,
        playerCount,
        questionCount: game.questions?.length || 0,
        reason: 'auto-saved',
        finalRanking: ranking,
        questionsSnapshot,
        playerAnswers: mergedPlayerAnswers
    };
}

/**
 * Guarda en la base de datos el estado de la sesión tras cada revelado (con las respuestas de Redis) y recuerda su id
 * en la partida. Los errores se registran y no se relanzan.
 * @param {string} roomId - ID de sesión
 * @param {Object} game - Partida activa (se le asigna dbSessionId)
 * @param {{name: string, pts: number}[]} ranking - Ranking actual
 * @returns {Promise<void>}
 */
async function triggerAutoSaveSession(roomId, game, ranking) {
    try {
        const questionsSnapshot = (game.questions || []).map(q => ({
            // Completa la frase: el informe muestra la frase con las palabras entre corchetes, no los marcadores
            question_text:
                q.question_type === 'fill_blanks'
                    ? FB.toEditorText(q.question_text || '', q.fb_words || FB.wordsFromOptions(q.options))
                    : q.question_text || q.text || '',
            correct_answer: q.correct_answer || q.correct_word || (q.ws_words || q.fb_words || []).join(', '),
            question_type: q.question_type || q.type || 'quiz'
        }));

        // Construir snapshot ligero de las respuestas
        const mergedPlayerAnswers = { ...(game.playerAnswers || {}) };
        const { redisStartTime, redisDbSessionId } = await loadRedisAutoSaveData(roomId, mergedPlayerAnswers);
        const gameStartTime = redisStartTime || game.gameStartTime || null;
        const currentDbSessionId = redisDbSessionId || game.dbSessionId || null;

        const saveParams = buildAutoSaveParams({
            roomId,
            game,
            ranking,
            gameStartTime,
            mergedPlayerAnswers,
            questionsSnapshot,
            dbSessionId: currentDbSessionId
        });

        const id = await saveGameSession(saveParams);

        if (id && !game.dbSessionId) {
            game.dbSessionId = id;
            // Forzar un guardado en Redis para no perder el dbSessionId si el servidor reinicia
            const SessionSaveDebouncer = require('../../services/SessionSaveDebouncer');
            SessionSaveDebouncer.save(roomId, game);
            logger.info('Partida auto-guardada por primera vez', { roomId, dbId: id });
        } else if (id) {
            game.dbSessionId = id;
            logger.debug('Partida auto-guardada actualizada', { roomId, dbId: id });
        }
    } catch (err) {
        logger.error('Error en triggerAutoSaveSession', { roomId, error: err.message });
    }
}

module.exports = { triggerAutoSaveSession };
