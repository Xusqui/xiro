/**
 * @fileoverview Intro de partida: logo de Xiro! animado + cuenta atrás 3-2-1-0.
 *
 * Se muestra en presentador, TV y móviles antes de la primera pregunta (o del
 * tablero en Trivial) si el administrador la tiene activada en Interfaz. Igual
 * que la pantalla de puntuación aleatoria, el servidor gatea la espera: no se
 * emite el arranque de la partida hasta que termina, y en las partidas de banco
 * se vuelve a sellar `questionStartTime` para que la intro no se coma el bonus
 * de tiempo de la primera pregunta.
 *
 * @module sockets/utils/GameIntroManager
 */

'use strict';

const logger = require('../../config/logger');
const uiSettings = require('../../config/ui-settings');
const { GAME_INTRO } = require('../../config/game-constants');
const { restampQuestionEpoch } = require('./RandomPointsRevealManager');

const INTRO_EVENT = 'game-intro';

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isIntroEnabled() {
    return uiSettings.get('animacionInicio') !== false;
}

/**
 * ¿Sigue la partida en pie tras la espera? Cubre que el presentador la cierre
 * o que se reinicie la sesión mientras se ve la intro.
 */
function introStillValid(activeGames, roomId, game) {
    return !game.ended && activeGames.get(roomId) === game;
}

/**
 * Muestra la intro si está activada y espera su duración.
 *
 * @param {Object} params
 * @param {Map} params.activeGames
 * @param {string} params.roomId
 * @param {Object} params.io
 * @param {Object} [params.syncBus]
 * @param {boolean} [params.restampQuestion=true] - false en Trivial (no hay pregunta en curso)
 * @returns {Promise<boolean>} true si se puede continuar con el arranque;
 *   false si la partida cambió durante la intro y NO debe arrancarse.
 */
async function runGameIntro({ activeGames, roomId, io, syncBus, restampQuestion = true }) {
    const game = activeGames.get(roomId);
    if (!game || !isIntroEnabled()) {
        return true;
    }

    const payload = { durationMs: GAME_INTRO.DURATION_MS, startedAt: Date.now() };

    io.to(`${roomId}:players`).emit(INTRO_EVENT, payload);
    io.to(`${roomId}:presenter`).emit(INTRO_EVENT, payload);

    game.gameIntro = { ...payload };
    logger.info('Game intro shown', { roomId, durationMs: payload.durationMs });

    await delay(payload.durationMs);

    game.gameIntro = null;

    if (!introStillValid(activeGames, roomId, game)) {
        logger.info('Game intro aborted: game ended or replaced during the intro', { roomId });
        return false;
    }

    if (restampQuestion) {
        await restampQuestionEpoch({ game, roomId, syncBus });
    }

    return true;
}

/**
 * Estado de la intro para los snapshots de reconexión: si sigue en pantalla,
 * quien se reincorpora la ve el tiempo que le queda.
 *
 * @param {Object} game
 * @returns {Object} Campos a mezclar en el snapshot (vacío si no aplica)
 */
function buildReconnectIntroState(game) {
    const intro = game?.gameIntro;
    if (!intro) return {};

    const remainingMs = Math.max(0, intro.startedAt + intro.durationMs - Date.now());
    return remainingMs > 0 ? { gameIntro: { ...intro, remainingMs } } : {};
}

module.exports = {
    INTRO_EVENT,
    isIntroEnabled,
    runGameIntro,
    buildReconnectIntroState,
};
