/**
 * @fileoverview Efectos del revelado de una pregunta: revelado a equipos, puntuaciones de equipo, emisión
 * de los payloads al presentador y a los jugadores, ranking, transición de la máquina de estados y
 * anuncio de las estadísticas. Lo usa GameEndManager.revealAnswer.
 */

const { roundScore } = require('../../services/game.logic');
const { revealToUnrevealedTeams, addTeamScoresToPayload } = require('./TeamManager');
const EventBus = require('../../domain/events/EventBus');
const { AnswerRevealedEvent } = require('../../domain/events/GameEvents');
const { logVoteDistribution } = require('./VoteDistributionLogger');
const { buildPlayerRevealPayload } = require('./RevealTypePayloads');
const { saveRevealPayload } = require('./RevealPayloadStore');
const { canGoBack } = require('../../domain/services/SlideNavigationPolicy');
const logger = require('../../config/logger');

/**
 * En modo equipos revela la pregunta a los equipos que aún no la veían. Un fallo se registra y no se relanza.
 * @param {Object} input - { isTeamMode, game, teamConfigData, currentQuestion, io, roomId }
 * @returns {Promise<void>}
 */
async function revealToUnrevealedTeamsIfNeeded(input) {
    const { isTeamMode, game, teamConfigData, currentQuestion, io, roomId } = input;

    if (!isTeamMode) {
        return;
    }

    try {
        await revealToUnrevealedTeams(game, teamConfigData, currentQuestion, io, roomId);
    } catch (err) {
        logger.error('Error en revealToUnrevealedTeams:', err.message);
    }
}

/**
 * En modo equipos añade las puntuaciones de equipo al payload del presentador. Un fallo se registra y no se relanza.
 * @param {boolean} isTeamMode - Si la partida es por equipos
 * @param {Object} presenterPayload - Payload (se modifica)
 * @param {Object} teamConfigData - Configuración de equipos
 * @param {Object<string, number>} scores - Puntuaciones por apodo
 * @returns {void}
 */
function addTeamScoresIfNeeded(isTeamMode, presenterPayload, teamConfigData, scores) {
    if (!isTeamMode) {
        return;
    }

    try {
        addTeamScoresToPayload(presenterPayload, teamConfigData, scores || {});
    } catch (err) {
        logger.error('Error en addTeamScoresToPayload:', err.message);
    }
}

/**
 * Emite 'reveal-answer' al presentador (payload completo) y a los jugadores (reducido). Guarda el payload en la partida
 * y en Redis para revisarlo o reconectar desde otro worker.
 * @param {Object} io - Instancia de Socket.IO
 * @param {string} roomId - ID de sesión
 * @param {Object} game - Partida activa
 * @param {number} revealIndex - Pregunta que se revela
 * @param {Object} presenterPayload - Payload (se le añaden isTrivial y canGoBack)
 * @returns {void}
 */
function emitRevealPayloads(io, roomId, game, revealIndex, presenterPayload) {
    // Authoritative trivial flag: the presenter relies on this to label the
    // "next" button ("Siguiente Ronda" vs "Ver Ránking"). window.isTrivialGame
    // can be stale after a presenter reload/reconnection, so stamp it here.
    presenterPayload.isTrivial = !!game.isTrivial;
    // Juegos personalizados: el presentador ofrece "Anterior" ya revelada la pregunta
    presenterPayload.canGoBack = canGoBack(game);

    game.revealPayloads = game.revealPayloads || {};
    game.revealPayloads[revealIndex] = presenterPayload;
    // Para revisar la pregunta desde un worker que no la tenga en memoria
    saveRevealPayload(roomId, revealIndex, presenterPayload);

    io.to(roomId + ':presenter').emit('reveal-answer', presenterPayload);
    io.to(roomId + ':players').emit('reveal-answer', buildPlayerRevealPayload(presenterPayload));
}

/**
 * Emite 'ranking-update' al presentador y a los jugadores, ordenado de mayor a menor puntuación.
 * @param {Object} io - Instancia de Socket.IO
 * @param {string} roomId - ID de sesión
 * @param {Object<string, number>} scores - Puntuaciones por apodo
 * @returns {void}
 */
function emitRankingUpdates(io, roomId, scores) {
    const rankingUpdate = Object.entries(scores || {})
        .map(([nickname, score]) => ({ nickname, score: roundScore(score) }))
        .sort((a, b) => b.score - a.score);

    io.to(roomId + ':presenter').emit('ranking-update', { ranking: rankingUpdate });
    io.to(roomId + ':players').emit('ranking-update', { ranking: rankingUpdate });
}

/**
 * Avanza la máquina de estados de la partida tras el revelado si estaba en questionActive. Los fallos se registran y no
 * se relanzan.
 * @param {string} roomId - ID de sesión
 * @param {Object} game - Partida activa
 * @returns {void}
 */
function transitionRevealStateMachine(roomId, game) {
    try {
        const { getOrCreateAdapter } = require('../../domain/state/GameStateAdapter');
        if (!game.questions || game.questions.length === 0) {
            logger.warn('No questions available for state machine, skipping transition');
            return;
        }

        const adapter = getOrCreateAdapter(roomId, game.questions, game.teamMode);
        if (adapter && adapter.getCurrentState() === 'questionActive') {
            adapter.timeUp();
            adapter.scoringComplete();
            logger.debug(`SM after reveal: ${adapter.getCurrentState()}`);
        }
    } catch (err) {
        logger.error('State machine error in revealAnswer (non-critical):', err.message);
    }
}

/** Registra el reparto de votos y emite el evento de dominio 'answer.revealed'. */
function announceRevealedStats({ roomId, revealIndex, question, stats, correctIndex, timeExpired }) {
    logVoteDistribution({
        roomId,
        questionIndex: revealIndex,
        question,
        stats,
        trigger: timeExpired ? 'timeout' : 'all-answered'
    });

    EventBus.emit(
        'answer.revealed',
        new AnswerRevealedEvent({
            gameId: roomId,
            questionIndex: revealIndex,
            correctIndex,
            stats
        })
    );
}

module.exports = {
    revealToUnrevealedTeamsIfNeeded,
    addTeamScoresIfNeeded,
    emitRevealPayloads,
    emitRankingUpdates,
    transitionRevealStateMachine,
    announceRevealedStats
};
