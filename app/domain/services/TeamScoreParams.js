/**
 * @fileoverview Parámetros de la puntuación de equipo: media global y λ.
 *
 * La puntuación de un equipo es (suma + λ·media) / (n + λ) (calculateTeamScore).
 * Este módulo es la única fuente de esos dos parámetros para el marcador en vivo
 * (TeamManager), el ranking final (RankingCalculator) y la estrategia de equipos
 * (TeamGameMode). Antes cada uno los calculaba a su manera: el marcador en vivo
 * usaba la λ fija de game-constants y el podio la configurable del admin, y el
 * podio daba λ = Infinity si había un equipo vacío.
 */

/**
 * @param {Array<{players?: string[]}>} teams - Equipos de la partida
 * @param {Object<string, number>} scores - Puntuación individual por nickname
 * @param {number} baseLambda - λ base (TEAM_SCORE_LAMBDA de la configuración)
 * @returns {{globalMean: number, lambda: number}}
 */
function teamScoreParams(teams = [], scores = {}, baseLambda = 0) {
    const values = Object.values(scores || {}).map(value => Number(value) || 0);
    const globalMean = values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;

    // Los equipos vacíos no cuentan: con tamaño 0 la proporción sería infinita
    const sizes = (teams || [])
        .map(team => (Array.isArray(team.players) ? team.players.length : 0))
        .filter(size => size > 0);

    let lambda = 0;
    if (sizes.length > 0) {
        const sizeRatio = Math.max(...sizes) / Math.min(...sizes);
        if (sizeRatio !== 1) {
            lambda = (Number(baseLambda) || 0) * (sizeRatio - 1);
        }
    }

    return { globalMean, lambda };
}

module.exports = { teamScoreParams };
