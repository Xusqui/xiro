/**
 * @fileoverview Database service facade (backward-compatible re-export)
 * 
 * REFACTORED: This file now delegates to domain-specific modules in ./db/
 * Each module is under 200 lines:
 *   - db/pin.service.js       — PIN validation, lookup
 *   - db/bank.service.js      — Question Banks CRUD
 *   - db/game.service.js      — Games CRUD + question loading
 *   - db/custom-game.service.js — Custom Games CRUD
 *   - db/quiz.service.js      — Quizzes CRUD (legacy)
 * 
 * Existing consumers can keep `require('./db.service')` without changes.
 */

module.exports = require('./db/index');
