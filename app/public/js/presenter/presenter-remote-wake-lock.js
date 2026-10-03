/**
 * @fileoverview Wake Lock controller for the presenter screen and remote mode.
 * Keeps screens awake while the presenter view or the remote control is active.
 *
 * iOS Safari requires that navigator.wakeLock.request() is called
 * synchronously within a user-gesture call stack (click / touchstart).
 * Timer callbacks and socket events do NOT qualify as user gestures on WebKit.
 *
 * Strategy:
 *  1. activateFromGesture() — called directly from button click/touch handlers.
 *  2. bindWakeLockGestureFallback() — captures the next user interaction on the
 *     whole remote panel if the first attempt fails (NotAllowedError).
 *  3. visibilitychange — marks a "pending" flag so the next user touch triggers
 *     re-acquisition instead of calling wakeLock.request() from a timer.
 *  4. Watchdog setInterval — only used on non-iOS browsers where timers qualify.
 */

const DEBUG = new URLSearchParams(window.location.search).has('wldebug');

/**
 * Creates an isolated wake lock controller.
 *
 * @param {Object} deps
 * @param {() => boolean} deps.hasActiveSessionContext
 * @returns {{ setup: () => void, activate: (source?: string) => Promise<void>, activateFromGesture: (source?: string) => Promise<void> }}
 */
