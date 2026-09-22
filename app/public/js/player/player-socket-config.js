/**
 * @fileoverview Configuración de Socket.IO para el jugador
 * Sistema de identificación persistente y configuración de socket
 */

// ===== SISTEMA DE IDENTIFICACIÓN PERSISTENTE =====

/**
 * Generar o recuperar playerId único PER-VENTANA.
 *
 * CRÍTICO: NO usar localStorage/sessionStorage para el playerId. Ambos son
 * compartidos entre pestañas/ventanas del mismo perfil de navegador (incluso
 * entre ventanas de Chrome incognito). Si 10 jugadores abren la app en
 * pestañas distintas del mismo perfil, TODOS reciben el mismo playerId de
 * localStorage, colisionan en el `players` Map del servidor (keyed por
 * playerId) y las respuestas se marcan como duplicadas para todos menos uno.
 *
 * `window.name` es el único storage per-ventana fiable (persiste en recargas
 * dentro de la misma pestaña, pero NO se comparte entre ventanas).
 */
function getOrCreatePlayerId() {
    let playerId = null;
    try {
        const m = /(?:^|\|)pid=([0-9a-f-]{36})/i.exec(window.name || '');
        if (m) playerId = m[1];
    } catch (_) { }

    if (!playerId) {
        playerId = crypto.randomUUID();
        console.log('🆔 Nuevo playerId per-ventana creado:', playerId);
    } else {
        console.log('🆔 playerId recuperado de window.name:', playerId);
    }

    // Persistir en window.name (preservando cualquier marcador de sesión existente)
    try {
        const cur = window.name || '';
        if (!/(?:^|\|)pid=/i.test(cur)) {
            window.name = cur ? (cur + '|pid=' + playerId) : ('pid=' + playerId);
        }
    } catch (_) { }

    return playerId;
}

// Decoder transparente de eventos comprimidos (registra
// globalThis.PlayerSocketDecompress)
import './player-socket-decompress.js?v=20260922074829';

// ===== INICIALIZACIÓN =====

export const playerId = getOrCreatePlayerId();

export const socket = io({
    transports: ['websocket'],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    auth: {
        playerId: playerId
    }
});

// Decodificar transparentemente eventos comprimidos
globalThis.PlayerSocketDecompress.applyDecompressionDecoder(socket);

/**
 * Obtener referencia al socket (para usar en otros módulos)
 */
export function getSocket() {
    return socket;
}

/**
 * Obtener playerId (para usar en otros módulos)
 */
export function getPlayerId() {
    return playerId;
}
