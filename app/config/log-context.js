/**
 * @fileoverview Contexto estándar de logs por worker
 */

function getWorkerContext(extra = {}) {
    return {
        workerId: process.env.NODE_APP_INSTANCE || 'unknown',
        pid: process.pid,
        ...extra
    };
}

module.exports = {
    getWorkerContext
};