export function createRemoteWakeLockController({ hasActiveSessionContext }) {
    let remoteWakeLock = null;
    let wakeLockWatchdogId = null;
    let wakeGestureFallbackBound = false;
    let pendingReacquire = false; // set true when lock is lost and waiting for next gesture
    let lastNotAllowedLogAt = 0;

    // ── Debug helpers ─────────────────────────────────────────────────────

    function dbgLog(msg, data) {
        if (!DEBUG) return;
        console.warn(`[WakeLock] ${msg}`, data ?? '');
    }

    function dbgBadge(state) {
        if (!DEBUG) return;
        let badge = document.getElementById('__wl_debug_badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = '__wl_debug_badge';
            Object.assign(badge.style, {
                position: 'fixed', top: '4px', right: '4px', zIndex: '99999',
                padding: '2px 8px', borderRadius: '8px', fontSize: '11px',
                fontWeight: 'bold', color: '#fff', pointerEvents: 'none'
            });
            document.body.appendChild(badge);
        }
        const map = {
            active: { text: '🔋 WL activo', bg: '#16a34a' },
            pending: { text: '⏳ WL pendiente', bg: '#d97706' },
            denied: { text: '🚫 WL denegado', bg: '#dc2626' },
            released: { text: '💤 WL liberado', bg: '#9a6ba9' },
            unsupported: { text: '❌ WL no soportado', bg: '#6b7280' }
        };
        const s = map[state] ?? { text: state, bg: '#1e293b' };
        badge.style.background = s.bg;
        badge.textContent = _t(s.text);
    }

    // ── Internal helpers ──────────────────────────────────────────────────

    function isSupported() {
        return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    }

    function logNotAllowedThrottled(source) {
        const now = Date.now();
        if (now - lastNotAllowedLogAt < 60000) return;
        lastNotAllowedLogAt = now;
        dbgLog('NotAllowedError — esperando gesto', { source });
        dbgBadge('denied');
    }

    /**
     * Binds a one-shot capture listener on the whole document so that the
     * very next user touch/click attempts re-acquisition.
     * Called after NotAllowedError OR after visibilitychange marks pendingReacquire.
     */
    function bindWakeLockGestureFallback() {
        if (wakeGestureFallbackBound) return;
        wakeGestureFallbackBound = true;
        dbgLog('Fallback registrado — esperando próximo gesto');
        dbgBadge('pending');

        const tryOnGesture = async () => {
            if (!hasActiveSessionContext()) return;

            await _doRequest('gesture-fallback');

            // Self-remove only if lock was successfully acquired
            if (remoteWakeLock && !remoteWakeLock.released) {
                document.removeEventListener('click', tryOnGesture, true);
                document.removeEventListener('touchstart', tryOnGesture, true);
                document.removeEventListener('keydown', tryOnGesture, true);
                wakeGestureFallbackBound = false;
                pendingReacquire = false;
            }
        };

        document.addEventListener('click', tryOnGesture, true);
        document.addEventListener('touchstart', tryOnGesture, true);
        document.addEventListener('keydown', tryOnGesture, true);
    }

    /**
     * Core request — calls navigator.wakeLock.request().
     * Must be reachable synchronously from a user-gesture stack on iOS.
     */
    async function _doRequest(source) {
        if (document.visibilityState !== 'visible') {
            dbgLog('Saltado — documento no visible', { source });
            return;
        }
        if (remoteWakeLock && !remoteWakeLock.released) {
            dbgLog('Ya activo', { source });
            return;
        }
        if (!isSupported()) {
            console.warn('[WakeLock] Wake Lock API no disponible en este navegador.');
            dbgBadge('unsupported');
            return;
        }

        try {
            remoteWakeLock = await navigator.wakeLock.request('screen');
            dbgLog('Activado ✓', { source });
            dbgBadge('active');

            remoteWakeLock.addEventListener('release', () => {
                dbgLog('Liberado por el SO/navegador', {
                    visibility: document.visibilityState
                });
                dbgBadge('released');
                remoteWakeLock = null;
                pendingReacquire = true;

                // On non-iOS browsers a timer can re-acquire; on iOS we
                // must wait for the next user gesture (fallback already bound).
                if (document.visibilityState === 'visible' && hasActiveSessionContext()) {
                    bindWakeLockGestureFallback();
                }
            });
        } catch (err) {
            if (err?.name === 'NotAllowedError') {
                logNotAllowedThrottled(source);
                bindWakeLockGestureFallback();
                return;
            }
            console.warn('[WakeLock] Error inesperado:', err?.name, err?.message, { source });
            dbgBadge('denied');
            bindWakeLockGestureFallback();
        }
    }

    // ── Watchdog (non-iOS fallback) ───────────────────────────────────────

    function ensureWakeLockWatchdog() {
        if (wakeLockWatchdogId) return;

        // On iOS this will never successfully re-acquire (not a gesture), but
        // it is harmless and works fine on Android Chrome / desktop browsers.
        wakeLockWatchdogId = setInterval(async () => {
            if (document.visibilityState !== 'visible' || !hasActiveSessionContext()) return;
            if (!remoteWakeLock || remoteWakeLock.released) {
                dbgLog('Watchdog — reintentando');
                await _doRequest('watchdog');
            }
        }, 10000);
    }

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Activate from a non-gesture context (timers, socket events).
     * Works on Android/desktop. On iOS, marks pendingReacquire and registers
     * the gesture fallback so the next touch triggers re-acquisition.
     */
    async function activate(source = 'unknown') {
        if (remoteWakeLock && !remoteWakeLock.released) return;
        await _doRequest(source);
        // If it failed (iOS), ensure the gesture fallback is waiting
        if (!remoteWakeLock || remoteWakeLock.released) {
            pendingReacquire = true;
            bindWakeLockGestureFallback();
        }
    }

    /**
     * Activate synchronously from within a user-gesture handler (click / touch).
     * This is the path that satisfies iOS Safari's policy.
     * Call this directly from every button click handler in presenter-remote.js.
     */
    async function activateFromGesture(source = 'gesture') {
        if (remoteWakeLock && !remoteWakeLock.released && !pendingReacquire) return;
        dbgLog('activateFromGesture', { source });
        await _doRequest(source);
    }

    /**
     * Sets up the watchdog and the visibilitychange listener.
     * Must be called once on init.
     */
    function setup() {
        ensureWakeLockWatchdog();

        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && hasActiveSessionContext()) {
                // On iOS we cannot reliably call request() here (not a gesture).
                // Mark as pending so activateFromGesture() picks it up on next tap.
                if (!remoteWakeLock || remoteWakeLock.released) {
                    dbgLog('visibilitychange visible — registrando fallback para próximo gesto');
                    pendingReacquire = true;
                    bindWakeLockGestureFallback();

                    // On non-iOS browsers this may succeed immediately:
                    await _doRequest('visibility-visible');
                }
            } else if (document.visibilityState !== 'visible') {
                dbgLog('visibilitychange — segundo plano');
            }
        });
    }

    return {
        setup,
        activate,
        activateFromGesture
    };
}
