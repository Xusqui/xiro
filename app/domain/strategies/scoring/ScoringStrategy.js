/**
 * @fileoverview Interfaz base para estrategias de puntuación
 * Define el contrato que deben cumplir todas las estrategias
 * 
 * ARQUITECTURA: Strategy Pattern
 * - Permite intercambiar algoritmos de puntuación en runtime
 * - Cada estrategia implementa calculatePoints()
 * - Facilita testing y extensibilidad
 * 
 * FASE 17.2 - Día 1: Diseño de interfaces
 * Fecha: 3 de febrero de 2026
 */

/**
 * Clase base abstracta para estrategias de puntuación
 * 
 * @abstract
 */
class ScoringStrategy {
    /**
     * Constructor de la estrategia
     * @param {Object} config - Configuración de la estrategia
     */
    constructor(config = {}) {
        if (new.target === ScoringStrategy) {
            throw new Error('ScoringStrategy es una clase abstracta y no puede ser instanciada directamente');
        }
        this.config = config;
    }

    /**
     * Calcula los puntos ganados por una respuesta
     * 
     * @abstract
     * @param {Object} params - Parámetros de cálculo
     * @param {boolean} params.isCorrect - Si la respuesta es correcta
     * @param {number} params.timeElapsed - Tiempo transcurrido en segundos
     * @param {number} params.questionTimeLimit - Límite de tiempo de la pregunta
     * @param {Object} params.playerState - Estado del jugador
     * @param {number} params.playerState.currentStreak - Racha actual del jugador
     * @param {number} params.playerState.currentScore - Puntuación actual del jugador
     * @param {Object} params.teamState - Estado del equipo (opcional)
     * @param {boolean} params.teamState.inStreak - Si el equipo está en racha
     * @param {number} params.teamState.teamStreakCount - Contador de racha del equipo
     * @param {Object} params.betState - Estado de apuesta (opcional)
     * @param {number} params.betState.betAmount - Cantidad apostada
     * @returns {Object} Resultado del cálculo
     * @returns {number} return.pointsEarned - Puntos ganados (puede ser negativo)
     * @returns {Object} return.details - Detalles del cálculo (para debugging/analytics)
     * 
     * @throws {Error} Si no está implementado en la clase hija
     */
    calculatePoints(_params) {
        throw new Error('calculatePoints() debe ser implementado por la clase hija');
    }

    /**
     * Obtiene el nombre de la estrategia
     * @returns {string} Nombre de la estrategia
     */
    getName() {
        throw new Error('getName() debe ser implementado por la clase hija');
    }

    /**
     * Valida los parámetros de configuración
     * @param {Object} config - Configuración a validar
     * @returns {boolean} true si es válida
     * @throws {Error} Si la configuración es inválida
     */
    validateConfig(_config) {
        // Implementación por defecto: siempre válida
        return true;
    }

    /**
     * Obtiene la configuración actual
     * @returns {Object} Configuración de la estrategia
     */
    getConfig() {
        return { ...this.config };
    }
}

module.exports = ScoringStrategy;
