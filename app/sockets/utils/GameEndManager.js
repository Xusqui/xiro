/**
 * @fileoverview Game End Manager - Handles automatic game ending and cleanup
 * 
 * Refactorizado para usar EndGameUseCase (migrado desde EndGameCommand)
 */

const { roundScore } = require('../../services/game.logic');
const { calculateFinalRanking } = require('./RankingCalculator');
const EndGameUseCase = require('../../application/use-cases/EndGameUseCase');
const { teamConfigs } = require('../../state/globalState');
const { revealToUnrevealedTeams, addTeamScoresToPayload } = require('./TeamManager');
const { RedisSyncBus } = require('../sync/RedisSyncBus');
const EventBus = require('../../domain/events/EventBus');
const { TimeExpiredEvent, AnswerRevealedEvent } = require('../../domain/events/GameEvents');
const sessionStore = require('../../services/SessionStore');
const answerStatsStore = require('../../services/AnswerStatsStore');
const { getRedisClient } = require('../../config/redis');
const { logVoteDistribution } = require('./VoteDistributionLogger');
const logger = require('../../config/logger');
const { saveGameSession } = require('../../services/db/game-session.service');

const syncBus = RedisSyncBus.getInstance();

/**
 * Leer el hash canónico de scores desde Redis (game:scores:{roomId}).
 * Este hash se actualiza atómicamente vía HINCRBYFLOAT en ImprovedSubmitAnswerCommand
 * y es la fuente de verdad en clúster PM2, ya que cada worker solo conoce en memoria
 * los nicknames cuyas respuestas ha procesado.
 */
async function loadCanonicalScores(roomId) {
    try {
        const client = await getRedisClient();
        const raw = await client.hGetAll(`game:scores:${roomId}`);
        if (!raw || Object.keys(raw).length === 0) return null;
        const parsed = {};
        for (const [nick, val] of Object.entries(raw)) {
            const num = Number(val);
            if (!Number.isNaN(num)) parsed[nick] = roundScore(num);
        }
        return parsed;
    } catch (err) {
        logger.warn('loadCanonicalScores failed', { roomId, error: err.message });
        return null;
    }
}

function hasQuestionBeenRevealed(game, questionIndex) {
    return Boolean(game?.revealedQuestions?.[questionIndex]);
}

function markQuestionAsRevealed(game, questionIndex, trigger) {
    if (!game.revealedQuestions || typeof game.revealedQuestions !== 'object') {
        game.revealedQuestions = {};
    }

    game.revealedQuestions[questionIndex] = {
        trigger,
        revealedAt: Date.now()
    };
}

function loadRevealPrerequisites(roomId, revealIndex) {
    return Promise.allSettled([
        sessionStore.load(roomId),
        answerStatsStore.getStats(roomId, revealIndex),
        loadCanonicalScores(roomId)
    ]);
}

function resolveRevealBase(game, roomId, timeExpired) {
    if (!game) {
        logger.warn(`revealAnswer: No game found for ${roomId}`);
        return null;
    }

    const revealIndex = Number.isInteger(game.currentIndex) ? game.currentIndex : 0;
    const revealTrigger = timeExpired ? 'timeout' : 'all-answered';

    if (hasQuestionBeenRevealed(game, revealIndex)) {
        logger.debug(`revealAnswer: Pregunta ${revealIndex + 1} ya revelada en ${roomId} - ignorando (${revealTrigger})`);
        return null;
    }

    return { revealIndex, revealTrigger };
}

function resolveQuestionToReveal(game, roomId, revealIndex, revealTrigger) {
    if (game.ended) {
        logger.debug(`revealAnswer: Juego ${roomId} ya terminó - cancelando reveal`);
        return null;
    }

    const currentQuestion = game.questions[revealIndex];
    if (!currentQuestion) {
        logger.warn(`revealAnswer: No current question for ${roomId}`);
        return null;
    }

    if (hasQuestionBeenRevealed(game, revealIndex)) {
        logger.debug(`revealAnswer: Pregunta ${revealIndex + 1} ya revelada tras refresco en ${roomId} - ignorando (${revealTrigger})`);
        return null;
    }

    return currentQuestion;
}

function emitTimerExpiredIfNeeded(timeExpired, roomId, revealIndex, answeredCount, totalPlayers) {
    if (!timeExpired) {
        return;
    }

    EventBus.emit('timer.expired', new TimeExpiredEvent({
        gameId: roomId,
        questionIndex: revealIndex,
        answeredCount,
        totalPlayers
    }));
}

