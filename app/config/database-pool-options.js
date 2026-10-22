/**
 * @fileoverview Opciones del pool de PostgreSQL a partir del entorno
 * Función pura: recibe el entorno y el número de workers, sin I/O.
 */

const os = require('os');

// max_connections del contenedor es 100; se reservan conexiones para psql, backup y updater
const DEFAULT_CONNECTION_BUDGET = 80;
const MIN_POOL_MAX = 2;

/**
 * Lee un entero del entorno; admite 0 y cae al valor por defecto si no es válido
 * @param {string|undefined} raw - Valor crudo
 * @param {number} fallback - Valor por defecto
 * @returns {number}
 */
function readInt(raw, fallback) {
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Número de workers que comparten la base de datos.
 * PM2 (`instances: 'max'`) arranca un worker por CPU y fija NODE_APP_INSTANCE en cada uno.
 * @param {Object} env - Entorno
 * @returns {number}
 */
function countWorkers(env) {
    if (env.DB_WORKERS) return Math.max(1, readInt(env.DB_WORKERS, 1));
    return env.NODE_APP_INSTANCE === undefined ? 1 : Math.max(1, os.cpus().length);
}

/**
 * Tamaño máximo del pool por worker, limitado para que la suma de todos
 * los workers no supere el presupuesto de conexiones del servidor.
 * @param {Object} env - Entorno
 * @returns {{ min: number, max: number }}
 */
function resolvePoolSize(env) {
    const requestedMax = Math.max(MIN_POOL_MAX, readInt(env.DB_POOL_MAX, 30));
    const budget = readInt(env.DB_CONNECTION_BUDGET, DEFAULT_CONNECTION_BUDGET);
    const perWorker = Math.max(MIN_POOL_MAX, Math.floor(budget / countWorkers(env)));
    const max = Math.min(requestedMax, perWorker);
    const min = Math.min(readInt(env.DB_POOL_MIN, 5), max);
    return { min, max };
}

/**
 * Construye las opciones de `new Pool()`
 * @param {Object} [env=process.env] - Entorno
 * @returns {Object} Opciones de pg.Pool
 */
function buildPoolOptions(env = process.env) {
    const statementTimeout = readInt(env.DB_STATEMENT_TIMEOUT, 30000);
    const worker = env.NODE_APP_INSTANCE === undefined ? 'main' : `w${env.NODE_APP_INSTANCE}`;

    return {
        user: env.DB_USER,
        host: env.DB_HOST,
        database: env.DB_NAME,
        password: env.DB_PASSWORD,
        port: readInt(env.DB_PORT, 5432),
        ...resolvePoolSize(env),
        idleTimeoutMillis: readInt(env.DB_IDLE_TIMEOUT, 20000),
        connectionTimeoutMillis: readInt(env.DB_CONNECTION_TIMEOUT, 5000),
        // Recicla conexiones viejas (fugas de memoria del backend, cambios de red en Docker)
        maxLifetimeSeconds: readInt(env.DB_MAX_LIFETIME, 1800),
        // Detecta sockets muertos (reinicio del contenedor, NAT) antes de que una query cuelgue
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        // Identifica cada worker en pg_stat_activity
        application_name: `xiro-${worker}`,
        // El servidor corta primero; query_timeout solo es el respaldo del cliente
        statement_timeout: statementTimeout,
        query_timeout: statementTimeout > 0 ? statementTimeout + 5000 : 0,
        // Un BEGIN sin COMMIT (bug o excepción) no puede retener bloqueos indefinidamente
        idle_in_transaction_session_timeout: readInt(env.DB_IDLE_IN_TX_TIMEOUT, 60000)
    };
}

module.exports = { buildPoolOptions, resolvePoolSize, countWorkers };
