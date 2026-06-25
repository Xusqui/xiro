/**
 * @fileoverview Handler para el evento GameEndedEvent
 * @module domain/events/handlers/GameEndedHandler
 * 
 * Responsabilidades:
 * - Calcular y emitir ranking final
 * - Emitir resultados finales a todos los participantes
 * - Persistir estadísticas finales del juego
 * - Cleanup de recursos (timers, cache, state)
 */

const EventHandler = require('./EventHandler');

class GameEndedHandler extends EventHandler {
    constructor(eventBus, io, dependencies = {}) {
        super(eventBus, io, dependencies);
    }

    register() {
        this.subscribe('game.ended', this.handleGameEnded.bind(this), 9);
        this.log('info', 'GameEndedHandler registered');
    }

    async handleGameEnded(event) {
        // Extraer del payload del evento
        const { roomId, gameId, finalRanking, ranking, stats, duration, timestamp: _timestamp, playerCount } = event.payload || event;
        const actualRoomId = roomId || gameId;
        const actualRanking = finalRanking || ranking;

        try {
            this.log('info', 'Processing game ended event', {
                roomId: actualRoomId,
                playerCount: actualRanking?.length || playerCount || 0,
                duration,
                hasRanking: !!actualRanking
            });

            // Si no hay ranking, no hacer nada (ranking ya enviado desde EndGameUseCase)
            if (!actualRanking || actualRanking.length === 0) {
                this.log('debug', 'No ranking in event, skipping handler', { roomId: actualRoomId });
                return;
            }

            // 1. Emitir resultados finales a todos
            await this.broadcastFinalResults(actualRoomId, actualRanking, stats, duration);

            // 2. Persistir estadísticas finales
            await this.persistGameStats(actualRoomId, actualRanking, stats, duration);

            // 3. Cleanup de recursos
            await this.cleanup(actualRoomId);

            // 4. Emitir evento de cleanup completado
            this.eventBus.emit('game.cleanup.completed', {
                roomId: actualRoomId,
                timestamp: Date.now()
            });

            this.log('info', 'Game ended event processed', { roomId: actualRoomId });

        } catch (error) {
            this.log('error', 'Error processing game ended event', {
                roomId: actualRoomId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Broadcast de resultados finales (formato compatible con frontend actual)
     * Frontend espera: ranking (array directo)
     */
    broadcastFinalResults(roomId, ranking, _stats, _duration) {
        // Broadcast via Redis Adapter (multi-worker compatible)
        this.io.to(`${roomId}:players`).emit('game-ended', ranking);
        this.io.to(`${roomId}:presenter`).emit('game-ended', ranking);

        this.log('debug', 'Final results broadcasted', {
            roomId,
            rankingLength: ranking.length,
            winnerScore: ranking[0]?.score
        });

        return Promise.resolve();
    }

    /**
     * Persistir estadísticas del juego
     */
    async persistGameStats(roomId, ranking, stats, duration) {
        if (!this.dependencies.db) {
            return;
        }

        try {
            await this.dependencies.db.saveGameStats({
                roomId,
                ranking,
                stats,
                duration,
                endedAt: Date.now()
            });

            this.log('debug', 'Game stats persisted', { roomId });
        } catch (error) {
            this.log('error', 'Error persisting game stats', {
                roomId,
                error: error.message
            });
        }
    }

    /**
     * Cleanup de recursos asociados al juego
     */
    cleanup(roomId) {
        try {
            // Cancelar timers si hay timer service
            if (this.dependencies.timerService) {
                this.dependencies.timerService.cancelAll(roomId);
            }

            // Limpiar cache de pregunta actual
            if (this.dependencies.cache) {
                this.dependencies.cache.delete(`current-question:${roomId}`);
            }

            // Limpiar state machine adapter si existe
            if (this.dependencies.gameStateAdapter) {
                this.dependencies.gameStateAdapter.cleanup(roomId);
            }

            this.log('debug', 'Game resources cleaned up', { roomId });
        } catch (error) {
            this.log('warn', 'Error during cleanup', {
                roomId,
                error: error.message
            });
        }

        return Promise.resolve();
    }

    /**
     * Calcular score promedio
     */
    calculateAverageScore(ranking) {
        if (ranking.length === 0) return 0;
        const total = ranking.reduce((sum, player) => sum + player.score, 0);
        return Math.round(total / ranking.length);
    }
}

module.exports = GameEndedHandler;
