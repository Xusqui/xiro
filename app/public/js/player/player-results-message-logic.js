/**
 * @fileoverview Lógica pura de selección del mensaje de cierre de partida
 * (pantalla "player-final-position"), según posición relativa y puntuación.
 */

(function attachPlayerResultsMessageLogic(root) {
    /**
     * Decide qué mensaje mostrar bajo la puntuación final.
     * Antes, el mensaje se elegía solo por posición absoluta (1/2/3), por lo
     * que el último puesto de una partida de 2 jugadores caía en la rama
     * "position === 2" y mostraba "¡Excelente resultado!" aunque tuviera 0 pts.
     */
    function resolveFinalPositionMessage({ position, totalPlayers, score }) {
        const isChampion = position === 1;
        const isLastPlace = totalPlayers > 0 && position === totalPlayers;
        const isLowPerformance = !isChampion && (isLastPlace || Number(score) === 0);

        if (isChampion) {
            return { key: 'player.results.champion', fallback: '¡CAMPEÓN!' };
        }

        if (isLowPerformance) {
            return { key: 'player.results.keep_practicing', fallback: '¡Sigue practicando!' };
        }

        if (position === 2) {
            return { key: 'player.results.excellent', fallback: '¡Excelente resultado!' };
        }

        if (position === 3) {
            return { key: 'player.results.great_job', fallback: '¡Gran trabajo!' };
        }

        return null;
    }

    const api = { resolveFinalPositionMessage };

    if (root) {
        root.PlayerResultsMessageLogic = api;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));
