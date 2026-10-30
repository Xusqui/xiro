/**
 * @fileoverview Monta las reacciones con emoji en directo para un servidor Socket.IO:
 * estado por sala (Redis + configuración de Interfaz), límite por socket y buffer que
 * emite las ráfagas a la sala del presentador. Ver handlers/ReactionHandler.js.
 */

'use strict';

const uiSettings = require('../../config/ui-settings');
const { getRedisClient, isRedisAvailable } = require('../../config/redis');
const { ReactionsState } = require('../utils/ReactionsState');
const { ReactionThrottle } = require('../utils/ReactionThrottle');
const { ReactionBurstBuffer } = require('../utils/ReactionBurstBuffer');
const { createReactionHandlers } = require('../handlers/ReactionHandler');

/**
 * @param {Object} deps
 * @param {Object} deps.io
 * @param {Map} deps.activeGames
 * @param {Map} deps.players
 */
function createReactionsFeature({ io, activeGames, players }) {
    const state = new ReactionsState({
        getClient: () => (isRedisAvailable() ? getRedisClient() : null),
        defaults: () => ({ enabled: uiSettings.get('emojiReactions'), set: uiSettings.get('reactionSet') })
    });
    const buffer = new ReactionBurstBuffer({
        emit: (roomId, counts) => io.to(`${roomId}:presenter`).volatile.emit('reactions', { c: counts })
    });
    return createReactionHandlers({ io, state, throttle: new ReactionThrottle(), buffer, activeGames, players });
}

module.exports = { createReactionsFeature };
