/**
 * @fileoverview Número de personas que jugaron una sesión, para el historial.
 *
 * El ranking no sirve para esto: en modo equipos tiene una fila por equipo,
 * así que una partida de 4 personas en 2 equipos se guardaba con 2 jugadores.
 */

/**
 * @param {Object} params
 * @param {Array<{players?: string[]}>} [params.teams] - Equipos (modo equipos)
 * @param {string[]|Object} [params.players] - Jugadores, en lista o como mapa nickname -> datos
 * @param {Array} [params.ranking] - Ranking final, solo como último recurso
 * @returns {number}
 */
function countSessionPlayers({ teams, players, ranking = [] }) {
    if (Array.isArray(teams)) {
        const people = new Set(teams.flatMap(team => (Array.isArray(team.players) ? team.players : [])));
        if (people.size > 0) {
            return people.size;
        }
    }

    const list = Array.isArray(players) ? players : Object.keys(players || {});
    return list.length || ranking.length;
}

module.exports = { countSessionPlayers };