function emitBlockedAnswer(io, roomId, revealIndex, timeExpired) {
    io.to(roomId).emit('blocked-answer', {
        questionIndex: revealIndex,
        message: timeExpired ? 'Tiempo agotado' : 'Todos han respondido'
    });
}

function applySnapshotResult(game, snapshotResult) {
    if (snapshotResult.status !== 'fulfilled') {
        logger.warn('revealAnswer: No se pudo refrescar session snapshot', snapshotResult.reason?.message);
        return;
    }

    const sessionSnapshot = snapshotResult.value;
    if (sessionSnapshot?.scores) {
        game.scores = { ...(game.scores || {}), ...sessionSnapshot.scores };
    }
    if (sessionSnapshot?.answerStats) {
        game.answerStats = sessionSnapshot.answerStats;
    }
}

function applyCanonicalScoresResult(game, canonicalScoresResult) {
    if (canonicalScoresResult.status === 'fulfilled' && canonicalScoresResult.value) {
        game.scores = { ...(game.scores || {}), ...canonicalScoresResult.value };
        return;
    }

    if (canonicalScoresResult.status === 'rejected') {
        logger.warn('revealAnswer: No se pudo leer scores canónicos', canonicalScoresResult.reason?.message);
    }
}

function normalizeStats(rawStats) {
    if (!rawStats || typeof rawStats !== 'object') {
        return {};
    }

    const values = Object.values(rawStats);
    const isCountShape = values.every(value => typeof value === 'number');
    if (isCountShape) {
        return rawStats;
    }

    const counts = {};
    values.forEach((value) => {
        if (!value || typeof value !== 'object') {
            return;
        }
        const answerIndex = Number.isInteger(value.answerIndex)
            ? value.answerIndex
            : (Number.isInteger(value.index) ? value.index : null);
        if (answerIndex === null) {
            return;
        }
        counts[answerIndex] = (counts[answerIndex] || 0) + 1;
    });

    return counts;
}

function resolveStatsForReveal(game, revealIndex, statsResult) {
    let statsForQuestion = game.answerStats?.[revealIndex] || {};
    if (statsResult.status === 'fulfilled') {
        const redisStats = statsResult.value;
        if (redisStats && Object.keys(redisStats).length > 0) {
            statsForQuestion = redisStats;
        }
    } else {
        logger.warn('revealAnswer: No se pudo leer stats desde Redis', statsResult.reason?.message);
    }

    return normalizeStats(statsForQuestion);
}

function countAnsweredFromStats(stats) {
    return Object.values(stats).reduce((sum, count) => sum + (Number(count) || 0), 0);
}

function countActivePlayers(game) {
    return (game.players || []).filter(player => player !== 'HOST').length;
}

function setAnswerBlockingState(game, revealIndex, timeExpired) {
    const isLast = revealIndex >= game.questions.length - 1;
    const allowLateAnswers = isLast && timeExpired && !game.isTrivial;

    if (!isLast || game.isTrivial) {
        game.canAnswer = false;
    } else if (timeExpired) {
        logger.debug('Última pregunta - manteniendo canAnswer=true para respuestas tardías');
    }

    return allowLateAnswers;
}

function buildRankings(game) {
    const rankingNicknames = [...new Set([
        ...((game.players || []).filter(name => name && name !== 'HOST')),
        ...Object.keys(game.scores || {}).filter(name => name && name !== 'HOST')
    ])];

    return rankingNicknames
        .map(nickname => ({
            nickname,
            score: game.scores?.[nickname] || 0,
            team: null
        }))
        .sort((a, b) => b.score - a.score);
}

function getQuestionFlags(question) {
    return {
        isOrderQuestion: question.question_type === 'order',
        isMatchingQuestion: question.question_type === 'matching',
        isSurveyQuestion: question.question_type === 'survey',
        isWordScrambleQuestion: question.question_type === 'word_scramble',
        isMultipleChoiceQuestion: question.question_type === 'multiple_choice',
        isNumericQuestion: question.question_type === 'numeric_approximation'
    };
}

