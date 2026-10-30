/**
 * @fileoverview Cuándo un jugador puede mandar una reacción con emoji en directo.
 *
 * Fuera de la pregunta siempre: lobby, diapositivas, revisión, tablero del Trivial o
 * pregunta ya revelada. Con la pregunta en juego, solo quien ya ve su resultado: en
 * individual, el jugador que ha respondido; en equipos, cuando todo su equipo ha
 * respondido (el servidor les manda 'answer-result' a la vez). Reglas puras: sin I/O.
 */

'use strict';

const { hasTimer } = require('./QuestionScoringPolicy');
const { hasAnswered } = require('./AnswerStateService');

/** ¿Hay una pregunta en juego sin revelar? */
function isQuestionOpen(game) {
    if (!game || game.reviewMode) return false;
    // Tablero del Trivial: no hay pregunta en juego hasta que se elige casilla
    if (game.isTrivial && !game.canAnswer) return false;
    const index = game.currentIndex;
    if (!hasTimer(game.questions?.[index])) return false;
    // En otros workers revealedQuestions puede ser un Set con las preguntas como
    // propiedades (RedisSyncBus): se lee igual
    return !game.revealedQuestions?.[index];
}

/** ¿El jugador ha respondido la pregunta en juego? En el Trivial el índice se reutiliza. */
function answeredCurrent(game, player) {
    if (!player) return false;
    if (game.isTrivial && game.trivialQuestionEpoch !== undefined) {
        return player.trivialAnswerEpoch === game.trivialQuestionEpoch;
    }
    return hasAnswered(player.answers, game.currentIndex);
}

/**
 * @param {Object} params
 * @param {Object|null} params.game - Partida activa (null en el lobby)
 * @param {Object|null} params.player - Registro del jugador (teamName en modo equipos)
 * @param {boolean} [params.teamDone] - Su equipo ya ha respondido entero (modo equipos)
 * @returns {boolean}
 */
function canReact({ game, player, teamDone = false }) {
    if (!isQuestionOpen(game)) return true;
    if (!answeredCurrent(game, player)) return false;
    return player.teamName ? teamDone === true : true;
}

/**
 * @param {Object} params
 * @param {{ enabled: boolean, set: string[] }} params.state - Estado de la sala
 * @param {*} params.reaction - Identificador recibido del cliente
 * @param {Object|null} params.game
 * @param {Object|null} params.player
 * @param {boolean} [params.teamDone]
 * @returns {{ ok: true } | { ok: false, reason: 'disabled'|'invalid-reaction'|'question-open' }}
 */
function evaluateReaction({ state, reaction, game, player, teamDone }) {
    if (!state?.enabled) return { ok: false, reason: 'disabled' };
    if (typeof reaction !== 'string' || !state.set.includes(reaction)) {
        return { ok: false, reason: 'invalid-reaction' };
    }
    if (!canReact({ game, player, teamDone })) return { ok: false, reason: 'question-open' };
    return { ok: true };
}

module.exports = { evaluateReaction, canReact, isQuestionOpen };
