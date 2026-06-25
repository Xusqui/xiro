/**
 * @fileoverview Utility para remover jugadores del juego activo cuando se desconectan
 */

const logger = require('../../config/logger');
const { checkAllPlayersAnswered } = require('./IndividualModeHelper');
const { clearTimer } = require('./TimerManager');
const { revealAnswer, endGameIfLastQuestion } = require('./GameEndManager');
const { removeExpectedPlayer, acquireRevealLock } = require('./AtomicAnswerCounter');

/**
 * Remueve un jugador del juego activo y verifica si corresponde revelar
 * @param {Object} params
 * @param {string} params.roomId - ID de la sala
 * @param {string} params.nickname - Nickname del jugador
 * @param {Map} params.activeGames - Map de juegos activos
 * @param {Map} params.players - Map global de players
 * @param {Object} params.io - Socket.IO server instance
 * @returns {boolean} true si se removió el jugador del juego
 */
async function removePlayerFromActiveGame({ roomId, nickname, activeGames, players, io }) {
    const game = activeGames.get(roomId);

    if (!game || !game.players) {
        return false;
    }

    // Remover jugador del array de jugadores del juego
    const playerIndex = game.players.indexOf(nickname);
    if (playerIndex === -1) {
        return false;
    }

    game.players.splice(playerIndex, 1);
    logger.debug(`${nickname} removido del juego activo. Jugadores restantes: ${game.players.length}`);

    // Si el juego está en progreso (canAnswer = true), verificar si los demás ya respondieron.
    // Para modo trivial esta lógica se gestiona por epoch en TrivialAnswerGuard.
    if (game.canAnswer && game.currentIndex !== undefined && !game.isTrivial) {
        let allAnswered = false;

        try {
            const progress = await removeExpectedPlayer({ roomId, nickname });
            allAnswered = progress.allAnswered;
            logger.debug('Expected counter updated after player removal', {
                roomId,
                nickname,
                expectedCount: progress.expectedCount,
                answeredCount: progress.answeredCount,
                allAnswered
            });
        } catch (err) {
            logger.warn('Failed to update expected counter after player removal', {
                roomId,
                nickname,
                error: err.message
            });
            allAnswered = await checkAllPlayersAnswered(game, players, io, game.currentIndex);
        }

        if (allAnswered) {
            logger.info('Todos los jugadores restantes respondieron - revelando resultados', {
                roomId,
                questionIndex: game.currentIndex
            });

            // Cancelar timer actual si existe
            clearTimer(roomId);

            const revealLockAcquired = await acquireRevealLock({ roomId, questionIndex: game.currentIndex });
            if (!revealLockAcquired) {
                logger.debug('Reveal lock not acquired after player removal', {
                    roomId,
                    questionIndex: game.currentIndex
                });
                return true;
            }

            await revealAnswer({ roomId, game, io, timeExpired: false });
            await endGameIfLastQuestion({ game, roomId, io });
        }
    }

    return true;
}

module.exports = {
    removePlayerFromActiveGame
};
