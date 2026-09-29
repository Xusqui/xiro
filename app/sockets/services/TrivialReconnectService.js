'use strict';

/**
 * @fileoverview TrivialReconnectService
 *
 * Reads the current trivial board phase from Redis and re-emits the exact
 * socket event that originally showed that screen to the player.
 *
 * This gives reconnecting players "same exact screen" restoration without
 * any new frontend code — the existing player-trivial-socket.js handlers
 * handle trivial-turn-changed, trivial-dice-rolled and trivial-choose-category
 * exactly as they do during normal gameplay.
 *
 * Board phases:
 *   waiting_roll        → re-emit trivial-turn-changed
 *   waiting_move        → re-emit trivial-dice-rolled
 *   choosing_category   → re-emit trivial-choose-category
 *
 * Non-board phases (waiting_answer, showing_result) are handled by the
 * standard reconnect snapshot path in ReconnectionService.
 */

const trivialGameState = require('./TrivialGameState');
const { getCategoryForPosition } = require('./TrivialBoardGraph');
const logger = require('../../config/logger');

const BOARD_PHASES = new Set(['waiting_roll', 'waiting_move', 'choosing_category']);

/**
 * Reads the Redis trivial state for roomId and returns board phase info.
 * Returns null if the room is not in a board phase or on error.
 *
 * @param {string} roomId
 * @returns {Promise<{isBoardPhase:boolean, phase:string, actorNick:string,
 *   diceValue:number|null, availablePositions:string[],
 *   positionColors:string[], categories:Object[]|null}|null>}
 */
async function getTrivialBoardInfo(roomId) {
    try {
        const state = await trivialGameState.getTrivialState(roomId);
        if (!state) return null;

        const phase = state.phase;
        const isBoardPhase = BOARD_PHASES.has(phase);
        const actorNick = trivialGameState.getCurrentTurnActor(state) || null;

        // Compute position colors (same logic as TrivialSocketHandler.handleRollDice)
        let positionColors = [];
        if (phase === 'waiting_move' && state.availablePositions?.length) {
            try {
                const { N, M, cgPositions } = state.board;
                positionColors = state.availablePositions.map(p => {
                    const catIdx = getCategoryForPosition(p, N, M, cgPositions);
                    if (catIdx === null || !state.categories[catIdx]) return '#6b7280';
                    return state.categories[catIdx].color;
                });
            } catch (e) {
                positionColors = [];
            }
        }

        // Build categories list for choosing_category phase
        let categories = null;
        if (phase === 'choosing_category' && state.categories) {
            categories = state.categories.map((cat, idx) => ({
                index: idx,
                name: cat.bank_name || cat.category_name || cat.name || `Categoría ${idx + 1}`,
                color: cat.color || '#888'
            }));
        }

        return {
            isBoardPhase,
            phase,
            actorNick,
            diceValue: state.diceValue ?? null,
            availablePositions: state.availablePositions || [],
            positionColors,
            categories
        };
    } catch (err) {
        logger.error('TrivialReconnectService.getTrivialBoardInfo: error', {
            roomId, error: err.message
        });
        return null;
    }
}

/**
 * Emits the correct board event to a single socket so the player's screen
 * is restored to the exact state it was in before disconnecting.
 *
 * @param {Object} socket - Socket.IO socket of the reconnecting player
 * @param {Object} boardInfo - Result of getTrivialBoardInfo()
 */
function emitBoardEventToSocket(socket, boardInfo) {
    if (!boardInfo?.isBoardPhase) return;
    const { phase, actorNick, diceValue, availablePositions, positionColors, categories } = boardInfo;

    if (phase === 'waiting_roll') {
        socket.emit('trivial-turn-changed', { currentTurn: actorNick, rollAgain: false });
        logger.debug('TrivialReconnectService: emitted trivial-turn-changed (reconnect)', { actorNick });

    } else if (phase === 'waiting_move') {
        const positionLabels = availablePositions.map((_, i) => String.fromCharCode(65 + i));
        socket.emit('trivial-dice-rolled', {
            nickname: actorNick,
            diceValue: diceValue ?? 1,
            availablePositions,
            positionLabels,
            positionColors
        });
        logger.debug('TrivialReconnectService: emitted trivial-dice-rolled (reconnect)', {
            actorNick, positions: availablePositions.length
        });

    } else if (phase === 'choosing_category') {
        socket.emit('trivial-choose-category', { categories: categories || [], actorNick });
        logger.debug('TrivialReconnectService: emitted trivial-choose-category (reconnect)', { actorNick });
    }
}

module.exports = { getTrivialBoardInfo, emitBoardEventToSocket };
