/**
 * @fileoverview Servicio de precarga (warming) de caché de juegos
 * Carga los juegos más populares al arrancar el servidor para mejorar rendimiento
 * FASE 17.1 - DÍA 3: Cache warming strategy
 */

const { pool } = require('../config/database');
const { questionBankCache } = require('./cache.service');
const logger = require('../config/logger');

/**
 * Servicio singleton para precarga de caché de juegos
 */
class CacheWarmingService {
    constructor() {
        this.warmingInProgress = false;
        this.lastWarmingTime = null;
        this.warmedGamesCount = 0;
    }

    /**
     * Obtiene los juegos más populares (por created_at reciente y visible_to_presenter)
     * @param {number} limit - Cantidad de juegos a obtener (default: 10)
     * @returns {Promise<Array>} - Array de juegos populares
     */
    async getPopularGames(limit = 10) {
        try {
            const result = await pool.query(`
                SELECT id, pin, name, 'game' as type
                FROM games 
                WHERE pin IS NOT NULL 
                  AND visible_to_presenter = true
                ORDER BY created_at DESC
                LIMIT $1
            `, [limit]);

            logger.debug('Popular games retrieved', { count: result.rows.length, limit });
            return result.rows;
        } catch (error) {
            logger.error('Error getting popular games', { error: error.message, stack: error.stack });
            return [];
        }
    }

    /**
     * Carga las preguntas de un juego específico
     * @param {number} gameId - ID del juego
     * @returns {Promise<Array>} - Array de preguntas del juego
     */
    async loadGameQuestions(gameId) {
        try {
            const result = await pool.query(`
                WITH pool_config AS (
                    SELECT COALESCE(pool_question_count, 0) AS pool_question_count
                    FROM games WHERE id = $1
                ),
                fixed_banks AS (
                    SELECT bank_id, question_count
                    FROM game_banks
                    WHERE game_id = $1 AND question_count IS NOT NULL
                ),
                pool_banks AS (
                    SELECT bank_id
                    FROM game_banks
                    WHERE game_id = $1 AND question_count IS NULL
                ),
                fixed_questions AS (
                    SELECT
                        q.id, q.question_text, q.question_type, q.tipo_contenido, q.url_recurso, q.time_limit,
                        ROW_NUMBER() OVER (PARTITION BY q.bank_id ORDER BY RANDOM()) as rn,
                        fb.question_count as take_count
                    FROM questions q
                    INNER JOIN fixed_banks fb ON q.bank_id = fb.bank_id
                ),
                pool_questions AS (
                    SELECT
                        q.id, q.question_text, q.question_type, q.tipo_contenido, q.url_recurso, q.time_limit,
                        ROW_NUMBER() OVER (ORDER BY RANDOM()) as rn,
                        (SELECT pool_question_count FROM pool_config) as take_count
                    FROM questions q
                    INNER JOIN pool_banks pb ON q.bank_id = pb.bank_id
                ),
                selected_questions AS (
                    SELECT id, question_text, question_type, tipo_contenido, url_recurso, time_limit
                    FROM fixed_questions WHERE rn <= take_count
                    UNION ALL
                    SELECT id, question_text, question_type, tipo_contenido, url_recurso, time_limit
                    FROM pool_questions WHERE rn <= take_count
                )
                SELECT
                    sq.id,
                    sq.question_text,
                    sq.question_type,
                    sq.tipo_contenido,
                    sq.url_recurso,
                    sq.time_limit,
                    json_agg(
                        json_build_object(
                            'text', o.option_text,
                            'optionText', o.option_text,
                            'isCorrect', o.is_correct,
                            'justification', o.justification
                        ) ORDER BY o.id
                    ) as options
                FROM selected_questions sq
                LEFT JOIN options o ON o.question_id = sq.id
                GROUP BY sq.id, sq.question_text, sq.question_type,
                         sq.tipo_contenido, sq.url_recurso, sq.time_limit
                ORDER BY RANDOM()
            `, [gameId]);

            return result.rows;
        } catch (error) {
            logger.error('Error loading game questions for warming', {
                gameId,
                error: error.message
            });
            return [];
        }
    }

    /**
     * Precarga un juego específico en caché
     * @param {number} gameId - ID del juego
     * @param {string} pin - PIN del juego
     * @param {string} name - Nombre del juego
     * @param {string} type - Tipo de juego ('game' o 'custom_game')
     * @returns {Promise<boolean>} - true si se precargó exitosamente
     */
    async warmGameById(gameId, pin, name, type = 'game') {
        try {
            // Verificar si ya está en caché
            const cached = questionBankCache.getFullGame(pin, type);
            if (cached) {
                logger.debug('Game already cached, skipping warming', { gameId, pin, name });
                return true;
            }

            // Cargar preguntas del juego
            const questions = await this.loadGameQuestions(gameId);

            if (questions.length === 0) {
                logger.warn('No questions found for game warming', { gameId, pin, name });
                return false;
            }

            // Guardar en caché con estructura completa
            const gameData = {
                game: { id: gameId, pin, name, type },
                questions
            };

            questionBankCache.setFullGame(pin, gameData, type);

            logger.info('Game warmed successfully', {
                gameId,
                pin,
                name,
                questionsCount: questions.length
            });

            return true;
        } catch (error) {
            logger.error('Error warming game', {
                gameId,
                pin,
                name,
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    /**
     * Precarga los juegos más populares en caché
     * @param {number} limit - Cantidad de juegos a precargar (default: 10)
     * @returns {Promise<Object>} - Estadísticas de la precarga
     */
    async warmPopularGames(limit = 10) {
        if (this.warmingInProgress) {
            logger.warn('Cache warming already in progress, skipping');
            return { success: false, reason: 'warming_in_progress' };
        }

        this.warmingInProgress = true;
        const startTime = Date.now();

        try {
            logger.info('Starting cache warming for popular games', { limit });

            const popularGames = await this.getPopularGames(limit);

            if (popularGames.length === 0) {
                logger.warn('No popular games found for warming');
                this.warmingInProgress = false;
                return { success: true, warmedCount: 0, duration: 0 };
            }

            let successCount = 0;
            let failureCount = 0;

            // Precargar cada juego
            for (const game of popularGames) {
                const success = await this.warmGameById(game.id, game.pin, game.name, game.type);
                if (success) {
                    successCount++;
                } else {
                    failureCount++;
                }
            }

            const duration = Date.now() - startTime;
            this.lastWarmingTime = new Date();
            this.warmedGamesCount = successCount;

            logger.info('Cache warming completed', {
                successCount,
                failureCount,
                total: popularGames.length,
                duration: `${duration}ms`
            });

            return {
                success: true,
                warmedCount: successCount,
                failedCount: failureCount,
                duration,
                timestamp: this.lastWarmingTime
            };
        } catch (error) {
            logger.error('Error during cache warming', {
                error: error.message,
                stack: error.stack
            });
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.warmingInProgress = false;
        }
    }

    /**
     * Obtiene estadísticas del servicio de warming
     * @returns {Object} - Estadísticas de warming
     */
    getStats() {
        return {
            warmingInProgress: this.warmingInProgress,
            lastWarmingTime: this.lastWarmingTime,
            warmedGamesCount: this.warmedGamesCount
        };
    }
}

// Exportar instancia singleton
const cacheWarmingService = new CacheWarmingService();

module.exports = cacheWarmingService;
