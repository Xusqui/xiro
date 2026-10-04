/**
 * @fileoverview Comando mejorado para iniciar un juego
 * @module application/commands/ImprovedStartGameCommand
 * 
 * Encapsula toda la lógica de inicio de juego:
 * - Validación de PIN
 * - Carga de preguntas
 * - Preparación de estado
 * - Emisión de eventos
 */

const Command = require('./Command');
const EventBus = require('../../domain/events/EventBus');
const { GameStartedEvent } = require('../../domain/events/GameEvents');
const dbService = require('../../services/db.service');
const { getStreakConfig } = require('../../services/db/streak-config.service');
const { getRandomPointsConfig } = require('../../services/db/random-points-config.service');
const { assignRandomPointsForCurrentQuestion } = require('../../sockets/utils/QuestionTransitionManager');
const { prepareQuestions } = require('../../sockets/utils/QuestionPreparation');
const { getPlayersInRoom, transitionPlayersToConnected } = require('../../sockets/utils/GameUtils');
const { initializeExpectedPlayers } = require('../../sockets/utils/AtomicAnswerCounter');
const { getOrCreateAdapter } = require('../../domain/state/GameStateAdapter');
const sessionStore = require('../../services/SessionStore');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

class ImprovedStartGameCommand extends Command {
    /**
     * @param {Object} payload
     * @param {string} payload.roomId - ID de la sala (formato: PIN-XXXX)
     * @param {Object} payload.io - Socket.IO instance
     */
    constructor(payload) {
        super(payload);
    }

    validate() {
        const errors = [];
        const { roomId, io } = this.payload;

        if (!roomId || typeof roomId !== 'string') {
            errors.push('roomId is required');
        }
        if (!io) {
            errors.push('io instance is required');
        }

        return { valid: errors.length === 0, errors };
    }

    async _resolvePlayersInLobby(roomId, io, lobbyPlayers) {
        // En clúster PM2, fetchSockets() (cross-worker vía Redis adapter)
        // puede no devolver todos los sockets remotos por latencia o saturación.
        // Se prioriza lobbyPlayers (pubsub) y se hace merge con sockets vivos.
        const lobbySnapshot = Array.isArray(lobbyPlayers.get(roomId))
            ? lobbyPlayers.get(roomId).slice()
            : [];
        const socketSnapshot = await getPlayersInRoom(roomId, io);

        const playersInLobby = [...new Set([
            ...lobbySnapshot,
            ...socketSnapshot
        ])].filter(n => typeof n === 'string' && n.trim().length > 0 && n !== 'HOST');

        logger.info('Start-game player set resolved', {
            roomId,
            lobbyCount: lobbySnapshot.length,
            socketCount: socketSnapshot.length,
            mergedCount: playersInLobby.length
        });

        return playersInLobby;
    }

    _buildGameState({ pin, roomId, customGame, preparedQuestions, playersInLobby, streakConfig, randomPointsConfig }) {
        const now = Date.now();

        const gameState = {
            pin,
            roomId,
            gameType: customGame.type || null,
            questions: preparedQuestions,
            currentIndex: 0,
            scores: {},
            players: playersInLobby,
            answerStats: {},
            canAnswer: true,
            startTime: now,
            gameStartTime: now,
            questionStartTime: now,
            playerAnswers: {},
            teamRevealed: {},
            answeredCurrent: new Set(),
            ...streakConfig,
            ...randomPointsConfig,
            currentRandomPoints: null,
        };

        // La primera pregunta no pasa por AdvanceQuestionUseCase: se sortea aquí
        assignRandomPointsForCurrentQuestion(gameState, roomId);

        playersInLobby.forEach(nickname => {
            if (nickname !== 'HOST') {
                gameState.scores[nickname] = 0;
            }
        });

        return gameState;
    }

    _persistStartTimestamps(roomId, questionStartTime) {
        Promise.resolve(getRedisClient())
            .then(rc => Promise.all([
                rc.set(`game:started:${roomId}`, String(Date.now()), { EX: 86400 }),
                rc.set(`game:questionstart:${roomId}`, String(questionStartTime), { EX: 7200 })
            ]))
            .catch(() => { });
    }

    async _initializeExpectedCounters(roomId, io, playersInLobby) {
        try {
            await initializeExpectedPlayers({ roomId, io, nicknames: playersInLobby });
        } catch (counterErr) {
            logger.warn('Failed to initialize expected answer counters', {
                roomId,
                error: counterErr.message
            });
        }
    }

    _startStateMachine(roomId, preparedQuestions) {
        try {
            const adapter = getOrCreateAdapter(roomId, preparedQuestions, false);
            adapter.startGame();
            const validation = adapter.validateSync();
            if (!validation.valid) {
                logger.warn('State validation after START:', { errors: validation.errors });
            }
        } catch (err) {
            logger.error('State machine error (non-blocking):', { error: err.message });
        }
    }

