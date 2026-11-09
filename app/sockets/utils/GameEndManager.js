/**
 * @fileoverview Game End Manager - Handles automatic game ending and cleanup
 *
 * Refactorizado para usar EndGameUseCase (migrado desde EndGameCommand)
 */

const { calculateFinalRanking } = require('./RankingCalculator');
const EndGameUseCase = require('../../application/use-cases/EndGameUseCase');
const { teamConfigs } = require('../../state/globalState');
const { RedisSyncBus } = require('../sync/RedisSyncBus');
const { applyQuestionTypeOverrides } = require('./RevealTypePayloads');
const logger = require('../../config/logger');
const { buildRankings, buildRankingFormatted } = require('./RevealRanking');
const {
    revealToUnrevealedTeamsIfNeeded,
    addTeamScoresIfNeeded,
    emitRevealPayloads,
    emitRankingUpdates,
    transitionRevealStateMachine,
    announceRevealedStats
} = require('./RevealEmitters');
const { triggerAutoSaveSession } = require('./RevealAutoSave');
const {
    markQuestionAsRevealed,
    loadRevealPrerequisites,
    resolveRevealBase,
    resolveQuestionToReveal,
    emitTimerExpiredIfNeeded,
    emitBlockedAnswer,
    applySnapshotResult,
    applyCanonicalScoresResult,
    resolveStatsForReveal,
    countAnsweredFromStats,
    countActivePlayers,
    setAnswerBlockingState
} = require('./RevealStateHelpers');
const {
    getQuestionFlags,
    resolveCorrectAnswerData,
    buildSurveyPercentages,
    buildJustificationData,
    buildPresenterPayload
} = require('./RevealPresenterPayload');

const syncBus = RedisSyncBus.getInstance();

/**
 * Carga lo necesario para revelar y marca la pregunta como revelada.
 * @returns {Promise<{revealIndex: number, revealTrigger: string, question: Object, statsResult: *}|null>}
 *   null si ya estaba revelada, el juego terminó o no hay pregunta
 */
async function prepareReveal(game, roomId, timeExpired) {
    const base = resolveRevealBase(game, roomId, timeExpired);
    if (!base) {
        return null;
    }

    const { revealIndex, revealTrigger } = base;

    const SessionSaveDebouncer = require('../../services/SessionSaveDebouncer');
    await SessionSaveDebouncer.flush(roomId);

    const [snapshotResult, statsResult, canonicalScoresResult] = await loadRevealPrerequisites(roomId, revealIndex);
    applySnapshotResult(game, snapshotResult);
    applyCanonicalScoresResult(game, canonicalScoresResult);

    const question = resolveQuestionToReveal(game, roomId, revealIndex, revealTrigger);
    if (!question) {
        return null;
    }

    markQuestionAsRevealed(game, revealIndex, revealTrigger);
    return { revealIndex, revealTrigger, question, statsResult };
}

/**
 * Cierra las respuestas de la pregunta y avisa a los clientes.
 * @returns {{stats: Object, allowLateAnswers: boolean}}
 */
function closeAnswers({ io, roomId, game, revealIndex, timeExpired, statsResult }) {
    const stats = resolveStatsForReveal(game, revealIndex, statsResult);
    const answeredCount = countAnsweredFromStats(stats);
    const totalPlayers = countActivePlayers(game);

    emitTimerExpiredIfNeeded(timeExpired, roomId, revealIndex, answeredCount, totalPlayers);

    // Si es la última pregunta, NO bloquear respuestas aún (dar tiempo extra)
    // EXCEPCIÓN: en trivial cada movimiento tiene sólo 1 pregunta (siempre "última"),
    // pero queremos cerrar respuestas inmediatamente tras el reveal para evitar que
    // jugadores que se reconecten puedan responder y puntuar tras la revelación.
    const allowLateAnswers = setAnswerBlockingState(game, revealIndex, timeExpired);

    emitBlockedAnswer(io, roomId, revealIndex, timeExpired);
    return { stats, allowLateAnswers };
}

/**
 * Monta el payload del presentador (ranking, solución, estadísticas y extras por tipo de pregunta).
 * En modo equipos revela antes la pregunta a los equipos que aún no la veían.
 * @returns {Promise<{presenterPayload: Object, rankingFormatted: Array, correctIndex: *}>}
 */
async function buildRevealPayload({ io, roomId, game, revealIndex, question, stats, timeExpired }) {
    // Unimos game.players (nicknames iniciales al start-game) con los nicknames
    // que aparecen en game.scores (pueden incluir jugadores que llegaron justo
    // antes del start-game pero no fueron detectados por fetchSockets, o
    // jugadores que se unieron mid-game). Así ninguno queda fuera del ranking.
    const rankings = buildRankings(game);
    const flags = getQuestionFlags(question);
    const { correctIndex, correctIndicesMultiple } = resolveCorrectAnswerData(question, flags);

    const teamConfigData = teamConfigs.get(roomId);
    const isTeamMode = teamConfigData && teamConfigData.isTeamMode;
    await revealToUnrevealedTeamsIfNeeded({ isTeamMode, game, teamConfigData, currentQuestion: question, io, roomId });

    const percentages = buildSurveyPercentages(question, stats, flags.isSurveyQuestion);
    announceRevealedStats({ roomId, revealIndex, question, stats, correctIndex, timeExpired });

    const rankingFormatted = buildRankingFormatted(rankings);
    const justification = buildJustificationData(question, flags, correctIndex);
    const presenterPayload = buildPresenterPayload({
        correctIndex,
        correctOption: justification.correctOption,
        justificationText: justification.justificationText,
        stats,
        percentages,
        rankingFormatted,
        timeExpired,
        correctOrder: justification.correctOrder,
        correctMatches: justification.correctMatches,
        isSurveyQuestion: flags.isSurveyQuestion
    });

    await applyQuestionTypeOverrides({
        presenterPayload,
        question,
        flags,
        correctIndicesMultiple,
        roomId,
        revealIndex,
        game
    });
    addTeamScoresIfNeeded(isTeamMode, presenterPayload, teamConfigData, game.scores || {});
    return { presenterPayload, rankingFormatted, correctIndex };
}

