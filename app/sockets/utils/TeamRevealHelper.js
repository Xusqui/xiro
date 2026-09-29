/**
 * @fileoverview Helper para revelación de resultados por equipos
 * Maneja la lógica de revelar resultados cuando un equipo completa
 */

const { roundScore } = require('../../services/game.logic');
const { getJustification } = require('../../domain/services/ScoringService');
const logger = require('../../config/logger');
const { getRedisClient } = require('../../config/redis');
const {
    resolveTeamRevealCorrectness,
    resolveTeamRevealCorrectAnswer
} = require('./NumericTeamRevealHelper');

/**
 * Construir ranking formateado (inline para evitar dependencia circular)
 * @private
 */
function buildFormattedRanking(scores) {
    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(([nick, score], index) => ({
            position: index + 1,
            nickname: nick,
            score: roundScore(score),
            isTeam: false
        }));
}

/**
 * Trivial-aware helper: check if a specific player socket has answered the current round.
 * In Trivial, socket.data.answeredQuestions is stale (index 0 is reused every round),
 * so we use the epoch-based marker instead.
 * In non-Trivial games, the standard answeredQuestions check is used.
 *
 * @param {Object} playerSocket
 * @param {Object} game
 * @returns {boolean}
 */
function hasAnsweredCurrentRound(playerSocket, game) {
    if (game?.isTrivial && game.trivialQuestionEpoch !== undefined) {
        return playerSocket?.data?.trivialAnswerEpoch === game.trivialQuestionEpoch;
    }
    return playerSocket?.data?.answeredQuestions?.includes(game.currentIndex) ?? false;
}

/**
 * Verificar si un equipo específico ha completado la pregunta actual
 * @param {Object} team - Equipo a verificar
 * @param {Object} game - Estado del juego
 * @param {Object} io - Socket.IO instance
 * @param {string} roomId - ID de la sala
 * @returns {Promise<boolean>} true si todos los miembros respondieron
 */
async function checkTeamCompleted(team, game, io, roomId, players = null) {
    let completed;

    if (players && typeof players.values === 'function') {
        let answeredNicknames = [];
        try {
            const redis = await getRedisClient();
            const answeredKey = game?.isTrivial && game.trivialQuestionEpoch !== undefined
                ? `game:answered:${roomId}:${game.trivialQuestionEpoch}`
                : `game:answered:${roomId}`;
            answeredNicknames = await redis.sMembers(answeredKey) || [];
        } catch (err) {
            logger.warn('checkTeamCompleted: failed to fetch from Redis, using game.answeredCurrent', { roomId, error: err.message });
            answeredNicknames = game.answeredCurrent ? Array.from(game.answeredCurrent) : [];
        }

        const answeredSet = new Set(answeredNicknames);

        const connectedTeamPlayers = team.players.filter(nickname => {
            for (const player of players.values()) {
                if (player.nickname === nickname && player.roomId === roomId) {
                    return player.status !== 'disconnected' && player.status !== 'presenter_disconnected';
                }
            }
            return false;
        });

        const teamAnswersCount = connectedTeamPlayers.filter(nickname => answeredSet.has(nickname)).length;
        completed = connectedTeamPlayers.length > 0 ? (teamAnswersCount >= connectedTeamPlayers.length) : true;

        logger.debug(`Team completion check (fast path): ${team.name}`, {
            teamAnswered: teamAnswersCount,
            teamTotal: connectedTeamPlayers.length,
            completed
        });
    } else {
        const playersRoom = `${roomId}:players`;
        const allSockets = await io.in(playersRoom).fetchSockets();

        const teamAnswersCount = team.players.filter(playerNick => {
            const playerSocket = allSockets.find(s => s.data?.nickname === playerNick);
            return hasAnsweredCurrentRound(playerSocket, game);
        }).length;

        completed = teamAnswersCount === team.players.length;

        logger.debug(`Team completion check (fallback path): ${team.name}`, {
            teamAnswered: teamAnswersCount,
            teamTotal: team.players.length,
            completed
        });
    }

    return completed;
}

/**
 * Verificar si un equipo ya fue revelado en la pregunta actual
 * @param {Object} game - Estado del juego
 * @param {string} teamName - Nombre del equipo
 * @returns {boolean} true si ya fue revelado
 */
function isTeamRevealed(game, teamName) {
    if (!game.teamRevealed) {
        game.teamRevealed = {};
    }
    if (!game.teamRevealed[game.currentIndex]) {
        game.teamRevealed[game.currentIndex] = [];
    }
    return game.teamRevealed[game.currentIndex].includes(teamName);
}

/**
 * Marcar equipo como revelado
 * @param {Object} game - Estado del juego
 * @param {string} teamName - Nombre del equipo
 */
