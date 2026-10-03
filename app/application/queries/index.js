/**
 * @fileoverview Índice de queries CQRS
 * @module application/queries
 */

const Query = require('./Query');
const GetGameStateQuery = require('./GetGameStateQuery');
const GetActiveSessionsQuery = require('./GetActiveSessionsQuery');

module.exports = {
    Query,
    GetGameStateQuery,
    GetActiveSessionsQuery
};
