/**
 * @fileoverview Gestión de lógica de equipos (modo ciego)
 */

const { calculateTeamScore } = require('../../services/game.logic');
const { TEAMS } = require('../../config/game-constants');
const {
    resolveTeamRevealCorrectness,
    resolveTeamRevealCorrectAnswer
} = require('./NumericTeamRevealHelper');
const { hasAnsweredCurrentRound, claimTeamReveal } = require('./TeamRevealHelper');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

/**
 * Revelar resultados a equipos que no han sido revelados (timeout)
 */
async function revealToUnrevealedTeams(game, teamConfig, currentQuestion, io, sPin) {
    const teamsRevealed = game.teamRevealed && game.teamRevealed[game.currentIndex]
        ? game.teamRevealed[game.currentIndex]
        : [];

    logger.debug(`Timer expirado en modo equipos. Equipos ya revelados: ${teamsRevealed.join(', ')}`);

    // Cargar streakinfos desde Redis para garantizar datos frescos en modo multi-worker.
    // En team mode, diferentes equipos pueden completar en diferentes workers, por lo que
    // la información de racha en memoria puede estar desactualizada.
    try {
        const redis = await getRedisClient();
        const streakInfoKey = game?.isTrivial ? `trivial:streakinfos:${sPin}` : `game:streakinfos:${sPin}`;
        const redisInfos = await redis.hGetAll(streakInfoKey);
        if (redisInfos && Object.keys(redisInfos).length > 0) {
            if (!game.playerStreakInfos) game.playerStreakInfos = {};
            for (const [nick, jsonStr] of Object.entries(redisInfos)) {
                try { game.playerStreakInfos[nick] = JSON.parse(jsonStr); } catch (_) { /* ignore */ }
            }
        }
    } catch (err) {
        logger.warn('revealToUnrevealedTeams: could not load streakinfos from Redis', { roomId: sPin, error: err.message });
    }

    const playersRoom = `${sPin}:players`;
    const allSockets = await io.in(playersRoom).fetchSockets();

    for (const team of teamConfig.teams) {
        // El registro local no ve los equipos revelados en otros workers: se reclama en Redis
        if (await claimTeamReveal(game, sPin, team.name)) {
            logger.debug(`Revelando resultados al equipo ${team.name} por timeout`);

            for (const playerNick of team.players) {
                const playerSocket = allSockets.find(s => s.data?.nickname === playerNick);
                if (!playerSocket || !hasAnsweredCurrentRound(playerSocket, game)) {
                    continue;
                }

                const playerPayload = buildPlayerResultPayload({
                    currentQuestion,
                    playerAnswer: playerSocket.data.answers?.[game.currentIndex],
                    scores: game.scores,
                    game,
                    playerNick,
                    teamName: team.name
                });

                io.to(playerSocket.id).emit('answer-result', playerPayload);
            }
        }
    }
}

function resolveAnswerContext(currentQuestion, playerAnswer) {
    const isOrderQuestion = currentQuestion.question_type === 'order';
    const isSurveyQuestion = currentQuestion.question_type === 'survey';
    const isMultipleChoiceQuestion = currentQuestion.question_type === 'multiple_choice';
    const correctOption = isOrderQuestion ? null : currentQuestion.options.find(opt => opt.isCorrect);
    const playerOption = isOrderQuestion || isMultipleChoiceQuestion
        ? null
        : currentQuestion.options[playerAnswer?.index];

    return {
        isOrderQuestion,
        isSurveyQuestion,
        isMultipleChoiceQuestion,
        correctOption,
        playerOption
    };
}

function resolvePlayerJustification(ctx) {
    const { getJustification } = require('../../domain/services/ScoringService');
    if (ctx.isOrderQuestion) {
        return null;
    }

    if (ctx.isMultipleChoiceQuestion) {
        return getJustification(null, ctx.correctOption);
    }

    return ctx.playerOption?.justification || ctx.correctOption?.justification;
}

function buildNoAnswerPayload({ currentQuestion, scores, game, playerNick }) {
    const ctx = resolveAnswerContext(currentQuestion, null);
    return {
        correct: null,
        points: 0,
        correctAnswer: resolveTeamRevealCorrectAnswer(
            currentQuestion,
            ctx.correctOption,
            ctx.isOrderQuestion,
            ctx.isSurveyQuestion
        ),
        ranking: buildRanking(scores),
        streak: (game && playerNick) ? (game.playerStreakInfos?.[playerNick] || null) : null
    };
}

function appendOptionalPayloadFields(payload, context) {
    const { teamName, playerJustification } = context;
    if (teamName) {
        payload.teamName = teamName;
    }

    if (playerJustification) {
        payload.justification = playerJustification;
    }

    return payload;
}

function normalizePlayerPayloadInput(input, legacyArgs) {
    if (input && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, 'currentQuestion')) {
        return input;
    }

    return {
        currentQuestion: input,
        playerAnswer: legacyArgs[0],
        scores: legacyArgs[1],
        game: legacyArgs[2],
        playerNick: legacyArgs[3],
        teamName: legacyArgs[4] || null
    };
}

