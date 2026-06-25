/**
 * @fileoverview Query para obtener estadísticas de un jugador
 * @module application/queries/GetPlayerStatsQuery
 */

const Query = require('./Query');
const { executeQueryWithValidation, validateGameExists, validatePlayerExists } = require('./QueryHelpers');

/**
 * Query para obtener estadísticas detalladas de un jugador específico
 */
class GetPlayerStatsQuery extends Query {
    /**
     * @param {Object} params
     * @param {string} params.gameId - ID de la partida
     * @param {string} params.playerId - ID del jugador
     */
    constructor({ gameId, playerId }) {
        super({ gameId, playerId });
    }

    /**
     * Validar parámetros
     */
    validate() {
        const errors = [];

        if (!this.params.gameId) {
            errors.push('gameId is required');
        }

        if (!this.params.playerId) {
            errors.push('playerId is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Ejecutar query - obtener stats del jugador
     * @param {Object} deps - Dependencias
     * @param {Map} deps.activeGames - Map de juegos activos
     * @returns {Promise<Object>} Estadísticas del jugador
     */
    execute({ activeGames }) {
        return executeQueryWithValidation(this, () => {
            const game = validateGameExists(activeGames, this.params.gameId);
            if (game.success === false) return game; // Es una respuesta de error

            const player = validatePlayerExists(game, this.params.playerId);
            if (player.success === false) return player; // Es una respuesta de error

            // Calcular estadísticas
            const stats = {
                playerId: player.id,
                nickname: player.nickname,
                totalScore: game.scores?.[player.id] || 0,
                isConnected: player.connected !== false,
                answers: this._getPlayerAnswers(game, player.id),
                accuracy: 0,
                averageResponseTime: 0
            };

            // Calcular accuracy (% de respuestas correctas)
            if (stats.answers.length > 0) {
                const correctAnswers = stats.answers.filter(a => a.isCorrect).length;
                stats.accuracy = (correctAnswers / stats.answers.length) * 100;
            }

            // Calcular tiempo promedio de respuesta
            if (stats.answers.length > 0) {
                const totalTime = stats.answers.reduce((sum, a) => sum + (a.responseTime || 0), 0);
                stats.averageResponseTime = totalTime / stats.answers.length;
            }

            // Calcular posición en ranking
            stats.rank = this._calculatePlayerRank(game, player.id);

            return {
                success: true,
                stats
            };
        });
    }

    /**
     * Obtener todas las respuestas de un jugador
     * @private
     */
    _getPlayerAnswers(game, playerId) {
        if (!game.answerStats) return [];

        const answers = [];
        for (const questionIndex in game.answerStats) {
            const answer = game.answerStats[questionIndex][playerId];
            if (answer) {
                answers.push({
                    questionIndex: parseInt(questionIndex),
                    answerIndex: answer.answerIndex,
                    isCorrect: answer.isCorrect,
                    pointsEarned: answer.pointsEarned,
                    responseTime: answer.responseTime,
                    timestamp: answer.timestamp
                });
            }
        }

        return answers.sort((a, b) => a.questionIndex - b.questionIndex);
    }

    /**
     * Calcular posición del jugador en el ranking
     * @private
     */
    _calculatePlayerRank(game, playerId) {
        if (!game.scores || !game.players) return null;

        const playerScore = game.scores[playerId] || 0;

        // Contar cuántos jugadores tienen más puntos
        let rank = 1;
        for (const otherPlayer of game.players) {
            const otherScore = game.scores[otherPlayer.id] || 0;
            if (otherScore > playerScore) {
                rank++;
            }
        }

        return rank;
    }
}

module.exports = GetPlayerStatsQuery;
