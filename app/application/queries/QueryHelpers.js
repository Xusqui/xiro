/**
 * @fileoverview Query Helpers - Funciones comunes para queries
 * @module application/queries/QueryHelpers
 * 
 * Consolidación de lógica duplicada en queries:
 * - Validación de parámetros
 * - Error handling común
 * - Respuestas estandarizadas
 */

/**
 * Crear respuesta de error estándar para query
 * @param {string} errorType - Tipo de error ('game_not_found', 'player_not_found', etc.)
 * @param {Object} context - Contexto adicional (gameId, playerId, etc.)
 * @returns {Object} Respuesta de error estandarizada
 */
function createQueryErrorResponse(errorType, context = {}) {
    const errorMessages = {
        game_not_found: 'Game not found',
        player_not_found: 'Player not found',
        invalid_params: 'Invalid query parameters'
    };

    return {
        success: false,
        error: errorMessages[errorType] || 'Unknown error',
        ...context
    };
}

/**
 * Validar y ejecutar query con error handling común
 * Consolidación del patrón duplicado en las queries
 * 
 * @param {Query} query - Instancia de la query a ejecutar
 * @param {Function} executor - Función que ejecuta la query
 * @returns {Promise<Object>} Resultado de la query
 */
async function executeQueryWithValidation(query, executor) {
    const validation = query.validate();
    if (!validation.valid) {
        throw new Error(`Invalid query: ${validation.errors.join(', ')}`);
    }

    return await executor();
}

/**
 * Validar existencia de juego
 * @param {Map} activeGames - Map de juegos activos
 * @param {string} gameId - ID del juego
 * @returns {Object|null} Juego encontrado o null
 */
function validateGameExists(activeGames, gameId) {
    const game = activeGames.get(gameId);

    if (!game) {
        return createQueryErrorResponse('game_not_found', { gameId });
    }

    return game;
}

module.exports = {
    createQueryErrorResponse,
    executeQueryWithValidation,
    validateGameExists
};
