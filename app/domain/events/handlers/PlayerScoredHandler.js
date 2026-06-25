/**
 * @fileoverview Handler para el evento PlayerScoredEvent
 * @module domain/events/handlers/PlayerScoredHandler
 * 
 * Responsabilidades:
 * - Broadcast de ranking actualizado a jugadores que respondieron
 * - Broadcast de ranking al presentador
 * - Debouncing de broadcasts usando BroadcastOptimizer (WEEK 18)
 * - Persistencia de scores (async, sin bloquear)
 */

const EventHandler = require('./EventHandler');
const BroadcastOptimizer = require('../../../sockets/services/BroadcastOptimizer');
const { roundScore } = require('../../services/GameUtils');

class PlayerScoredHandler extends EventHandler {
    constructor(eventBus, io, dependencies = {}) {
        super(eventBus, io, dependencies);
        this.broadcastOptimizer = dependencies.broadcastOptimizer || new BroadcastOptimizer(io);
    }

    register() {
        this.subscribe('player.scored', this.handlePlayerScored.bind(this), 7);
        this.log('info', 'PlayerScoredHandler registered');
    }

    async handlePlayerScored(event) {
        const { gameId, playerId, nickname, totalScore, questionIndex } = event.payload || event;
        const roomId = gameId;

        try {
            this.log('debug', 'Processing player scored event', {
                roomId,
                playerId,
                nickname,
                newScore: totalScore,
                questionIndex
            });

            // 1. Obtener ranking actual del juego
            const game = this.dependencies.activeGames?.get(roomId);
            const ranking = game ? this._buildRanking(game.scores) : null;

            // 2. Broadcast ranking con throttling
            await this.broadcastRanking(roomId, ranking);

            // 3. Persistir score en background (no bloquear)
            this.persistScore(roomId, playerId, totalScore, questionIndex).catch(err => {
                this.log('error', 'Error persisting score', {
                    roomId,
                    playerId,
                    error: err.message
                });
            });

            // 4. Actualizar métricas/analytics (si hay servicio)
            if (this.dependencies.analytics) {
                this.dependencies.analytics.trackScore(playerId, totalScore, questionIndex);
            }

        } catch (error) {
            this.log('error', 'Error processing player scored event', {
                roomId,
                playerId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Broadcast ranking usando BroadcastOptimizer (WEEK 18)
     * Debouncing: 100ms (configurable en BroadcastOptimizer)
     * Smart flush: >10 pendientes
     */
    async broadcastRanking(roomId, ranking) {
        // Validar que ranking existe
        if (!ranking || !Array.isArray(ranking)) {
            this.log('debug', 'No ranking to broadcast', { roomId });
            return;
        }

        const payload = {
            ranking,
            timestamp: Date.now()
        };

        // Broadcast al presentador usando BroadcastOptimizer
        await this.broadcastOptimizer.emit(
            'ranking-update',
            roomId,
            payload,
            `${roomId}:presenter`
        );

        // Broadcast a jugadores usando BroadcastOptimizer
        await this.broadcastOptimizer.emit(
            'ranking-update',
            roomId,
            payload,
            `${roomId}:players`
        );

        this.log('debug', 'Ranking queued for broadcast', {
            roomId,
            playerCount: ranking.length
        });
    }

    /**
     * Persistir score en DB (async)
     */
    async persistScore(roomId, playerId, score, questionIndex) {
        if (!this.dependencies.db) {
            return; // Sin DB service, skip
        }

        try {
            await this.dependencies.db.updatePlayerScore({
                roomId,
                playerId,
                score,
                questionIndex,
                timestamp: Date.now()
            });

            this.log('debug', 'Score persisted', {
                roomId,
                playerId,
                score
            });
        } catch (error) {
            this.log('error', 'DB error persisting score', {
                roomId,
                playerId,
                error: error.message
            });
            // No re-throw, es background operation
        }
    }

    /**
     * Force broadcast (sin debouncing) - útil para fin de pregunta
     * Hace flush inmediato de broadcasts pendientes
     */
    forceBroadcastRanking(roomId, ranking) {
        const payload = {
            ranking,
            timestamp: Date.now()
        };

        // Flush pendientes primero
        this.broadcastOptimizer.flushRoom(roomId);

        // Emitir inmediatamente (debounceMs: 0)
        this.broadcastOptimizer.emit(
            'ranking-update',
            roomId,
            payload,
            `${roomId}:presenter`,
            { debounceMs: 0 }
        );

        this.broadcastOptimizer.emit(
            'ranking-update',
            roomId,
            payload,
            `${roomId}:players`,
            { debounceMs: 0 }
        );

        this.log('debug', 'Ranking force broadcasted', { roomId });
    }

    /**
     * Construir ranking desde scores del juego
     * @private
     */
    _buildRanking(scores) {
        return Object.entries(scores || {})
            .map(([nickname, score]) => ({
                nickname,
                score: roundScore(score)
            }))
            .sort((a, b) => b.score - a.score);
    }
}

module.exports = PlayerScoredHandler;
