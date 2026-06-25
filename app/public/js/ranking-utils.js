/**
 * @fileoverview Ranking Utilities - Funciones auxiliares para manejo de rankings
 */

/**
 * Filtra el ranking eliminando jugadores que no deberían aparecer (ej: HOST)
 * @param {Array} ranking - Array de objetos con {name, pts, position}
 * @returns {Array} Ranking filtrado
 */
function filterRanking(ranking) {
    if (!ranking || !Array.isArray(ranking)) {
        return [];
    }

    return ranking
        .filter(player => player.name !== 'HOST')
        .map((player, index) => ({
            ...player,
            position: index + 1 // Recalcular posiciones después del filtrado
        }));
}

/**
 * Obtiene el top N jugadores del ranking
 * @param {Array} ranking - Array de ranking
 * @param {Number} limit - Número máximo de jugadores (default: 5)
 * @returns {Array} Top N jugadores
 */
function getTopN(ranking, limit = 5) {
    const filtered = filterRanking(ranking);
    return filtered.slice(0, limit);
}

// Exportar para uso en el navegador (no usar module.exports)
if (typeof window !== 'undefined') {
    window.RankingUtils = {
        filterRanking,
        getTopN
    };
}
