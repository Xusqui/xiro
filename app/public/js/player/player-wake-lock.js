/**
 * @fileoverview Gestión centralizada de Wake Lock para jugadores
 */

import { getPin, getNickname, getWakeLock, setWakeLock } from './player-state.js?v=20260708162526';

let wakeLockWatchdogId = null;
let wakeGestureFallbackBound = false;
let lastWakeLockNotAllowedLogAt = 0;

function hasActiveSessionContext() {
    return Boolean(
        (getPin() && getNickname())
        || (localStorage.getItem('xiro_lastPin') && localStorage.getItem('xiro_lastNickname'))
    );
}

function logNotAllowedThrottled(source, err) {
    const now = Date.now();
    if (now - lastWakeLockNotAllowedLogAt < 60000) {
        return;
    }
    lastWakeLockNotAllowedLogAt = now;
}

function bindWakeLockGestureFallback() {
    if (wakeGestureFallbackBound) {
        return;
    }

    wakeGestureFallbackBound = true;

    const tryOnGesture = async () => {
        if (!hasActiveSessionContext()) {
            return;
        }

        await activarWakeLock('gesture-fallback');

        const lock = getWakeLock();
        if (lock && !lock.released) {
            document.removeEventListener('click', tryOnGesture, true);
            document.removeEventListener('touchstart', tryOnGesture, true);
            document.removeEventListener('keydown', tryOnGesture, true);
            wakeGestureFallbackBound = false;
        }
    };

    document.addEventListener('click', tryOnGesture, true);
    document.addEventListener('touchstart', tryOnGesture, true);
    document.addEventListener('keydown', tryOnGesture, true);
}

function ensureWakeLockWatchdog() {
    if (wakeLockWatchdogId) {
        return;
    }

    wakeLockWatchdogId = setInterval(async () => {
        if (document.visibilityState !== 'visible' || !hasActiveSessionContext()) {
            return;
        }

        const lock = getWakeLock();
        if (!lock || lock.released) {
            await activarWakeLock('watchdog');
        }
    }, 10000);
}

function ensureWakeLockStartupAttempts() {
    if (document.visibilityState !== 'visible' || !hasActiveSessionContext()) {
        return;
    }

    setTimeout(() => {
        activarWakeLock('startup-initial');
    }, 250);

    setTimeout(() => {
        const lock = getWakeLock();
        if (!lock || lock.released) {
            activarWakeLock('startup-retry');
        }
    }, 2500);
}

export function hasActiveWakeLockSession() {
    return hasActiveSessionContext();
}

export async function activarWakeLock(source = 'unknown') {
    if (document.visibilityState !== 'visible') {
        return;
    }

    const currentLock = getWakeLock();
    if (currentLock && !currentLock.released) {
        return;
    }

    if (!('wakeLock' in navigator)) {
        console.warn('⚠️ Wake Lock API no disponible en este navegador');
        return;
    }

    try {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);
        console.log('🔋 Wake Lock activado - La pantalla no se apagará', { source });

        lock.addEventListener('release', () => {
            console.log('⚠️ Wake Lock liberado', {
                visibility: document.visibilityState,
                hasActiveSession: hasActiveSessionContext()
            });
            setWakeLock(null);

            if (document.visibilityState === 'visible' && hasActiveSessionContext()) {
                setTimeout(() => {
                    activarWakeLock('release-listener');
                }, 250);
            }
        });
    } catch (err) {
        if (err?.name === 'NotAllowedError') {
            logNotAllowedThrottled(source, err);
            bindWakeLockGestureFallback();
            return;
        }

        console.error('❌ Error activando Wake Lock:', {
            source,
            name: err?.name,
            message: err?.message,
            visibility: document.visibilityState,
            hasActiveSession: hasActiveSessionContext()
        });

        bindWakeLockGestureFallback();
    }
}

export function setupWakeLockVisibilityHandlers(onVisible) {
    ensureWakeLockWatchdog();
    ensureWakeLockStartupAttempts();

    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && hasActiveSessionContext()) {
            await activarWakeLock('visibility-visible');
        }

        if (document.visibilityState === 'visible') {
            console.log('📱 App visible de nuevo');
            if (typeof onVisible === 'function') {
                onVisible();
            }
        } else {
            console.log('📱 App en segundo plano');
        }
    });
}
