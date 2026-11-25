/**
 * @fileoverview Estadísticas de carga por worker y su agregado de cluster.
 *
 * En PM2 cluster cada worker solo ve sus propios sockets, y `activeGames`/`players`
 * se replican entre workers por RedisSyncBus: sumar sus tamaños contaría dos veces.
 * Por eso cada worker publica lo que de verdad es suyo (sockets conectados en su
 * adaptador local) y los ids de sala, que el agregado une sin repetir.
 */

const MB = 1024 * 1024;
const PLAYERS_SUFFIX = ':players';
const PRESENTER_SUFFIX = ':presenter';

/**
 * Calcula las estadísticas de este worker a partir de sus salas locales.
 * @param {Object} input
 * @param {Map<string, Set<string>>|null} input.rooms - Salas del adaptador local de Socket.IO
 * @param {Map<string, Object>} input.activeGames - Partidas iniciadas conocidas por el worker
 * @param {{heapUsed: number, rss: number}} input.memoryUsage - process.memoryUsage()
 * @param {number} input.requestsPerMinute - Peticiones HTTP del último minuto en este worker
 * @returns {{playerSockets: number, gameIds: string[], lobbyIds: string[],
 *   heapUsedMB: number, rssMB: number, requestsPerMinute: number}}
 */
function collectLocalWorkerStats({ rooms, activeGames, memoryUsage, requestsPerMinute }) {
    let playerSockets = 0;
    const gameIds = [];
    const lobbyIds = [];

    for (const [name, sockets] of rooms || []) {
        if (name.endsWith(PLAYERS_SUFFIX)) playerSockets += sockets.size;
        if (!name.endsWith(PRESENTER_SUFFIX) || sockets.size === 0) continue;
        const roomId = name.slice(0, -PRESENTER_SUFFIX.length);
        (activeGames.has(roomId) ? gameIds : lobbyIds).push(roomId);
    }

    return {
        playerSockets,
        gameIds,
        lobbyIds,
        heapUsedMB: Math.round(memoryUsage.heapUsed / MB),
        rssMB: Math.round(memoryUsage.rss / MB),
        requestsPerMinute: Number(requestsPerMinute) || 0
    };
}

function sumField(statsList, field) {
    return statsList.reduce((total, stats) => total + (Number(stats[field]) || 0), 0);
}

function countUnique(statsList, field) {
    return new Set(statsList.flatMap(stats => stats[field] || [])).size;
}

/**
 * Une las estadísticas publicadas por los workers en el registro.
 * @param {Array<{pid: number, stats?: Object}>|null} workerList - Entradas de WorkerRegistry
 * @returns {{players: number, games: number, lobbies: number, rssMB: number, heapUsedMB: number,
 *   requestsPerMinute: number, reportingWorkers: number, totalWorkers: number}|null}
 *   null si ningún worker ha publicado estadísticas
 */
function aggregateWorkerStats(workerList) {
    const statsList = (workerList || []).map(worker => worker.stats).filter(Boolean);
    if (statsList.length === 0) return null;

    return {
        players: sumField(statsList, 'playerSockets'),
        games: countUnique(statsList, 'gameIds'),
        lobbies: countUnique(statsList, 'lobbyIds'),
        rssMB: sumField(statsList, 'rssMB'),
        heapUsedMB: sumField(statsList, 'heapUsedMB'),
        requestsPerMinute: sumField(statsList, 'requestsPerMinute'),
        reportingWorkers: statsList.length,
        totalWorkers: workerList.length
    };
}

/**
 * Crea la función que WorkerRegistry llama en cada refresco para publicar este worker.
 * @param {import('socket.io').Server} io
 * @returns {() => ReturnType<typeof collectLocalWorkerStats>}
 */
function createLocalStatsProvider(io) {
    // Requeridos aquí para que el módulo puro no arrastre el estado global al importarse
    const { activeGames } = require('../../state/globalState');
    const metrics = require('../../state/metrics');

    return () =>
        collectLocalWorkerStats({
            rooms: io?.sockets?.adapter?.rooms || null,
            activeGames,
            memoryUsage: process.memoryUsage(),
            requestsPerMinute: metrics.getMetrics().http?.requests_per_minute
        });
}

module.exports = { collectLocalWorkerStats, aggregateWorkerStats, createLocalStatsProvider };
