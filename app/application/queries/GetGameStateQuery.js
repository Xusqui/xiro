/**
 * @fileoverview Query para obtener estado completo de una partida
 * @module application/queries/GetGameStateQuery
 */

const Query = require('./Query');
const { executeQueryWithValidation, validateGameExists } = require('./QueryHelpers');

/**
 * Query para obtener el estado actual de una partida
 * Retorna información completa sin modificar nada
 */
class GetGameStateQuery extends Query {
    /**
     * @param {Object} params
     * @param {string} params.gameId - ID de la partida
     * @param {boolean} [params.includeQuestions=false] - Incluir preguntas completas
     * @param {boolean} [params.includeScores=true] - Incluir puntuaciones
     */
    constructor({ gameId, includeQuestions = false, includeScores = true }) {
        super({ gameId, includeQuestions, includeScores });
    }

    /**
     * Validar parámetros
     */
    validate() {
        const errors = [];

        if (!this.params.gameId) {
            errors.push('gameId is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Ejecutar query - obtener estado del juego
     * @param {Object} deps - Dependencias
     * @param {Map} deps.activeGames - Map de juegos activos
     * @returns {Promise<Object>} Estado del juego
     */
    execute({ activeGames }) {
        return executeQueryWithValidation(this, () => {
            const game = validateGameExists(activeGames, this.params.gameId);
            if (game.success === false) return game; // Es una respuesta de error

            // Construir respuesta según parámetros
            const response = {
                success: true,
                gameId: this.params.gameId,
                pin: game.pin,
                state: game.state,
                currentIndex: game.currentIndex,
                canAnswer: game.canAnswer,
                timerValue: game.timerValue,
                playerCount: game.players?.length || 0,
                questionCount: game.questions?.length || 0
            };

            // Incluir puntuaciones si se solicita
            if (this.params.includeScores && game.scores) {
                response.scores = { ...game.scores };
            }

            // Incluir preguntas si se solicita
            if (this.params.includeQuestions && game.questions) {
                response.questions = [...game.questions];
            }

            // Incluir estadísticas de respuestas
            if (game.answerStats) {
                response.answerStats = { ...game.answerStats };
            }

            return response;
        });
    }
}

module.exports = GetGameStateQuery;