function resolveCorrectAnswerData(question, flags) {
    const hasSingleCorrectIndex = !flags.isOrderQuestion
        && !flags.isMatchingQuestion
        && !flags.isSurveyQuestion
        && !flags.isWordScrambleQuestion
        && !flags.isMultipleChoiceQuestion;

    const correctIndex = hasSingleCorrectIndex
        ? (question.options?.findIndex(option => option.isCorrect) ?? -1)
        : null;

    let correctAnswer = null;
    if (flags.isNumericQuestion) {
        correctAnswer = question.correct_answer ?? null;
    } else if (hasSingleCorrectIndex) {
        correctAnswer = question.options?.[correctIndex]?.id || null;
    }

    const correctIndicesMultiple = flags.isMultipleChoiceQuestion
        ? question.options
            ?.map((option, idx) => (option.isCorrect || option.is_correct) ? idx : null)
            .filter(idx => idx !== null)
        : null;

    if (!flags.isOrderQuestion && !flags.isMatchingQuestion) {
        logger.debug('Respuesta correcta:', {
            correctIndex: flags.isNumericQuestion ? null : correctIndex,
            correctAnswer,
            questionId: question.id
        });
    }

    return { correctIndex, correctAnswer, correctIndicesMultiple };
}

function buildSurveyPercentages(question, stats, isSurveyQuestion) {
    if (!isSurveyQuestion) {
        return null;
    }

    const optionCount = question.options?.length || 0;
    const totalVotes = Object.values(stats).reduce((sum, count) => sum + (Number(count) || 0), 0);

    return Array.from({ length: optionCount }).map((_, index) => {
        const count = Number(stats[index]) || 0;
        const rawPercentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
        const percentage = Math.round(rawPercentage * 10) / 10;
        return { count, percentage };
    });
}

function buildRankingFormatted(rankings) {
    return rankings.map(ranking => ({
        name: ranking.nickname,
        pts: ranking.score,
        team: ranking.team
    }));
}

function buildCorrectOrderPayload(currentQuestion) {
    const OrderAnswerService = require('../../domain/services/OrderAnswerService');
    const indices = OrderAnswerService.buildCorrectOrderIndices(currentQuestion.options || []);
    return indices.map(index => {
        const option = currentQuestion.options?.[index];
        return {
            id: option?.id || null,
            text: option?.text || option?.optionText || option?.option_text || '',
            justification: option?.justification || null
        };
    });
}

function buildCorrectMatchesPayload(currentQuestion) {
    return (currentQuestion.options || []).map(option => ({
        leftText: option.optionText || option.option_text || option.text || '',
        rightText: option.match_value || ''
    }));
}

function buildJustificationData(currentQuestion, flags, correctIndex) {
    const correctOption = (flags.isOrderQuestion || flags.isMatchingQuestion)
        ? null
        : currentQuestion.options?.[correctIndex];

    const orderJustification = flags.isOrderQuestion
        ? (currentQuestion.justification || currentQuestion.options?.find(option => option?.justification)?.justification || null)
        : null;

    const justificationText = flags.isOrderQuestion
        ? orderJustification
        : (correctOption?.justification || null);

    const correctOrder = flags.isOrderQuestion ? buildCorrectOrderPayload(currentQuestion) : null;
    const correctMatches = flags.isMatchingQuestion ? buildCorrectMatchesPayload(currentQuestion) : null;

    return {
        correctOption,
        justificationText,
        correctOrder,
        correctMatches
    };
}

function buildPresenterPayload(input) {
    const {
        correctIndex,
        correctOption,
        justificationText,
        stats,
        percentages,
        rankingFormatted,
        timeExpired,
        correctOrder,
        correctMatches,
        isSurveyQuestion
    } = input;

    return {
        correctIndex,
        correctAnswer: correctOption?.text || correctOption?.optionText || correctOption?.option_text || null,
        justification: justificationText,
        stats,
        percentages,
        ranking: rankingFormatted,
        timeExpired,
        correctOrder,
        correctMatches,
        isSurvey: isSurveyQuestion
    };
}

function applyQuestionTypeOverrides(presenterPayload, currentQuestion, flags, correctIndicesMultiple) {
    if (flags.isNumericQuestion) {
        presenterPayload.correctAnswer = currentQuestion.correct_answer;
        presenterPayload.maxPoints = currentQuestion.max_points;
        presenterPayload.toleranceMode = currentQuestion.tolerance_mode;
        presenterPayload.toleranceValue = currentQuestion.tolerance_value;
        presenterPayload.toleranceCap = currentQuestion.tolerance_cap;
        presenterPayload.correctIndex = null;
        presenterPayload.correctOrder = null;
        presenterPayload.correctMatches = null;
    }

    if (flags.isWordScrambleQuestion) {
        presenterPayload.correctWord = currentQuestion.correct_word || null;
        presenterPayload.correctIndex = null;
        presenterPayload.correctOrder = null;
        presenterPayload.correctMatches = null;
    }

    if (flags.isMultipleChoiceQuestion) {
        presenterPayload.correctIndices = correctIndicesMultiple;
        presenterPayload.correctIndex = null;
        presenterPayload.correctOrder = null;
        presenterPayload.correctMatches = null;
        presenterPayload.correctAnswer = null;
    }
}

