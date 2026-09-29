/**
 * @fileoverview Gestor de estado de apuestas para preguntas de tipo betting
 * Coordina el proceso de apuestas antes de revelar opciones
 * 
 * RESPONSABILIDADES:
 * - Registrar apuestas de jugadores
 * - Detectar cuándo todos han apostado
 * - Calcular estadísticas de apuestas
 * - Limpiar estado después de pregunta
 * 
 * FASE 17.2 - Día 3
 * Fecha: 3 de febrero de 2026
 */

const logger = require('../../../config/logger');

/**
 * Gestor de apuestas por juego/pregunta
 * 
 * Almacena estado en memoria:
 * bets = {
 *   'gameId:questionIndex': {
 *     'playerId1': { betAmount, timestamp },
 *     'playerId2': { betAmount, timestamp }
 *   }
 * }
 */
class BettingManager {
    constructor() {
        // Map de apuestas: gameId:questionIndex -> Map(playerId -> betData)
        this.bets = new Map();

        // Timeout de limpieza automática (30 minutos)
        this.cleanupInterval = setInterval(() => this._cleanup(), 30 * 60 * 1000);
    }

    /**
     * Genera clave única para juego + pregunta
     * @private
     */
    _getKey(gameId, questionIndex) {
        return `${gameId}:${questionIndex}`;
    }

    /**
     * Registra apuesta de un jugador
     * 
     * @param {Object} params - Parámetros
     * @param {string} params.gameId - ID del juego
     * @param {number} params.questionIndex - Índice de pregunta
     * @param {string} params.playerId - ID del jugador
     * @param {number} params.betAmount - Cantidad apostada
     * @returns {Object} { success: boolean, bet: Object }
     */
    placeBet({ gameId, questionIndex, playerId, betAmount }) {
        const key = this._getKey(gameId, questionIndex);

        if (!this.bets.has(key)) {
            this.bets.set(key, new Map());
        }

        const questionBets = this.bets.get(key);

        const bet = {
            betAmount,
            timestamp: Date.now(),
            playerId
        };

        questionBets.set(playerId, bet);

        logger.debug('Apuesta registrada', {
            gameId,
            questionIndex,
            playerId,
            betAmount,
            totalBets: questionBets.size
        });

        return {
            success: true,
            bet
        };
    }

    /**
     * Obtiene apuesta de un jugador específico
     * 
     * @param {string} gameId - ID del juego
     * @param {number} questionIndex - Índice de pregunta
     * @param {string} playerId - ID del jugador
     * @returns {Object|null} Datos de apuesta o null si no existe
     */
    getBet(gameId, questionIndex, playerId) {
        const key = this._getKey(gameId, questionIndex);
        const questionBets = this.bets.get(key);

        if (!questionBets) return null;

        return questionBets.get(playerId) || null;
    }

    /**
     * Obtiene todas las apuestas de una pregunta
     * 
     * @param {string} gameId - ID del juego
     * @param {number} questionIndex - Índice de pregunta
     * @returns {Map<string, Object>} Map de playerId -> betData
     */
    getAllBets(gameId, questionIndex) {
        const key = this._getKey(gameId, questionIndex);
        return this.bets.get(key) || new Map();
    }

    /**
     * Verifica si todos los jugadores han apostado
     * 
     * @param {string} gameId - ID del juego
     * @param {number} questionIndex - Índice de pregunta
     * @param {number} expectedPlayerCount - Número de jugadores esperados
     * @returns {boolean} true si todos apostaron
     */
    areBetsComplete(gameId, questionIndex, expectedPlayerCount) {
        const questionBets = this.getAllBets(gameId, questionIndex);
        return questionBets.size >= expectedPlayerCount;
    }

    /**
     * Obtiene estadísticas de apuestas
     * 
     * @param {string} gameId - ID del juego
     * @param {number} questionIndex - Índice de pregunta
     * @returns {Object} Estadísticas
     */
    getBetStats(gameId, questionIndex) {
        const questionBets = this.getAllBets(gameId, questionIndex);

        if (questionBets.size === 0) {
            return {
                count: 0,
                totalAmount: 0,
                averageAmount: 0,
                minAmount: 0,
                maxAmount: 0
            };
        }

        const amounts = Array.from(questionBets.values()).map(b => b.betAmount);
        const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);

        return {
            count: questionBets.size,
            totalAmount: Math.round(totalAmount * 100) / 100,
            averageAmount: Math.round((totalAmount / questionBets.size) * 100) / 100,
            minAmount: Math.min(...amounts),
            maxAmount: Math.max(...amounts)
        };
    }

    /**
     * Elimina apuestas de una pregunta específica
     * 
     * @param {string} gameId - ID del juego
     * @param {number} questionIndex - Índice de pregunta
     * @returns {boolean} true si se eliminó
     */
    clearBets(gameId, questionIndex) {
        const key = this._getKey(gameId, questionIndex);
        const deleted = this.bets.delete(key);

        if (deleted) {
            logger.debug('Apuestas eliminadas', { gameId, questionIndex });
        }

        return deleted;
    }

    /**
     * Elimina todas las apuestas de un juego
     * 
     * @param {string} gameId - ID del juego
     * @returns {number} Número de preguntas limpiadas
     */
    clearGameBets(gameId) {
        let cleared = 0;

        for (const key of this.bets.keys()) {
            if (key.startsWith(`${gameId}:`)) {
                this.bets.delete(key);
                cleared++;
            }
        }

        if (cleared > 0) {
            logger.debug('Apuestas de juego eliminadas', { gameId, cleared });
        }

        return cleared;
    }

    /**
     * Obtiene número total de apuestas activas
     * 
     * @returns {number} Total de preguntas con apuestas
     */
    getActiveCount() {
        return this.bets.size;
    }

    /**
     * Limpieza automática de apuestas antiguas (>30 minutos)
     * @private
     */
    _cleanup() {
        const now = Date.now();
        const threshold = 30 * 60 * 1000; // 30 minutos
        let cleaned = 0;

        for (const [key, questionBets] of this.bets.entries()) {
            // Verificar si todas las apuestas son antiguas
            const allOld = Array.from(questionBets.values())
                .every(bet => (now - bet.timestamp) > threshold);

            if (allOld) {
                this.bets.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug('Limpieza automática de apuestas', { cleaned });
        }
    }

    /**
     * Destructor: limpiar intervalo
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.bets.clear();
    }
}

// Singleton
const bettingManager = new BettingManager();

module.exports = bettingManager;
