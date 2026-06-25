/**
 * @fileoverview Handler para el evento GameStartedEvent
 * @module domain/events/handlers/GameStartedHandler
 * 
 * Responsabilidades:
 * - Emitir evento 'game-started' a todos los jugadores
 * - Emitir estado inicial al presentador
 * - Iniciar countdown si está configurado
 * - Logging de inicio de partida
 */

const EventHandler = require('./EventHandler');

class GameStartedHandler extends EventHandler {
    constructor(eventBus, io, dependencies = {}) {
        super(eventBus, io, dependencies);
        this.ackManager = dependencies.ackManager || null;
    }

    register() {
        this.subscribe('game.started', this.handleGameStarted.bind(this), 8);
        this.log('info', 'GameStartedHandler registered');
    }

    handleGameStarted(event) {
        const { gameId, pin: _pin, mode, questionCount, playerCount } = event.payload || event;

        try {
            this.log('info', 'Processing game started event', {
                gameId,
                playerCount,
                mode,
                questionCount
            });

            // GameStartedHandler solo hace logging
            // La emisión de eventos al frontend se hace en StartGameHandler
            // para tener acceso completo al gameState y preparedQuestions

            this.log('info', 'Game started event processed successfully', { gameId });
            return Promise.resolve();

        } catch (error) {
            this.log('error', 'Error processing game started event', {
                gameId,
                error: error.message,
                stack: error.stack
            });
            return Promise.reject(error);
        }
    }

    /**
     * Notificar a jugadores sobre inicio del juego
     */
    async notifyPlayers(roomId, gameConfig, players) {
        const playersRoom = `${roomId}:players`;
        const payload = {
            mode: gameConfig.mode,
            teamConfig: gameConfig.teamConfig,
            questionCount: gameConfig.questions?.length || 0,
            timeLimit: gameConfig.questionTimeLimit,
            playerCount: players.length,
            startedAt: Date.now()
        };

        if (this.ackManager) {
            // Emitir con ACK a cada socket individual
            const sockets = await this.io.in(playersRoom).fetchSockets();
            let failedCount = 0;

            for (const socket of sockets) {
                const delivered = await this.ackManager.emitWithAck(socket, 'game-started', payload);
                if (!delivered) {
                    failedCount++;
                    this.log('error', 'Failed to deliver game-started to player', {
                        socketId: socket.id,
                        roomId
                    });
                }
            }

            this.log('debug', 'Notified players of game start with ACK', {
                roomId,
                playerCount: players.length,
                failedDeliveries: failedCount
            });
        } else {
            // Fallback: broadcast tradicional
            this.io.to(playersRoom).emit('game-started', payload);
            this.log('debug', 'Notified players of game start (no ACK)', {
                roomId,
                playerCount: players.length
            });
        }
    }

    /**
     * Notificar al presentador con estado completo
     */
    async notifyPresenter(roomId, gameConfig, players) {
        const presenterRoom = `${roomId}:presenter`;
        const payload = {
            mode: gameConfig.mode,
            teamConfig: gameConfig.teamConfig,
            questions: gameConfig.questions,
            players: players.map(p => ({
                nickname: p.nickname,
                team: p.team
            })),
            currentQuestionIndex: 0,
            startedAt: Date.now()
        };

        if (this.ackManager) {
            // Emitir con ACK a cada presentador
            const sockets = await this.io.in(presenterRoom).fetchSockets();
            let failedCount = 0;

            for (const socket of sockets) {
                const delivered = await this.ackManager.emitWithAck(socket, 'game-started', payload);
                if (!delivered) {
                    failedCount++;
                    this.log('error', 'Failed to deliver game-started to presenter', {
                        socketId: socket.id,
                        roomId
                    });
                }
            }

            this.log('debug', 'Notified presenter of game start with ACK', {
                roomId,
                failedDeliveries: failedCount
            });
        } else {
            // Fallback: broadcast tradicional
            this.io.to(presenterRoom).emit('game-started', payload);
            this.log('debug', 'Notified presenter of game start (no ACK)', { roomId });
        }
    }

    /**
     * Iniciar countdown si está configurado
     */
    startCountdown(roomId, countdownSeconds) {
        this.io.to(roomId).emit('countdown-start', {
            duration: countdownSeconds,
            startsAt: Date.now()
        });

        this.log('debug', 'Countdown started', {
            roomId,
            duration: countdownSeconds
        });

        return Promise.resolve();
    }
}

module.exports = GameStartedHandler;
