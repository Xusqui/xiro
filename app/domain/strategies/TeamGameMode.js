/**
 * @fileoverview Estrategia para modo equipos
 * Revelación coordinada por equipos, ranking por equipos, lógica de espera
 */

const GameModeStrategy = require('./GameModeStrategy');
const { roundScore } = require('../services/GameUtils');
const { getJustification, getCorrectAnswerText } = require('../services/ScoringService');
const logger = require('../../config/logger');

/**
 * Estrategia para modo de juego por equipos
 * - Revelación coordinada: esperar a que TODO el equipo responda
 * - Ranking por equipos (suma de puntos)
 * - Notificaciones de espera a equipos
 */
class TeamGameMode extends GameModeStrategy {
    /**
     * Procesa respuesta en modo equipos (revelación coordinada)
     */
    async processAnswer(params) {
        const { player, answer, game, io, teamConfigs, presenterNotification, checkTeamCompletedFn, checkAllTeamsCompletedFn, players } = params;
        const { nickname } = player;
        const roomId = game.roomId || game.sessionId;
        const teamConfig = teamConfigs.get(roomId);

        if (!teamConfig) {
            logger.warn('Team config not found for team mode', { roomId });
            // Fallback a comportamiento individual
            return this._processAsIndividual(params);
        }

        logger.debug('Processing answer in Team mode', {
            nickname,
            isCorrect: answer.isCorrect,
            points: answer.pointsEarned,
            team: this._findPlayerTeam(nickname, teamConfig)
        });

        // Notificar al presentador (batching automático)
        if (presenterNotification) {
            const playerTeam = this._findPlayerTeam(nickname, teamConfig);
            presenterNotification.notifyPlayerAnswered({
                roomId,
                nickname,
                isCorrect: answer.isCorrect,
                pointsEarned: answer.pointsEarned,
                totalScore: game.scores[nickname] || 0,
                questionIndex: game.currentIndex,
                answerIndex: answer.answerIndex || 0,
                teamName: playerTeam?.name,
                streakInfo: answer.streakInfo || null
            });
        }

        // Encontrar el equipo del jugador
        const playerTeam = this._findPlayerTeam(nickname, teamConfig);

        if (!playerTeam) {
            logger.warn('Player team not found', { nickname, roomId });
            return this._processAsIndividual(params);
        }

        // Verificar si el equipo del jugador completó (función inyectada por el caller)
        const teamCompleted = await checkTeamCompletedFn(playerTeam, game, io, roomId, players);

        // Verificar si TODOS los equipos completaron (para detener timer)
        const allCompleted = await checkAllTeamsCompletedFn(teamConfig, game, io, roomId, players);

        logger.debug('Team answer processing complete', {
            teamName: playerTeam.name,
            teamCompleted,
            allTeamsCompleted: allCompleted,
            roomId
        });

        // Devolver intenciones al caller; los efectos de socket se ejecutan en ImprovedSubmitAnswerCommand
        return {
            revealed: teamCompleted,
            waitingForTeams: !teamCompleted,
            allTeamsCompleted: allCompleted,
            teamToReveal: teamCompleted ? playerTeam : null,
            teamToNotifyWaiting: !teamCompleted ? playerTeam : null
        };
    }

    /**
     * En modo equipos: puede revelar si TODO el equipo respondió
     */
    canRevealResults(params) {
        const { player, game, teamConfig } = params;

        if (!teamConfig) return true; // Fallback

        const playerTeam = this._findPlayerTeam(player.nickname, teamConfig);
        if (!playerTeam) return true;

        // Verificar si todos los jugadores del equipo respondieron
        const teamPlayers = playerTeam.players;
        const allAnswered = teamPlayers.every(nick => {
            const playerData = game.players?.find(p => p.nickname === nick);
            return playerData?.answeredQuestions?.includes(game.currentIndex);
        });

        return allAnswered;
    }

    /**
     * Broadcast coordinado en modo equipos
     */
    broadcastResults({ roomId }) {

        logger.debug('Broadcasting results in Team mode', { roomId });

        // La revelación ya se hace en _revealToAllTeams
        // Este método existe por compatibilidad con la interfaz
    }

    /**
     * Calcula ranking por equipos (suma de puntos de todos los jugadores)
     */
    calculateFinalRanking(params) {
        const { game, teamConfig } = params;

        if (!teamConfig || !teamConfig.teams) {
            // Fallback a ranking individual
            return this._buildIndividualRanking(game.scores);
        }

        return this._buildTeamRanking(game.scores, teamConfig);
    }

