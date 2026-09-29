/**
 * @fileoverview Interfaz base para estrategias de modo de juego
 * Elimina condicionales if (isTeamMode) mediante Strategy Pattern
 */

/**
 * Clase base abstracta para estrategias de modo de juego
 * @abstract
 */
class GameModeStrategy {
    /**
     * Procesa una respuesta de jugador según el modo de juego
     * @param {Object} params - Parámetros
     * @param {Object} params.player - Datos del jugador
     * @param {Object} params.answer - Respuesta del jugador
     * @param {Object} params.game - Estado del juego
     * @param {Object} params.question - Pregunta actual
     * @param {Object} params.io - Instancia Socket.IO
     * @param {Map} params.teamConfigs - Configuración de equipos
     * @returns {Promise<Object>} Resultado del procesamiento
     */
    processAnswer(_params) {
        return Promise.reject(new Error('Method processAnswer() must be implemented'));
    }

    /**
     * Determina si se puede revelar resultados a un jugador/equipo
     * @param {Object} params - Parámetros
     * @param {Object} params.player - Datos del jugador
     * @param {Object} params.game - Estado del juego
     * @param {Object} params.teamConfig - Configuración de equipos (si aplica)
     * @returns {boolean} true si puede revelar
     */
    canRevealResults(_params) {
        throw new Error('Method canRevealResults() must be implemented');
    }

    /**
     * Broadcast de resultados según el modo de juego
     * @param {Object} params - Parámetros
     * @param {Object} params.game - Estado del juego
     * @param {Object} params.io - Instancia Socket.IO
     * @param {string} params.roomId - ID del room
     * @param {Object} params.currentQuestion - Pregunta actual
     * @returns {Promise<void>}
     */
    broadcastResults(_params) {
        return Promise.reject(new Error('Method broadcastResults() must be implemented'));
    }

    /**
     * Calcula el ranking final según el modo de juego
     * @param {Object} params - Parámetros
     * @param {Object} params.game - Estado del juego
     * @param {Object} params.teamConfig - Configuración de equipos (si aplica)
     * @returns {Array} Ranking ordenado
     */
    calculateFinalRanking(_params) {
        throw new Error('Method calculateFinalRanking() must be implemented');
    }

    /**
     * Limpia recursos específicos del modo de juego
     * @param {Object} params - Parámetros
     * @param {string} params.roomId - ID del room
     * @param {Map} params.teamConfigs - Configuración de equipos
     * @returns {void}
     */
    cleanup(_params) {
        throw new Error('Method cleanup() must be implemented');
    }

    /**
     * Construye snapshot de reconexión según modo de juego
     * @param {Object} params - Parámetros
     * @param {Object} params.game - Estado del juego
     * @param {Object} params.player - Datos del jugador
     * @param {Object} params.teamConfig - Configuración de equipos (si aplica)
     * @returns {Object} Snapshot con datos de reconexión
     */
    buildReconnectionSnapshot(_params) {
        throw new Error('Method buildReconnectionSnapshot() must be implemented');
    }
}

module.exports = GameModeStrategy;