/**
 * Emite el reveal a todos, sincroniza con los demás workers y lanza el autoguardado.
 */
async function broadcastReveal({ io, roomId, game, revealIndex, revealTrigger, allowLateAnswers, timeExpired, built }) {
    const { presenterPayload, rankingFormatted, correctIndex } = built;
    logger.debug('Emitiendo reveal-answer a presentador:', {
        presenterRoom: roomId + ':presenter',
        correctIndex,
        playersCount: rankingFormatted.length,
        reason: timeExpired ? 'timeout' : 'all-answered'
    });

    emitRevealPayloads(io, roomId, game, revealIndex, presenterPayload);
    emitRankingUpdates(io, roomId, game.scores || {});
    transitionRevealStateMachine(roomId, game);

    // Sincronizar con otros workers (incluir payload para presentadores que reconecten en otro worker)
    await syncBus.publishQuestionRevealed(roomId, revealIndex, {
        trigger: revealTrigger,
        allowLateAnswers,
        presenterPayload
    });

    logger.info(`Respuesta revelada para ${roomId} (${timeExpired ? 'timeout' : 'all answered'})`);

    triggerAutoSaveSession(roomId, game, rankingFormatted).catch(err => {
        logger.error('Error no capturado en auto-save asíncrono:', err.message);
    });
}

/**
 * Reveal answer for current question
 * Can be called when timer expires OR when all players have answered
 *
 * @param {Object} params - Reveal parameters
 * @param {string} params.roomId - Room ID
 * @param {Object} params.game - Game state
 * @param {Object} params.io - Socket.IO instance
 * @param {boolean} params.timeExpired - True if called due to timer expiration, false if all players answered
 * @returns {Promise<boolean|undefined>} true solo si esta llamada ha revelado la pregunta
 *   (no si ya estaba revelada, el juego terminó o no hay pregunta)
 */
async function revealAnswer({ roomId, game, io, timeExpired = false }) {
    const prepared = await prepareReveal(game, roomId, timeExpired);
    if (!prepared) {
        return;
    }

    const { revealIndex, revealTrigger, question, statsResult } = prepared;
    logger.info(
        `Revelando respuesta para pregunta ${revealIndex + 1} en partida ${roomId}${timeExpired ? ' (tiempo agotado)' : ' (todos respondieron)'}`
    );

    const { stats, allowLateAnswers } = closeAnswers({ io, roomId, game, revealIndex, timeExpired, statsResult });
    const built = await buildRevealPayload({ io, roomId, game, revealIndex, question, stats, timeExpired });
    await broadcastReveal({ io, roomId, game, revealIndex, revealTrigger, allowLateAnswers, timeExpired, built });
    return true;
}

/**
 * Check if game should end after current question
 * @param {Object} game - Game state
 * @returns {boolean} True if this was the last question
 */
function isLastQuestion(game) {
    if (!game || !game.questions) return false;
    return game.currentIndex >= game.questions.length - 1;
}

/**
 * End game automatically using EndGameUseCase
 * @param {Object} params - End game parameters
 * @returns {Promise<boolean>} Success status
 */
async function endGameAutomatically({
    game,
    roomId,
    io,
    teamConfigs,
    activeGames,
    players,
    socketToPlayer,
    lobbyPlayers,
    clearGameTimer
}) {
    if (!game) return false;

    logger.info(`Finalizando juego automáticamente: ${roomId}`);

    // Usar EndGameUseCase para finalizar
    const useCase = new EndGameUseCase({
        activeGames,
        teamConfigs,
        io,
        players,
        socketToPlayer,
        lobbyPlayers,
        clearGameTimer,
        syncBus
    });

    const result = await useCase.execute({
        roomId,
        reason: 'completed'
    });

    if (result.success) {
        logger.info(`Juego ${roomId} finalizado exitosamente`);
    } else {
        logger.error(`Error finalizando juego ${roomId}:`, result.error);
    }

    return result.success;
}

/**
 * Finaliza la partida automáticamente si la pregunta recién revelada era la
 * última, evitando que partidas (no-trivial) que terminan porque todos
 * respondieron queden colgadas en activeGames a la espera de un clic manual
 * del presentador en "Ver Ránking".
 * @param {Object} params
 * @param {Object} params.game - Estado de la partida
 * @param {string} params.roomId - ID de la sala
 * @param {Object} params.io - Instancia de Socket.IO
 * @returns {Promise<boolean>} true si se finalizó la partida
 */
function endGameIfLastQuestion({ game: _game, roomId: _roomId, io: _io } = {}) {
    // DESACTIVADO intencionalmente (Fix):
    // No finalizar la partida automáticamente tras revelar la última pregunta.
    // El presentador debe tener tiempo de ver los resultados de la última pregunta,
    // explicarlos y pulsar manualmente el botón "Ver Ránking" para desencadenar EndGameUseCase.
    return Promise.resolve(false);
}

module.exports = {
    revealAnswer,
    isLastQuestion,
    endGameAutomatically,
    endGameIfLastQuestion,
    calculateFinalRanking
};
