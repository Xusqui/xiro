/**
 * @fileoverview Database services barrel export
 * @module services/db
 * 
 * Re-exports all domain-specific database modules from a single entry point.
 * Each module is focused on a single domain entity and stays under 200 lines.
 */

const pinService = require('./pin.service');
const bankService = require('./bank.service');
const gameService = require('./game.service');
const customGameService = require('./custom-game.service');
const quizService = require('./quiz.service');
const trivialService = require('./trivial.service');
const gameSessionService = require('./game-session.service');
const siteSettingsService = require('./site-settings.service');
const resourceOwnershipService = require('./resource-ownership.service');

module.exports = {
    // PIN validation
    ...pinService,

    // Question Banks
    ...bankService,

    // Games
    ...gameService,

    // Custom Games
    ...customGameService,

    // Quizzes
    ...quizService,

    // Trivial Games
    ...trivialService,

    // Game Sessions (post-game results)
    ...gameSessionService,

    // Site settings
    ...siteSettingsService,

    // Ownership helpers
    ...resourceOwnershipService
};