    _emitGameStarted(roomId, pin, preparedQuestions, playersInLobby) {
        EventBus.emit('game.started', new GameStartedEvent({
            gameId: roomId,
            pin,
            mode: 'individual',
            questionCount: preparedQuestions.length,
            playerCount: playersInLobby.length
        }));
    }

    _findEmptyTeam(roomId, teamConfigs) {
        const teamConfig = teamConfigs?.get(roomId);
        if (!teamConfig || !teamConfig.isTeamMode || !Array.isArray(teamConfig.teams)) {
            return null;
        }

        return teamConfig.teams.find(team => !Array.isArray(team.players) || team.players.length === 0) || null;
    }

    async execute({ activeGames, lobbyPlayers, teamConfigs, metrics, syncBus }) {
        const validation = this.validate();
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', ')
            };
        }

        const { roomId, io } = this.payload;

        // Extraer PIN del roomId (formato: "PIN-XXXX")
        const pin = roomId.split('-')[0];

        try {
            const customGame = await dbService.validatePinInDatabase(pin);
            if (!customGame.valid) {
                return { success: false, error: 'PIN no válido', code: 'PIN_INVALID' };
            }

            if (activeGames.has(roomId)) {
                return { success: false, error: 'El juego ya está activo', code: 'GAME_ALREADY_ACTIVE' };
            }

            const playersInLobby = await this._resolvePlayersInLobby(roomId, io, lobbyPlayers);

            if (playersInLobby.length === 0) {
                return { success: false, error: 'No hay jugadores en el lobby', code: 'NO_PLAYERS_IN_LOBBY' };
            }

            const emptyTeam = this._findEmptyTeam(roomId, teamConfigs);
            if (emptyTeam) {
                return {
                    success: false,
                    error: `El equipo "${emptyTeam.name}" no tiene jugadores`,
                    code: 'TEAM_WITHOUT_PLAYERS',
                    // Dato aparte para que el presentador traduzca el mensaje
                    params: { teamName: emptyTeam.name }
                };
            }

            const questions = await this._loadQuestions(customGame);
            if (!questions || questions.length === 0) {
                return { success: false, error: 'No hay preguntas disponibles', code: 'NO_QUESTIONS_AVAILABLE' };
            }

            const preparedQuestions = prepareQuestions(questions, customGame.type);
            const streakConfig = await getStreakConfig(customGame.type, customGame.id);
            const randomPointsConfig = await getRandomPointsConfig(customGame.type, customGame.id);
            const gameState = this._buildGameState({
                pin,
                roomId,
                customGame,
                preparedQuestions,
                playersInLobby,
                streakConfig,
                randomPointsConfig
            });

            activeGames.set(roomId, gameState);

            this._persistStartTimestamps(roomId, gameState.questionStartTime);
            lobbyPlayers.delete(roomId);
            metrics.incrementGames();
            await sessionStore.save(roomId, gameState);

            await this._initializeExpectedCounters(roomId, io, playersInLobby);
            transitionPlayersToConnected(roomId);

            this._startStateMachine(roomId, preparedQuestions);
            this._emitGameStarted(roomId, pin, preparedQuestions, playersInLobby);

            if (syncBus) {
                await syncBus.publishGameStarted(roomId, gameState);
            }

            return {
                success: true,
                gameState,
                preparedQuestions,
                playersInLobby
            };

        } catch (error) {
            logger.error('Error en ImprovedStartGameCommand', { error: error.message, stack: error.stack });
            return {
                success: false,
                error: error.message || 'Error al iniciar el juego'
            };
        }
    }

    /**
     * Carga preguntas según el tipo de juego
     * @private
     */
    async _loadQuestions(customGame) {
        const { type, id } = customGame;

        switch (type) {
            case 'custom_game':
                return await dbService.getCustomGameQuestionsForPlay(id);
            case 'bank':
                return await dbService.getBankQuestions(id);
            case 'game':
                return await dbService.getGameQuestions(id);
            case 'quiz':
                return await dbService.getQuizQuestions(id);
            case 'trivial':
                // Los juegos trivial tienen su propio flujo (trivial-start socket).
                // Si llega aquí es que el presentador emitió start-game en lugar de trivial-start.
                logger.error('Tipo de juego desconocido', { type });
                throw new Error('Este juego es de tipo Trivial. Recarga la página y vuelve a intentarlo.');
            default:
                logger.error('Tipo de juego desconocido', { type });
                return [];
        }
    }
}

module.exports = ImprovedStartGameCommand;
