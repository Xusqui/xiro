/**
 * @fileoverview Query para obtener ranking de jugadores
 * @module application/queries/GetRankingQuery
 */

const Query = require('./Query');
const { executeQueryWithValidation, validateGameExists } = require('./QueryHelpers');
const rankingCache = require('../../services/RankingCache');
const logger = require('../../config/logger');

/**
 * Query para calcular y obtener el ranking actual de jugadores
 * Puede filtrar y ordenar según diferentes criterios
 */
class GetRankingQuery extends Query {
    /**
     * @param {Object} params
     * @param {string} params.gameId - ID de la partida
     * @param {number} [params.limit] - Límite de resultados (top N)
     * @param {boolean} [params.includeDisconnected=false] - Incluir desconectados
     */
    constructor({ gameId, limit, includeDisconnected = false }) {
        super({ gameId, limit, includeDisconnected });
    }

    /**
     * Validar parámetros
     */
    validate() {
        const errors = [];

        if (!this.params.gameId) {
            errors.push('gameId is required');
        }

        if (this.params.limit !== undefined && (typeof this.params.limit !== 'number' || this.params.limit < 1)) {
            errors.push('limit must be a positive number');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Ejecutar query - calcular ranking
     * Implementa cache-aside pattern: intenta cache → si miss → calcula → cachea
     * 
     * @param {Object} deps - Dependencias
     * @param {Map} deps.activeGames - Map de juegos activos
     * @returns {Promise<Object>} Ranking calculado
     */
    execute({ activeGames }) {
        return executeQueryWithValidation(this, async () => {
            const game = validateGameExists(activeGames, this.params.gameId);
            if (game.success === false) return game; // Es una respuesta de error

            if (!game.players || !game.scores) {
                return {
                    success: true,
                    ranking: [],
                    totalPlayers: 0
                };
            }

            // CACHE-ASIDE PATTERN: Intentar obtener de caché primero
            // Solo cachear si NO se incluyen desconectados (caso más común)
            let ranking = null;
            let fromCache = false;

            if (!this.params.includeDisconnected) {
                try {
                    const cached = await rankingCache.getRange(this.params.gameId, this.params.limit);
                    if (cached) {
                        // CACHE HIT: enriquecer con datos extra
                        ranking = cached.map(item => {
                            const player = game.players.find(p => p && p.nickname === item.nickname);
                            if (!player) {
                                // Jugador no encontrado en game.players (posiblemente desconectado)
                                return {
                                    playerId: item.nickname,
                                    nickname: item.nickname,
                                    score: item.score,
                                    position: item.position,
                                    isConnected: false,
                                    answeredCount: 0
                                };
                            }
                            return {
                                playerId: player.id || item.nickname,
                                nickname: item.nickname,
                                score: item.score,
                                position: item.position,
                                isConnected: player.connected !== false,
                                answeredCount: this._getAnsweredCount(game, player.id)
                            };
                        });
                        fromCache = true;
                        logger.debug(`GetRankingQuery: Cache hit para ${this.params.gameId}`);
                    }
                } catch (error) {
                    logger.warn('GetRankingQuery: Error al leer caché, fallback a cálculo', { error: error.message });
                }
            }

            // CACHE MISS: Calcular ranking completo
            if (!ranking) {
                ranking = game.players
                    .filter(player => player !== null && player !== undefined) // Filtrar nulls/undefined
                    .map(player => ({
                        playerId: player.id,
                        nickname: player.nickname,
                        score: game.scores[player.id] || 0,
                        isConnected: player.connected !== false,
                        answeredCount: this._getAnsweredCount(game, player.id)
                    }));

                // Filtrar desconectados si se solicita
                if (!this.params.includeDisconnected) {
                    ranking = ranking.filter(player => player.isConnected);
                }

                // Ordenar por puntuación (descendente)
                ranking.sort((a, b) => {
                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }
                    // En caso de empate, ordenar por nombre
                    return a.nickname.localeCompare(b.nickname);
                });

                // Añadir posición
                ranking.forEach((player, index) => {
                    player.position = index + 1;
                });

                // CACHEAR resultado (solo si NO se incluyen desconectados)
                if (!this.params.includeDisconnected) {
                    try {
                        // Cachear todos los jugadores (sin límite) para futuras queries
                        for (const player of ranking) {
                            await rankingCache.updateIncremental(
                                this.params.gameId,
                                player.nickname,
                                player.score
                            );
                        }
                        logger.debug(`GetRankingQuery: Cacheado ranking para ${this.params.gameId}`);
                    } catch (error) {
                        logger.warn('GetRankingQuery: Error al cachear ranking', { error: error.message });
                    }
                }

                // Aplicar límite si se especifica
                if (this.params.limit) {
                    ranking = ranking.slice(0, this.params.limit);
                }
            }

            return {
                success: true,
                ranking,
                totalPlayers: game.players.filter(p => p !== null && p !== undefined).length,
                connectedPlayers: game.players.filter(p => p !== null && p !== undefined && p.connected !== false).length,
                fromCache
            };
        });
    }

    /**
     * Obtener cantidad de preguntas respondidas por un jugador
     * @private
     */
    _getAnsweredCount(game, playerId) {
        if (!game.answerStats) return 0;

        let count = 0;
        for (const questionIndex in game.answerStats) {
            if (game.answerStats[questionIndex][playerId]) {
                count++;
            }
        }
        return count;
    }
}

module.exports = GetRankingQuery;
