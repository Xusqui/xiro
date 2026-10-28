/**
 * @fileoverview Gauges que se leen en el momento del scrape (estado del worker).
 *
 * Los Maps de globalState son por worker y pueden repetir partidas sincronizadas
 * entre workers: en Prometheus se consultan con max(), no con sum(). Los sockets
 * y el pool de BD sí son propios de cada worker y se suman.
 */

const { client, registry } = require('./metrics-registry');

const CIRCUIT_STATE_VALUE = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 };

let io = null;

/** El socket manager inyecta io al arrancar. */
function setIO(ioInstance) {
    io = ioInstance;
}

// require diferido: database y globalState cargan el logger y Redis, y este
// módulo se carga desde la propia capa de BD.
function loadPool() {
    return require('../../config/database').pool;
}

function loadState() {
    return require('../../state/globalState');
}

new client.Gauge({
    name: 'xiro_socket_connections',
    help: 'Sockets conectados a este worker',
    registers: [registry],
    collect() {
        this.set(io?.of('/').sockets.size || 0);
    }
});

new client.Gauge({
    name: 'xiro_games',
    help: 'Partidas y salas en memoria de este worker (consultar con max)',
    labelNames: ['state'],
    registers: [registry],
    collect() {
        const { activeGames, lobbyPlayers } = loadState();
        this.set({ state: 'active' }, activeGames.size);
        this.set({ state: 'lobby' }, lobbyPlayers.size);
    }
});

new client.Gauge({
    name: 'xiro_db_pool_connections',
    help: 'Conexiones del pool de PostgreSQL de este worker',
    labelNames: ['state'],
    registers: [registry],
    collect() {
        const pool = loadPool();
        this.set({ state: 'total' }, pool.totalCount);
        this.set({ state: 'idle' }, pool.idleCount);
        this.set({ state: 'waiting' }, pool.waitingCount);
    }
});

new client.Gauge({
    name: 'xiro_db_circuit_state',
    help: 'Circuit breaker de la BD: 0 cerrado, 1 semiabierto, 2 abierto',
    labelNames: ['circuit'],
    registers: [registry],
    collect() {
        const stats = loadPool().getStats();
        for (const circuit of ['read', 'write']) {
            this.set({ circuit }, CIRCUIT_STATE_VALUE[stats[circuit]?.state] ?? 0);
        }
    }
});

module.exports = { setIO };
