/**
 * @fileoverview Hora del servidor en el navegador (presentador y móvil), para que el temporizador
 * del móvil cuente igual que el del presentador aunque sus relojes no coincidan.
 *
 * Mide el desfase como NTP en pequeño: varias idas y vueltas de 'clock-sync' una detrás de otra
 * y se queda con la de menor latencia, que es la que menos error tiene (la mitad de su ida y vuelta).
 * Sin respuesta del servidor usa la hora local: el temporizador del móvil es solo informativo.
 * Sin imports a propósito (se prueba en un vm).
 */

const SAMPLE_TIMEOUT_MS = 2000;

/**
 * Desfase servidor − local (ms) a partir de la muestra de menor ida y vuelta.
 * @param {Array<{sentAt: number, receivedAt: number, serverTime: number}>} samples
 * @returns {number|null} null sin muestras
 */
export function bestOffset(samples) {
    let best = null;
    samples.forEach(sample => {
        const rtt = sample.receivedAt - sample.sentAt;
        if (!best || rtt < best.rtt) best = { rtt, sample };
    });
    if (!best) return null;
    return Math.round(best.sample.serverTime - (best.sample.sentAt + best.rtt / 2));
}

function takeSample(socket, now) {
    return new Promise(resolve => {
        const sentAt = now();
        socket.timeout(SAMPLE_TIMEOUT_MS).emit('clock-sync', null, (err, reply) => {
            const serverTime = Number(reply && reply.serverTime);
            if (err || !Number.isFinite(serverTime)) return resolve(null);
            resolve({ sentAt, receivedAt: now(), serverTime });
        });
    });
}

/**
 * Reloj del servidor sobre un socket. Se vuelve a medir en cada reconexión.
 * @param {Object} socket - Socket.IO del cliente
 * @param {Object} [options]
 * @param {number} [options.samples=5] - Idas y vueltas por medición
 * @param {function(): number} [options.now=Date.now] - Reloj local (inyectable en tests)
 * @returns {{sync: function(): Promise<void>, ready: Promise<void>, now: function(): number,
 *   toLocal: function(number): number, isSynced: function(): boolean}}
 */
export function createServerClock(socket, { samples = 5, now = Date.now } = {}) {
    let offset = null;
    let markReady;
    // Se cumple al terminar la primera medición (con o sin respuesta del servidor)
    const ready = new Promise(resolve => {
        markReady = resolve;
    });

    async function sync() {
        const collected = [];
        for (let i = 0; i < samples; i++) {
            const sample = await takeSample(socket, now);
            if (sample) collected.push(sample);
        }
        const measured = bestOffset(collected);
        if (measured !== null) offset = measured;
        markReady();
    }

    socket.on('connect', () => {
        sync();
    });

    return {
        sync,
        ready,
        now: () => now() + (offset || 0),
        toLocal: serverMs => serverMs - (offset || 0),
        isSynced: () => offset !== null
    };
}