function buildAnsweredPayload({ currentQuestion, playerAnswer, scores, game, playerNick, teamName }) {
    const ctx = resolveAnswerContext(currentQuestion, playerAnswer);
    const isCorrect = resolveTeamRevealCorrectness(currentQuestion, playerAnswer);
    const playerPoints = playerAnswer.pointsEarned || 0;
    const playerJustification = resolvePlayerJustification(ctx);

    const payload = {
        correct: ctx.isSurveyQuestion ? null : isCorrect,
        points: ctx.isSurveyQuestion ? 0 : playerPoints,
        correctAnswer: resolveTeamRevealCorrectAnswer(
            currentQuestion,
            ctx.correctOption,
            ctx.isOrderQuestion,
            ctx.isSurveyQuestion
        ),
        ranking: buildRanking(scores),
        orderDetails: ctx.isOrderQuestion ? playerAnswer?.orderDetails || null : null,
        multipleChoiceDetails: ctx.isMultipleChoiceQuestion ? playerAnswer?.multipleChoiceDetails || null : null,
        matchingDetails: currentQuestion.question_type === 'matching' ? playerAnswer?.matchingDetails || null : null,
        streak: (game && playerNick) ? (game.playerStreakInfos?.[playerNick] || null) : null
    };

    return appendOptionalPayloadFields(payload, { teamName, playerJustification });
}

/**
 * Construir payload de resultado para jugador
 */
function buildPlayerResultPayload(input, ...legacyArgs) {
    const normalizedInput = normalizePlayerPayloadInput(input, legacyArgs);

    const {
        currentQuestion,
        playerAnswer,
        scores,
        game,
        playerNick,
        teamName = null
    } = normalizedInput;

    if (!playerAnswer) {
        return appendOptionalPayloadFields(
            buildNoAnswerPayload({ currentQuestion, scores, game, playerNick }),
            { teamName, playerJustification: null }
        );
    }

    return buildAnsweredPayload({
        currentQuestion,
        playerAnswer,
        scores,
        game,
        playerNick,
        teamName
    });
}

/**
 * Construir ranking formateado para answer-result
 * Consolida lógica duplicada en TeamRevealService y TeamManager
 */