async function revealToUnrevealedTeamsIfNeeded(input) {
    const { isTeamMode, game, teamConfigData, currentQuestion, io, roomId } = input;

    if (!isTeamMode) {
        return;
    }

    try {
        await revealToUnrevealedTeams(game, teamConfigData, currentQuestion, io, roomId);
    } catch (err) {
        logger.error('Error en revealToUnrevealedTeams:', err.message);
    }
}

function addTeamScoresIfNeeded(isTeamMode, presenterPayload, teamConfigData, scores) {
    if (!isTeamMode) {
        return;
    }

    try {
        addTeamScoresToPayload(presenterPayload, teamConfigData, scores || {});
    } catch (err) {
        logger.error('Error en addTeamScoresToPayload:', err.message);
    }
}

function emitRevealPayloads(io, roomId, game, revealIndex, presenterPayload) {
    // Authoritative trivial flag: the presenter relies on this to label the
    // "next" button ("Siguiente Ronda" vs "Ver Ránking"). window.isTrivialGame
    // can be stale after a presenter reload/reconnection, so stamp it here.
    presenterPayload.isTrivial = !!game.isTrivial;

    game.revealPayloads = game.revealPayloads || {};
    game.revealPayloads[revealIndex] = presenterPayload;

    io.to(roomId + ':presenter').emit('reveal-answer', presenterPayload);
    io.to(roomId + ':players').emit('reveal-answer', {
        correctAnswer: presenterPayload.correctAnswer ?? null,
        justification: presenterPayload.justification ?? null,
        correctOrder: presenterPayload.correctOrder ?? null
    });
}

function emitRankingUpdates(io, roomId, scores) {
    const rankingUpdate = Object.entries(scores || {})
        .map(([nickname, score]) => ({ nickname, score: roundScore(score) }))
        .sort((a, b) => b.score - a.score);

    io.to(roomId + ':presenter').emit('ranking-update', { ranking: rankingUpdate });
    io.to(roomId + ':players').emit('ranking-update', { ranking: rankingUpdate });
}

function transitionRevealStateMachine(roomId, game) {
    try {
        const { getOrCreateAdapter } = require('../../domain/state/GameStateAdapter');
        if (!game.questions || game.questions.length === 0) {
            logger.warn('No questions available for state machine, skipping transition');
            return;
        }

        const adapter = getOrCreateAdapter(roomId, game.questions, game.teamMode);
        if (adapter && adapter.getCurrentState() === 'questionActive') {
            adapter.timeUp();
            adapter.scoringComplete();
            logger.debug(`SM after reveal: ${adapter.getCurrentState()}`);
        }
    } catch (err) {
        logger.error('State machine error in revealAnswer (non-critical):', err.message);
    }
}

