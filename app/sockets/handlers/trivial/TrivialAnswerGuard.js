/**
 * @fileoverview Trivial - Guardia de respuestas por ronda
 *
 * En trivial cada pregunta usa siempre currentIndex=0.
 * Sin este guardia, player.answers[0] de la ronda anterior hace que
 * el sistema detecte la respuesta como "duplicada" e ignore la nueva.
 *
 * Solución: epoch por ronda. game.trivialQuestionEpoch incrementa en cada
 * handleMove. socket.data.trivialAnswerEpoch se marca cuando el jugador
 * responde en la ronda actual. checkAllTrivialPlayersAnswered compara ambos.
 */
'use strict';

/**
 * Borra respuestas de la ronda anterior si el epoch ha avanzado.
 * Llamar ANTES del bloque de detección de duplicados en submit-answer.
 *
 * @param {Object|null} player - Entrada en el Map de players (puede ser null)
 * @param {Object} socket - Socket del jugador
 * @param {Object} game  - Entrada activa del juego (activeGames)
 */
function clearStaleAnswers(player, socket, game) {
    if (!game?.isTrivial) return;
    if (game.trivialQuestionEpoch === undefined) return;
    if (!player) return;

    // Si el epoch coincide → misma ronda → no borrar (idempotencia)
    if (player.trivialAnswerEpoch === game.trivialQuestionEpoch) return;

    const idx = game.currentIndex;

    // Borrar en el objeto player (Map local del worker)
    if (player.answers) delete player.answers[idx];
    if (player.answeredQuestions instanceof Set) {
        player.answeredQuestions.delete(idx);
    }

    // Borrar en socket.data (cross-worker compatible porque socket es local)
    if (socket?.data?.answers) delete socket.data.answers[idx];
    if (Array.isArray(socket?.data?.answeredQuestions)) {
        socket.data.answeredQuestions =
            socket.data.answeredQuestions.filter(i => i !== idx);
    }

    // Resetear epoch del socket para que no pase el check de checkAllTrivialPlayersAnswered
    if (socket?.data) {
        socket.data.trivialAnswerEpoch = null;
    }

    // Marcar que este player ya está sincronizado con el epoch actual (pero sin responder)
    player.trivialAnswerEpoch = game.trivialQuestionEpoch;
}

/**
 * Marca que el jugador ha respondido en la ronda actual (epoch actual).
 * Llamar DESPUÉS de grabar la respuesta del jugador.
 *
 * @param {Object} socket - Socket del jugador
 * @param {Object} game   - Entrada activa del juego
 */
function markAnsweredCurrentEpoch(socket, game) {
    if (!game?.isTrivial) return;
    if (socket?.data) {
        socket.data.trivialAnswerEpoch = game.trivialQuestionEpoch;
    }
}

/**
 * Comprueba si TODOS los jugadores activos han respondido en la ronda actual.
 *
 * Usa Redis Set `game:answered:{roomId}:{epoch}` (escrito por ImprovedSubmitAnswerCommand)
 * en lugar de socket.data.trivialAnswerEpoch — los sockets remotos de otros workers
 * NO exponen socket.data en Socket.IO Redis adapter, por lo que el check anterior
 * siempre daba false en configuraciones multi-worker. La clave incluye epoch para
 * evitar que respuestas tardías del epoch anterior contaminen el Set del epoch nuevo.
 *
 * @param {Object} game - Entrada activa del juego (activeGames)
 * @param {Object} io   - Socket.IO instance (mantenido por compatibilidad, fallback)
 * @returns {Promise<boolean>}
 */
async function checkAllTrivialPlayersAnswered(game, io) {
    if (!game?.isTrivial) return false;

    const roomId = game.roomId || game.sessionId || game.pin;
    const activePlayers = (game.players || []).filter(n => n !== 'HOST');

    if (activePlayers.length === 0) return false;

    const logger = require('../../../config/logger');

    let answeredSet = new Set();
    try {
        const { getRedisClient } = require('../../../config/redis');
        const redis = await getRedisClient();
        // Clave con epoch: evita que respuestas tardías del epoch anterior activen el trigger
        const epoch = game.trivialQuestionEpoch;
        const members = await redis.sMembers(`game:answered:${roomId}:${epoch}`);
        answeredSet = new Set(members);
    } catch (err) {
        // Fallback: socket.data epoch check (válido sólo en single-worker)
        logger.warn('checkAllTrivialPlayersAnswered: Redis fallback to socket.data', { roomId, error: err.message });
        const epoch = game.trivialQuestionEpoch;
        const allSockets = await io.in(roomId + ':players').fetchSockets();
        const answered = allSockets
            .filter(s => s.data?.trivialAnswerEpoch === epoch)
            .map(s => s.data?.nickname);
        answeredSet = new Set(answered);
    }

    const answeredNicks = [...answeredSet];
    const notAnswered = activePlayers.filter(n => !answeredSet.has(n));

    logger.debug('checkAllTrivialPlayersAnswered', {
        roomId, epoch: game.trivialQuestionEpoch, activePlayers,
        answeredNicks, notAnswered, allAnswered: notAnswered.length === 0
    });

    return notAnswered.length === 0;
}

module.exports = { clearStaleAnswers, markAnsweredCurrentEpoch, checkAllTrivialPlayersAnswered };