function buildFormattedRanking(scores) {
    const { roundScore } = require('../../services/game.logic');

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
 * Construir ranking de jugadores a partir de las puntuaciones
 * @param {Object} scores - Objeto con scores {nickname: puntos}
 * @returns {Array} Ranking ordenado
 */
function buildRanking(scores) {
    return buildFormattedRanking(scores);
}

/**
 * Verificar si todos los equipos han completado sus respuestas
 */
async function checkAllTeamsCompleted(teamConfig, game, io, sPin, players = null) {
    if (players && typeof players.values === 'function') {
        let answeredNicknames = [];
        try {
            const redis = await getRedisClient();
            const answeredKey = game?.isTrivial && game.trivialQuestionEpoch !== undefined
                ? `game:answered:${sPin}:${game.trivialQuestionEpoch}`
                : `game:answered:${sPin}`;
            answeredNicknames = await redis.sMembers(answeredKey) || [];
        } catch (err) {
            logger.warn('checkAllTeamsCompleted: failed to fetch from Redis, using game.answeredCurrent', { roomId: sPin, error: err.message });
            answeredNicknames = game.answeredCurrent ? Array.from(game.answeredCurrent) : [];
        }

        const answeredSet = new Set(answeredNicknames);

        return teamConfig.teams.every(team => {
            const connectedTeamPlayers = team.players.filter(nickname => {
                for (const player of players.values()) {
                    if (player.nickname === nickname && player.roomId === sPin) {
                        return player.status !== 'disconnected' && player.status !== 'presenter_disconnected';
                    }
                }
                return false;
            });

            const teamAnswersCount = connectedTeamPlayers.filter(nickname => answeredSet.has(nickname)).length;
            return connectedTeamPlayers.length > 0 ? (teamAnswersCount >= connectedTeamPlayers.length) : true;
        });
    } else {
        const playersRoom = `${sPin}:players`;
        const allSockets = await io.in(playersRoom).fetchSockets();

        return teamConfig.teams.every(team => {
            const teamAnswersCount = team.players.filter(playerNick => {
                const playerSocket = allSockets.find(s => s.data?.nickname === playerNick);
                return hasAnsweredCurrentRound(playerSocket, game);
            }).length;
            return teamAnswersCount === team.players.length;
        });
    }
}

/**
 * Enviar estado de espera a miembros del equipo
 */
function notifyTeamWaiting(team, game, io, sPin, players = null) {
    if (players && typeof players.values === 'function') {
        return notifyTeamWaitingFastPath(team, game, io, sPin, players);
    }
    return notifyTeamWaitingFallback(team, game, io, sPin);
}

/**
 * Ruta rápida: usa el set de respondidos de Redis y el Map de players en proceso.
 * @private
 */
async function notifyTeamWaitingFastPath(team, game, io, sPin, players) {
    let answeredNicknames = [];
    try {
        const redis = await getRedisClient();
        const answeredKey = game?.isTrivial && game.trivialQuestionEpoch !== undefined
            ? `game:answered:${sPin}:${game.trivialQuestionEpoch}`
            : `game:answered:${sPin}`;
        answeredNicknames = await redis.sMembers(answeredKey) || [];
    } catch (err) {
        logger.warn('notifyTeamWaiting: failed to fetch from Redis, using game.answeredCurrent', { roomId: sPin, error: err.message });
        answeredNicknames = game.answeredCurrent ? Array.from(game.answeredCurrent) : [];
    }

    const answeredSet = new Set(answeredNicknames);

    const connectedTeamPlayers = [];
    const playerObjectsByNick = new Map();

    for (const player of players.values()) {
        if (player.roomId === sPin && team.players.includes(player.nickname)) {
            if (player.status !== 'disconnected' && player.status !== 'presenter_disconnected') {
                connectedTeamPlayers.push(player.nickname);
                playerObjectsByNick.set(player.nickname, player);
            }
        }
    }

    const teamAnswers = connectedTeamPlayers.filter(nickname => answeredSet.has(nickname));
    const connectedTeamLength = connectedTeamPlayers.length;

    logger.debug(`Equipo ${team.name} esperando (fast path): ${teamAnswers.length}/${connectedTeamLength}`);

    for (const teamMemberNick of team.players) {
        if (answeredSet.has(teamMemberNick)) {
            const playerObj = playerObjectsByNick.get(teamMemberNick);
            if (playerObj && playerObj.socketId) {
                io.to(playerObj.socketId).emit('answer-pending', {
                    answered: teamAnswers.length,
                    total: connectedTeamLength,
                    teamName: team.name
                });
                logger.debug(`Actualizado contador para ${teamMemberNick} (fast path): ${teamAnswers.length}/${connectedTeamLength}`);
            }
        }
    }
}

/**
 * Ruta de respaldo: usa fetchSockets() cuando no hay Map de players disponible.
 * @private
 */
async function notifyTeamWaitingFallback(team, game, io, sPin) {
    const playersRoom = `${sPin}:players`;
    const allSockets = await io.in(playersRoom).fetchSockets();

    const socketByNickname = new Map();
    for (const s of allSockets) {
        if (s.data?.nickname) {
            socketByNickname.set(s.data.nickname, s);
        }
    }

    const teamAnswers = team.players.filter(playerNick => {
        const playerSocket = socketByNickname.get(playerNick);
        return playerSocket && hasAnsweredCurrentRound(playerSocket, game);
    });

    const connectedTeamLength = team.players.filter(playerNick => socketByNickname.has(playerNick)).length;

    logger.debug(`Equipo ${team.name} esperando (fallback): ${teamAnswers.length}/${connectedTeamLength}`);

    for (const teamMemberNick of team.players) {
        const memberSocket = socketByNickname.get(teamMemberNick);
        if (memberSocket && hasAnsweredCurrentRound(memberSocket, game)) {
            io.to(memberSocket.id).emit('answer-pending', {
                answered: teamAnswers.length,
                total: connectedTeamLength,
                teamName: team.name
            });
            logger.debug(`Actualizado contador para ${teamMemberNick} (fallback): ${teamAnswers.length}/${connectedTeamLength}`);
        }
    }
}

/**
 * Agregar puntajes de equipo al payload del presentador
 */
function addTeamScoresToPayload(payload, teamConfig, scores = {}) {
    if (!teamConfig) return;

    const teams = teamConfig.teams || [];
    const allScores = Object.values(scores || {});
    const totalPoints = allScores.reduce((sum, pts) => sum + (Number(pts) || 0), 0);
    const totalPlayers = allScores.length;
    const globalMean = totalPlayers > 0 ? totalPoints / totalPlayers : 0;

    let effectiveLambda = 0;
    if (teams.length > 0) {
        const teamSizes = teams.map(team => team.players?.length || 0).filter(size => size > 0);
        if (teamSizes.length > 0) {
            const minSize = Math.min(...teamSizes);
            const maxSize = Math.max(...teamSizes);
            const sizeRatio = minSize > 0 ? maxSize / minSize : 1;
            effectiveLambda = sizeRatio === 1 ? 0 : TEAMS.SCORE_LAMBDA * (sizeRatio - 1);
        }
    }

    payload.teamScores = teams.map(team => ({
        name: team.name,
        score: calculateTeamScore(team, scores, globalMean, effectiveLambda),
        color: team.color
    }));
    logger.debug('Enviando puntajes de equipos al presentador:', payload.teamScores);
}

module.exports = {
    revealToUnrevealedTeams,
    buildPlayerResultPayload,
    buildRanking,
    buildFormattedRanking,
    checkAllTeamsCompleted,
    notifyTeamWaiting,
    addTeamScoresToPayload
};