function mergeRedisPlayerAnswers(mergedAnswers, allEntries) {
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
                // Ignore parsing errors for individual answers
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
            mergeRedisPlayerAnswers(mergedAnswers, allEntries);
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

function buildAutoSaveParams({ roomId, game, ranking, gameStartTime, mergedPlayerAnswers, questionsSnapshot, dbSessionId }) {
    const playerCount = ranking.length || (Array.isArray(game.players) ? game.players.length : Object.keys(game.scores || {}).length);
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

async function triggerAutoSaveSession(roomId, game, ranking) {
    try {
        const questionsSnapshot = (game.questions || []).map(q => ({
            question_text: q.question_text || q.text || '',
            correct_answer: q.correct_answer || q.correct_word || '',
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

/**
 * Reveal answer for current question
 * Can be called when timer expires OR when all players have answered
 * 
 * @param {Object} params - Reveal parameters
 * @param {string} params.roomId - Room ID
 * @param {Object} params.game - Game state
 * @param {Object} params.io - Socket.IO instance
 * @param {boolean} params.timeExpired - True if called due to timer expiration, false if all players answered
 * @returns {Promise<void>}
 */
async function revealAnswer({ roomId, game, io, timeExpired = false }) {
    const base = resolveRevealBase(game, roomId, timeExpired);
    if (!base) {
        return;
    }

    const { revealIndex, revealTrigger } = base;

    const SessionSaveDebouncer = require('../../services/SessionSaveDebouncer');
    await SessionSaveDebouncer.flush(roomId);

    const [snapshotResult, statsResult, canonicalScoresResult] = await loadRevealPrerequisites(roomId, revealIndex);
    applySnapshotResult(game, snapshotResult);
    applyCanonicalScoresResult(game, canonicalScoresResult);

    const currentQuestion = resolveQuestionToReveal(game, roomId, revealIndex, revealTrigger);
    if (!currentQuestion) {
        return;
    }

    markQuestionAsRevealed(game, revealIndex, revealTrigger);

    logger.info(`Revelando respuesta para pregunta ${revealIndex + 1} en partida ${roomId}${timeExpired ? ' (tiempo agotado)' : ' (todos respondieron)'}`);

    const normalizedStats = resolveStatsForReveal(game, revealIndex, statsResult);
    const answeredCount = countAnsweredFromStats(normalizedStats);
    const totalPlayers = countActivePlayers(game);

    emitTimerExpiredIfNeeded(timeExpired, roomId, revealIndex, answeredCount, totalPlayers);

    // Si es la última pregunta, NO bloquear respuestas aún (dar tiempo extra)
    // EXCEPCIÓN: en trivial cada movimiento tiene sólo 1 pregunta (siempre "última"),
    // pero queremos cerrar respuestas inmediatamente tras el reveal para evitar que
    // jugadores que se reconecten puedan responder y puntuar tras la revelación.
    const allowLateAnswers = setAnswerBlockingState(game, revealIndex, timeExpired);

    emitBlockedAnswer(io, roomId, revealIndex, timeExpired);

    // Preparar rankings.
    // Unimos game.players (nicknames iniciales al start-game) con los nicknames
    // que aparecen en game.scores (pueden incluir jugadores que llegaron justo
    // antes del start-game pero no fueron detectados por fetchSockets, o
    // jugadores que se unieron mid-game). Así ninguno queda fuera del ranking.
    const rankings = buildRankings(game);
    const flags = getQuestionFlags(currentQuestion);
    const { correctIndex, correctIndicesMultiple } = resolveCorrectAnswerData(currentQuestion, flags);

    // Modo equipos: revelar a equipos no revelados
    const teamConfigData = teamConfigs.get(roomId);
    const isTeamMode = teamConfigData && teamConfigData.isTeamMode;
    await revealToUnrevealedTeamsIfNeeded({
        isTeamMode,
        game,
        teamConfigData,
        currentQuestion,
        io,
        roomId
    });

    // Convertir answerStats a formato de stats esperado por el cliente
    const stats = normalizedStats;
    const percentages = buildSurveyPercentages(currentQuestion, stats, flags.isSurveyQuestion);

    logVoteDistribution({
        roomId,
        questionIndex: revealIndex,
        question: currentQuestion,
        stats,
        trigger: timeExpired ? 'timeout' : 'all-answered'
    });

    // Emitir evento de dominio: respuesta revelada
    EventBus.emit('answer.revealed', new AnswerRevealedEvent({
        gameId: roomId,
        questionIndex: revealIndex,
        correctIndex,
        stats
    }));

    // Convertir rankings al formato esperado por el cliente
    const rankingFormatted = buildRankingFormatted(rankings);
    const { correctOption, justificationText, correctOrder, correctMatches } = buildJustificationData(
        currentQuestion,
        flags,
        correctIndex
    );

    const presenterPayload = buildPresenterPayload({
        correctIndex,
        correctOption,
        justificationText,
        stats,
        percentages,
        rankingFormatted,
        timeExpired,
        correctOrder,
        correctMatches,
        isSurveyQuestion: flags.isSurveyQuestion
    });

    applyQuestionTypeOverrides(presenterPayload, currentQuestion, flags, correctIndicesMultiple);
    addTeamScoresIfNeeded(isTeamMode, presenterPayload, teamConfigData, game.scores || {});

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

    // Disparar autoguardado asíncrono
    triggerAutoSaveSession(roomId, game, rankingFormatted).catch(err => {
        logger.error('Error no capturado en auto-save asíncrono:', err.message);
    });
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
