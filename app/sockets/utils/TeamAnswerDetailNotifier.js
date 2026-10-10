/**
 * @fileoverview Notifica al presentador el contenido de cada respuesta en modo equipos.
 *
 * Emite `player-answer-detail` solo a la sala `${roomId}:presenter` (presentador
 * y remotos autenticados como admin). Lo usa el Bot Runner para que los bots de
 * un equipo puedan replicar la respuesta de un jugador concreto.
 */

const ANSWER_FIELDS = ['answerType', 'index', 'order', 'matches', 'selectedIndices', 'playerAnswer', 'found'];

function pickAnswer(data) {
    const answer = {};
    for (const field of ANSWER_FIELDS) {
        if (data[field] !== undefined) answer[field] = data[field];
    }
    return answer;
}

/**
 * @param {Object} params
 * @param {Object} params.io
 * @param {Map} params.players
 * @param {Map} params.teamConfigs
 * @param {Map} params.activeGames
 * @param {string|null} params.playerId
 * @param {Object} params.data - Payload original de submit-answer
 * @param {Object} params.result - Resultado del SubmitAnswerUseCase
 * @returns {boolean} true si se emitió
 */
function notifyTeamAnswerDetail({ io, players, teamConfigs, activeGames, playerId, data, result }) {
    if (!io || !data || !result?.success || result.duplicate || result.late || result.fromCache) return false;

    const player = playerId ? players?.get(playerId) : null;
    const roomId = player?.roomId || data.sessionId;
    if (!roomId || !teamConfigs?.get(roomId)?.isTeamMode) return false;

    const game = activeGames?.get(roomId);
    io.to(`${roomId}:presenter`).emit('player-answer-detail', {
        nickname: player?.nickname || data.nickname,
        teamName: player?.teamName || null,
        questionIndex: typeof game?.currentIndex === 'number' ? game.currentIndex : null,
        answer: pickAnswer(data)
    });
    return true;
}

module.exports = { notifyTeamAnswerDetail };
