/**
 * @fileoverview Espera a que el servidor vuelva tras el botón PANIC, en vez de recargar a ciegas
 * tras un tiempo fijo. Da por vuelto el servidor solo cuando /live viene de un proceso arrancado
 * después del clic (uptime menor que el tiempo transcurrido) y /ready contesta 200: justo tras el
 * clic el proceso viejo aún responde unos segundos y no debe confundirse con el nuevo.
 */

const SERVER_RESTART_PROBE_TIMEOUT_MS = 3000;

/**
 * GET con plazo propio: con el contenedor caído el proxy puede dejar la petición colgada.
 * @param {Function} fetchImpl
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function _restartProbe(fetchImpl, url) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), SERVER_RESTART_PROBE_TIMEOUT_MS) : null;
    try {
        return await fetchImpl(url, { cache: 'no-store', signal: controller?.signal });
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * ¿Atiende ya un proceso nuevo y listo?
 * @param {Function} fetchImpl
 * @param {number} elapsedMs - Tiempo desde el clic.
 * @returns {Promise<boolean>} false también si el servidor no responde o la respuesta no es JSON.
 */
async function _isFreshServerReady(fetchImpl, elapsedMs) {
    try {
        const live = await _restartProbe(fetchImpl, '/live');
        if (!live.ok) return false;
        const { uptime } = await live.json();
        if (!Number.isFinite(uptime) || uptime * 1000 > elapsedMs) return false;
        const ready = await _restartProbe(fetchImpl, '/ready');
        return ready.ok;
    } catch {
        // Caído, proxy con 502 en HTML o petición abortada: es lo esperado mientras reinicia.
        return false;
    }
}

/**
 * Sondea el servidor hasta que vuelve un proceso nuevo y listo, o hasta agotar el plazo.
 * @param {Object} [options]
 * @param {Function} [options.fetchImpl=fetch]
 * @param {Function} [options.now=Date.now]
 * @param {Function} [options.sleep] - (ms) => Promise; por defecto setTimeout.
 * @param {Function} [options.onTick] - Recibe los segundos transcurridos antes de cada intento.
 * @param {number} [options.pollMs=1000]
 * @param {number} [options.timeoutMs=120000]
 * @returns {Promise<boolean>} true si el servidor ha vuelto; false si se agotó el plazo.
 */
async function waitForServerRestart(options = {}) {
    const {
        fetchImpl = (...args) => fetch(...args),
        now = Date.now,
        sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
        onTick = () => {},
        pollMs = 1000,
        timeoutMs = 120000
    } = options;
    const startedAt = now();
    for (let elapsed = 0; elapsed < timeoutMs; elapsed = now() - startedAt) {
        onTick(Math.floor(elapsed / 1000));
        if (await _isFreshServerReady(fetchImpl, elapsed)) return true;
        await sleep(pollMs);
    }
    return false;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { waitForServerRestart };
}
