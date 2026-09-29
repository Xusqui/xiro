/**
 * @fileoverview Exportaciones de Strategy Pattern para modos de juego
 */

const GameModeStrategy = require('./GameModeStrategy');
const IndividualGameMode = require('./IndividualGameMode');
const TeamGameMode = require('./TeamGameMode');
const GameModeFactory = require('./GameModeFactory');

module.exports = {
    GameModeStrategy,
    IndividualGameMode,
    TeamGameMode,
    GameModeFactory
};
