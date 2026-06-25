/**
 * @fileoverview Índice de queries CQRS
 * @module application/queries
 */

const Query = require('./Query');
const GetGameStateQuery = require('./GetGameStateQuery');
const GetRankingQuery = require('./GetRankingQuery');
const GetPlayerStatsQuery = require('./GetPlayerStatsQuery');
const GetActiveSessionsQuery = require('./GetActiveSessionsQuery');

module.exports = {
    Query,
    GetGameStateQuery,
    GetRankingQuery,
    GetPlayerStatsQuery,
    GetActiveSessionsQuery
};