function markTeamAsRevealed(game, teamName) {
    if (!game.teamRevealed) {
        game.teamRevealed = {};
    }
    if (!game.teamRevealed[game.currentIndex]) {
        game.teamRevealed[game.currentIndex] = [];
    }
    if (!game.teamRevealed[game.currentIndex].includes(teamName)) {
        game.teamRevealed[game.currentIndex].push(teamName);
        logger.debug(`✅ Team marked as revealed: ${teamName}`, {
            questionIndex: game.currentIndex,
            revealedTeams: game.teamRevealed[game.currentIndex]
        });
    }
}

async function syncStreakInfosFromRedis(game, roomId) {
    try {
        const redis = await getRedisClient();
        const streakInfoKey = game?.isTrivial ? `trivial:streakinfos:${roomId}` : `game:streakinfos:${roomId}`;
        const redisInfos = await redis.hGetAll(streakInfoKey);

        if (!redisInfos || Object.keys(redisInfos).length === 0) {
            return;
        }

        if (!game.playerStreakInfos) {
            game.playerStreakInfos = {};
        }

        for (const [nick, jsonStr] of Object.entries(redisInfos)) {
            try {
                game.playerStreakInfos[nick] = JSON.parse(jsonStr);
            } catch (_) {
                // Ignore malformed streak payloads and keep flow alive.
            }
        }
    } catch (err) {
        logger.warn('revealToSingleTeam: could not load streakinfos from Redis', { roomId, error: err.message });
    }
}

function buildRevealContext(game, question) {
    const isOrderQuestion = question.question_type === 'order';
    const isSurvey = question.question_type === 'survey';

    return {
        isOrderQuestion,
        isSurvey,
        correctOption: isOrderQuestion ? null : question.options.find(opt => opt.isCorrect),
        ranking: buildFormattedRanking(game.scores)
    };
}

function findSocketByNickname(allSockets, nickname) {
    return allSockets.find(s => s.data?.nickname === nickname);
}

function shouldSkipPlayerReveal(playerSocket, game, playerNick) {
    if (playerSocket && hasAnsweredCurrentRound(playerSocket, game)) {
        return false;
    }

    logger.debug(`Player not answered, skipping reveal: ${playerNick}`);
    return true;
}

function buildPlayerRevealPayload({
    playerNick,
    game,
    question,
    playerAnswer,
    team,
    revealContext
}) {
    const playerPoints = playerAnswer?.pointsEarned || 0;
    const isCorrect = resolveTeamRevealCorrectness(question, playerAnswer);
    const selectedOption = playerAnswer && !revealContext.isOrderQuestion
        ? question.options[playerAnswer.index]
        : null;
    const justificationText = revealContext.isOrderQuestion
        ? null
        : getJustification(selectedOption, revealContext.correctOption);

    return {
        isCorrect,
        payload: {
            correct: revealContext.isSurvey ? null : isCorrect,
            correctAnswer: resolveTeamRevealCorrectAnswer(
                question,
                revealContext.correctOption,
                revealContext.isOrderQuestion,
                revealContext.isSurvey
            ),
            points: revealContext.isSurvey ? 0 : roundScore(playerPoints),
            totalScore: roundScore(game.scores[playerNick] || 0),
            ranking: revealContext.ranking,
            justification: justificationText,
            teamName: team.name,
            orderDetails: revealContext.isOrderQuestion ? playerAnswer?.orderDetails || null : null,
            multipleChoiceDetails: question.question_type === 'multiple_choice' ? playerAnswer?.multipleChoiceDetails || null : null,
            matchingDetails: question.question_type === 'matching' ? playerAnswer?.matchingDetails || null : null,
            streak: game.playerStreakInfos?.[playerNick] || null
        }
    };
}

function emitTeamPlayerResult(io, playerSocket, playerNick, payload, isCorrect) {
    logger.info('🔔 EMITTING answer-result to team player', {
        playerNick,
        socketId: playerSocket.id,
        payloadKeys: Object.keys(payload),
        hasMultipleChoiceDetails: !!payload.multipleChoiceDetails,
        points: payload.points
    });

    io.to(playerSocket.id).emit('answer-result', payload);

    logger.debug(`✅ Answer revealed to: ${playerNick}`, {
        isCorrect,
        points: payload.points
    });
}

function finalizeTeamReveal(game, team, revealedCount) {
    if (revealedCount > 0) {
        markTeamAsRevealed(game, team.name);
        return;
    }

    logger.warn(`⚠️ No players notified for team: ${team.name} - NOT marking as revealed`);
}

/**
 * Revelar resultados a todos los miembros de un equipo específico
 * @param {Object} params
 * @param {Object} params.team - Equipo a revelar
 * @param {Object} params.game - Estado del juego
 * @param {Object} params.question - Pregunta actual
 * @param {Object} params.io - Socket.IO instance
 * @param {string} params.roomId - ID de la sala
 * @returns {Promise<void>}
 */
