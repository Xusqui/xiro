/**
 * @fileoverview Utilidades de storage para sesión de jugador
 */

export function getSavedSessionData() {
    return {
        pin: localStorage.getItem('xiro_lastPin'),
        nickname: localStorage.getItem('xiro_lastNickname'),
        sessionId: localStorage.getItem('xiro_lastSessionId')
    };
}

export function clearSavedSessionData() {
    localStorage.removeItem('xiro_lastPin');
    localStorage.removeItem('xiro_lastNickname');
    localStorage.removeItem('xiro_lastSessionId');
    localStorage.removeItem('xiro_lastTeamIndex');
    localStorage.removeItem('xiro_lastTeamName');
    // Limpiar marcador per-ventana PERO preservar pid=<uuid> (identidad
    // per-ventana del jugador — ver player-socket-config.js). Si limpiásemos
    // window.name entero, la siguiente carga generaría un nuevo playerId y
    // el servidor trataría al jugador como uno distinto.
    try {
        const cur = window.name || '';
        const pidMatch = /(?:^|\|)pid=([0-9a-f-]{36})/i.exec(cur);
        window.name = pidMatch ? ('pid=' + pidMatch[1]) : '';
    } catch (_) { }
    try { sessionStorage.removeItem('xiro_sessionSecret'); } catch (_) { }
}

export function isSameSession(savedSessionId, sessionIdFromUrl) {
    if (!savedSessionId || !sessionIdFromUrl) return false;
    return String(savedSessionId).toUpperCase() === String(sessionIdFromUrl).toUpperCase();
}

/**
 * Marcadores de "esta ventana es la dueña de la sesión": window.name (única
 * forma de storage per-ventana incluso en Chrome incognito, ver comentarios
 * en player-session.js) + el secreto de sesión en sessionStorage.
 */
export function getWindowSessionMarkers() {
    let windowOwnsSession = false;
    try {
        windowOwnsSession = !!(window.name && window.name.startsWith('xiro:'));
    } catch (_) {
        windowOwnsSession = false;
    }
    const tabSessionSecret = sessionStorage.getItem('xiro_sessionSecret');
    return { windowOwnsSession, tabSessionSecret };
}
