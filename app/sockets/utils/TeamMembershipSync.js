/**
 * @fileoverview Cambios de pertenencia a equipos como operaciones idempotentes.
 *
 * Cada worker guarda su propia copia de la configuración de equipos. Si se
 * publicara el objeto entero, dos jugadores eligiendo equipo a la vez en workers
 * distintos se pisarían (gana el último en escribir). Publicando solo la
 * operación "nickname pasa al equipo X" (o "sale", con teamIndex null), todos los
 * workers aplican las mismas operaciones y convergen al mismo estado.
 */

/**
 * Aplica un cambio de equipo sobre una configuración de equipos
 * @param {Object} teamConfig - Configuración de equipos del room
 * @param {{nickname: string, teamIndex: (number|null)}} change - teamIndex null = salir de todos
 * @returns {boolean} true si la configuración cambió
 */
function applyTeamMembership(teamConfig, { nickname, teamIndex }) {
    if (!teamConfig?.isTeamMode || !Array.isArray(teamConfig.teams)) {
        return false;
    }

    const leaving = teamIndex === null || teamIndex === undefined;
    if (!leaving && !teamConfig.teams[teamIndex]) {
        return false;
    }

    let changed = false;
    teamConfig.teams.forEach((team, index) => {
        if (index === teamIndex || !Array.isArray(team.players)) {
            return;
        }
        for (let i = team.players.length - 1; i >= 0; i--) {
            if (team.players[i] === nickname) {
                team.players.splice(i, 1);
                changed = true;
            }
        }
    });

    if (!leaving) {
        const target = teamConfig.teams[teamIndex];
        if (!Array.isArray(target.players)) {
            target.players = [];
        }
        if (!target.players.includes(nickname)) {
            target.players.push(nickname);
            changed = true;
        }
    }

    return changed;
}

/**
 * Emite team-update solo a los sockets de este worker. Cada worker avisa a los
 * suyos tras aplicar un cambio (local o recibido por Redis), así nadie recibe la
 * vista de otro worker que aún no ha procesado todos los cambios.
 * @param {Object} io - Instancia de Socket.IO
 * @param {string} roomId - ID del room
 * @param {Object} teamConfig - Configuración de equipos ya actualizada
 */
function emitLocalTeamUpdate(io, roomId, teamConfig) {
    if (!io) {
        return;
    }
    const target = io.local || io;
    target.to(roomId).emit('team-update', { teams: teamConfig.teams });
}

module.exports = {
    applyTeamMembership,
    emitLocalTeamUpdate
};