function revealToSingleTeam({ team, game, question, io, roomId, players = null }) {
    if (isTeamRevealed(game, team.name)) {
        logger.debug(`Team already revealed, skipping: ${team.name}`);
        return Promise.resolve();
    }

    if (players && typeof players.values === 'function') {
        return revealTeamFastPath({ team, game, question, io, roomId, players });
    }
    return revealTeamFallbackPath({ team, game, question, io, roomId });
}

/**
 * Ruta rápida: lee respuestas crudas de Redis y emite usando el Map de players
 * en proceso (evita fetchSockets bajo carga alta).
 * @private
 */
async function revealTeamFastPath({ team, game, question, io, roomId, players }) {
    const slot = game.isTrivial ? (game.trivialQuestionEpoch || 0) : game.currentIndex;
    const rawSocketAnswers = {};

    try {
        const redis = await getRedisClient();
        const rawKey = `game:rawsocketanswers:${roomId}:${slot}`;
        const redisData = await redis.hGetAll(rawKey) || {};
        for (const [nick, jsonStr] of Object.entries(redisData)) {
            try {
                rawSocketAnswers[nick] = JSON.parse(jsonStr);
            } catch (_) {
                // Ignore parse errors for individual malformed entries
            }
        }
    } catch (err) {
        logger.warn('revealToSingleTeam: failed to load raw socket answers from Redis', { roomId, error: err.message });
    }

    const revealContext = buildRevealContext(game, question);
    await syncStreakInfosFromRedis(game, roomId);

    logger.info(`🔓 Revealing results to team (fast path): ${team.name}`, {
        teamPlayers: team.players.length,
        questionIndex: game.currentIndex
    });

    const playerObjectsByNick = new Map();
    for (const player of players.values()) {
        if (player.roomId === roomId) {
            playerObjectsByNick.set(player.nickname, player);
        }
    }

    let revealedCount = 0;

    for (const playerNick of team.players) {
        const playerObj = playerObjectsByNick.get(playerNick);

        if (!playerObj || !playerObj.socketId || playerObj.status === 'disconnected' || playerObj.status === 'presenter_disconnected') {
            logger.debug(`Player not connected, skipping reveal: ${playerNick}`);
            continue;
        }

        const playerAnswer = rawSocketAnswers[playerNick];
        if (!playerAnswer) {
            logger.debug(`Player not answered, skipping reveal: ${playerNick}`);
            continue;
        }

        const { payload } = buildPlayerRevealPayload({
            playerNick,
            game,
            question,
            playerAnswer,
            team,
            revealContext
        });

        logger.info('🔔 EMITTING answer-result to team player (fast path)', {
            playerNick,
            socketId: playerObj.socketId,
            payloadKeys: Object.keys(payload),
            hasMultipleChoiceDetails: !!payload.multipleChoiceDetails,
            points: payload.points
        });

        io.to(playerObj.socketId).emit('answer-result', payload);
        revealedCount++;
    }

    finalizeTeamReveal(game, team, revealedCount);

    logger.info(`✅ Team reveal completed (fast path): ${team.name}`, {
        playersRevealed: revealedCount,
        totalPlayers: team.players.length
    });
}

/**
 * Ruta de respaldo: usa fetchSockets() cuando no hay Map de players disponible.
 * @private
 */
async function revealTeamFallbackPath({ team, game, question, io, roomId }) {
    const playersRoom = `${roomId}:players`;
    const allSockets = await io.in(playersRoom).fetchSockets();
    const revealContext = buildRevealContext(game, question);

    await syncStreakInfosFromRedis(game, roomId);

    logger.info(`🔓 Revealing results to team (fallback path): ${team.name}`, {
        teamPlayers: team.players.length,
        questionIndex: game.currentIndex
    });

    let revealedCount = 0;

    for (const playerNick of team.players) {
        const playerSocket = findSocketByNickname(allSockets, playerNick);

        if (shouldSkipPlayerReveal(playerSocket, game, playerNick)) {
            continue;
        }

        const playerAnswer = playerSocket.data.answers?.[game.currentIndex];
        const { isCorrect, payload } = buildPlayerRevealPayload({
            playerNick,
            game,
            question,
            playerAnswer,
            team,
            revealContext
        });

        emitTeamPlayerResult(io, playerSocket, playerNick, payload, isCorrect);
        revealedCount++;
    }

    finalizeTeamReveal(game, team, revealedCount);

    logger.info(`✅ Team reveal completed (fallback path): ${team.name}`, {
        playersRevealed: revealedCount,
        totalPlayers: team.players.length
    });
}

module.exports = {
    hasAnsweredCurrentRound,
    checkTeamCompleted,
    isTeamRevealed,
    markTeamAsRevealed,
    revealToSingleTeam
};