    /**
     * Limpieza de recursos de modo equipos
     */
    cleanup(params) {
        const { roomId, teamConfigs } = params;

        // Eliminar configuración de equipos
        if (teamConfigs.has(roomId)) {
            teamConfigs.delete(roomId);
            logger.debug('Team config cleaned up', { roomId });
        }
    }

    /**
     * Snapshot de reconexión para modo equipos
     */
    buildReconnectionSnapshot(params) {
        const { game, player, teamConfig } = params;
        const { nickname } = player;

        const playerTeam = this._findPlayerTeam(nickname, teamConfig);

        return {
            mode: 'teams',
            score: roundScore(game.scores[nickname] || 0),
            ranking: this._buildTeamRanking(game.scores, teamConfig),
            teamMode: {
                isTeamMode: true,
                teams: teamConfig.teams,
                playerTeam: playerTeam?.name || null
            }
        };
    }

    /**
     * Helper: encontrar equipo de un jugador
     * @private
     */
    _findPlayerTeam(nickname, teamConfig) {
        if (!teamConfig || !teamConfig.teams) return null;
        return teamConfig.teams.find(team => team.players.includes(nickname));
    }

    /**
     * Helper: construir ranking por equipos
     * @private
     */
    _buildTeamRanking(scores, teamConfig) {
        const teamScores = {};

        // Sumar puntos de cada equipo
        for (const team of teamConfig.teams) {
            teamScores[team.name] = team.players.reduce((sum, nick) => {
                return sum + (scores[nick] || 0);
            }, 0);
        }

        // Ordenar por puntuación
        return Object.entries(teamScores)
            .map(([teamName, score]) => ({
                team: teamName,
                score: roundScore(score)
            }))
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Helper: ranking individual (fallback)
     * @private
     */
    _buildIndividualRanking(scores) {
        return Object.entries(scores)
            .map(([nickname, score]) => ({
                nickname,
                score: roundScore(score)
            }))
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Helper: procesar como individual (fallback)
     * @private
     */
    _processAsIndividual(params) {
        const { player, answer, game, question, io, ackManager, presenterNotification } = params;
        const { nickname, socketId } = player;
        const ranking = this._buildIndividualRanking(game.scores);
        const resultPayload = this._buildIndividualFallbackPayload({ answer, game, question, nickname, ranking });

        this._notifyPresenterFromFallback(presenterNotification, game, nickname, answer);
        this._emitFallbackResult(io, ackManager, socketId, nickname, resultPayload);

        return { revealed: true, payload: resultPayload };
    }

    _buildIndividualFallbackPayload({ answer, game, question, nickname, ranking }) {
        const options = Array.isArray(question.options) ? question.options : [];
        const isOrderQuestion = question.question_type === 'order';
        const correctOption = isOrderQuestion ? null : options.find(opt => opt.isCorrect);
        const selectedOption = isOrderQuestion ? null : options[answer.answerIndex];
        const justificationText = isOrderQuestion ? null : getJustification(selectedOption, correctOption);

        return {
            isCorrect: answer.isCorrect,
            correctAnswer: isOrderQuestion ? null : getCorrectAnswerText(question, correctOption),
            points: roundScore(answer.pointsEarned),
            totalScore: roundScore(game.scores[nickname] || 0),
            ranking,
            justification: justificationText,
            orderDetails: isOrderQuestion ? answer.orderDetails : null,
            matchingDetails: question.question_type === 'matching' ? answer.matchingDetails || null : null
        };
    }

    _notifyPresenterFromFallback(presenterNotification, game, nickname, answer) {
        if (!presenterNotification) {
            return;
        }

        const roomId = game.roomId || game.sessionId;
        presenterNotification.notifyPlayerAnswered({
            roomId,
            nickname,
            isCorrect: answer.isCorrect,
            pointsEarned: answer.pointsEarned,
            totalScore: game.scores[nickname] || 0,
            questionIndex: game.currentIndex,
            answerIndex: answer.answerIndex || 0,
            streakInfo: answer.streakInfo || null
        });
    }

    _emitFallbackResult(io, ackManager, socketId, nickname, resultPayload) {
        const socket = io.sockets.sockets.get(socketId);
        if (!socket) {
            return;
        }

        if (ackManager) {
            ackManager.emitWithAck(socket, 'answer-result', resultPayload).then(delivered => {
                if (!delivered) {
                    logger.error('Failed to deliver individual fallback answer-result', {
                        nickname,
                        socketId
                    });
                }
            });
            return;
        }

        io.to(socketId).emit('answer-result', resultPayload);
    }
}

module.exports = TeamGameMode;
