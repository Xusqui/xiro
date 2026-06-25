/**
 * @fileoverview Configuración del socket del presentador
 * Gestiona la conexión WebSocket y auto-reconexión
 */

import { getSessionId, setSessionId, setGameType } from './presenter-state.js?v=20260625151006';

// Generar o recuperar playerId único del presentador
function getOrCreatePresenterPlayerId() {
    let playerId = sessionStorage.getItem('xiro_presenter_playerId');

    if (!playerId) {
        playerId = localStorage.getItem('xiro_presenter_playerId');

        if (!playerId) {
            playerId = crypto.randomUUID();
            console.log('🆔 Nuevo playerId de presentador creado:', playerId);
        } else {
            console.log('🆔 playerId de presentador recuperado de localStorage:', playerId);
        }

        sessionStorage.setItem('xiro_presenter_playerId', playerId);
    } else {
        console.log('🆔 playerId de presentador recuperado de sessionStorage:', playerId);
    }

    localStorage.setItem('xiro_presenter_playerId', playerId);
    return playerId;
}

const presenterPlayerId = getOrCreatePresenterPlayerId();

// Configurar socket connection
export const socket = io({
    auth: {
        playerId: presenterPlayerId
    },
    // Permitir polling como fallback: el transporte 'websocket' puede fallar
    // puntualmente (reinicio de backend, proxy, red corporativa) y sin fallback
    // el socket queda muerto. Con upgrade:true empieza por polling y sube a WS.
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    forceNew: false,
    path: '/socket.io/',
    withCredentials: false,
    autoConnect: true
});

// Decodificar transparentemente eventos comprimidos
(function () {
    const originalOn = socket.on;

    async function decompressGzip(arrayBuffer) {
        if (typeof DecompressionStream === 'undefined') {
            try {
                if (typeof process !== 'undefined' && process.release && process.release.name === 'node') {
                    const zlib = eval("require('zlib')");
                    const decompressed = zlib.gunzipSync(new Uint8Array(arrayBuffer));
                    return JSON.parse(decompressed.toString('utf8'));
                }
            } catch (e) {
                console.error('Node fallback decompression failed:', e);
            }
            throw new Error('DecompressionStream not supported');
        }
        const ds = new DecompressionStream('gzip');
        const decompressedStream = new Response(arrayBuffer).body.pipeThrough(ds);
        const text = await new Response(decompressedStream).text();
        return JSON.parse(text);
    }

    socket.on = function (event, callback) {
        function decoderListener(payload, ...args) {
            const self = this;
            if (payload && payload._compressed === true) {
                const isBase64 = typeof payload.data === 'string';
                let promise;
                if (isBase64) {
                    const binaryString = atob(payload.data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    promise = decompressGzip(bytes.buffer);
                } else {
                    promise = decompressGzip(payload.data);
                }
                promise.then(decompressedData => {
                    callback.call(self, decompressedData, ...args);
                }).catch(err => {
                    console.error('Failed to decompress socket payload:', err);
                    callback.call(self, payload, ...args);
                });
            } else {
                callback.call(self, payload, ...args);
            }
        }
        decoderListener.fn = callback;
        originalOn.call(socket, event, decoderListener);
        return socket;
    };
})();

// ===== LOGGING Y MONITOREO DE CONEXIÓN =====
socket.on('connect', () => {
    console.log('✅ Socket conectado:', socket.id);
    console.log('🔌 Transporte usado:', socket.io.engine.transport.name);
    console.log('🔑 PlayerId del presentador:', presenterPlayerId);
});

socket.on('disconnect', (reason) => {
    console.log('⚠️ Socket desconectado:', reason, '| socket.id:', socket.id, '| connected:', socket.connected);
    console.log('   → active transport was:', socket.io?.engine?.transport?.name || 'n/a');

    // Si hay sesión activa, mostrar pantalla de reconexión
    const savedSessionId = localStorage.getItem('xiro_presenter_sessionId');
    if (savedSessionId && reason !== 'io client disconnect') {
        console.log('🔄 Desconexión detectada - Mostrando UI de reconexión... (savedSession:', savedSessionId, ')');
        showReconnectionOverlay();
    }
});

socket.on('connect_error', (error) => {
    console.log('⚠️ Error conectando (intentando alternativa):', error.message, '| type:', error.type, '| description:', error.description);
});

socket.io.on('reconnect', (attempt) => {
    const transport = socket.io.engine.transport.name;
    console.log('✅ Reconectado en intento', attempt);
    console.log('🔌 Usando:', transport === 'websocket' ? '⚡ WebSocket' : '📡 Polling');

    // NOTE: Overlay is removed by presenter-reconnection.js after reconnected-success
});

// Monitorear upgrade a WebSocket
socket.io.engine.on('upgrade', (transport) => {
    console.log('🚀 ¡UPGRADE EXITOSO! Ahora usando WebSocket rápido');
});

socket.io.engine.on('upgradeError', (error) => {
    console.warn('❌ Upgrade a WebSocket falló, continúa con polling:', error.message);
});

// ===== FUNCIONES AUXILIARES =====

/**
 * Mostrar overlay de reconexión
 */
function showReconnectionOverlay() {
    const body = document.body;
    const overlay = document.createElement('div');
    overlay.id = 'presenter-reconnect-overlay';
    overlay.className = 'fixed inset-0 bg-slate-900/95 flex items-center justify-center z-50';
    overlay.innerHTML = _tHtml(`
        <div class="text-center">
            <div class="w-20 h-20 border-8 border-orange-500 border-t-transparent rounded-full animate-spin mb-6 mx-auto"></div>
            <h2 class="text-3xl font-black italic text-white mb-4">⚠️ DESCONECTADO</h2>
            <p class="text-xl text-white/90 mb-2">PRESENTADOR</p>
            <p class="text-base text-white/70">Reconectando automáticamente...</p>
        </div>
    `);
    body.appendChild(overlay);
}

/**
 * Auto-reconexión al cargar si hay sessionId en URL o storage.
 * 
 * Prioridad de fuentes:
 *  1) sessionStorage (persiste en F5 dentro de la misma pestaña — fuente primaria)
 *  2) localStorage   (persiste entre pestañas/ventanas — fuente secundaria)
 *
 * Si ni sessionStorage ni localStorage tienen el sessionId pero la URL sí,
 * se trata de una URL compartida y NO se intenta reconexión.
 */
export function initializePresenterSession() {
    // --- Recoger datos de AMBOS storages ---
    const ssSessionId = sessionStorage.getItem('xiro_presenter_sessionId');
    const ssPlayerId = sessionStorage.getItem('xiro_presenter_playerId');

    const lsSessionId = localStorage.getItem('xiro_presenter_sessionId');
    const lsPlayerId = localStorage.getItem('xiro_presenter_playerId');
    const lsPin = localStorage.getItem('xiro_presenter_pin');

    const sessionFromUrl = new URLSearchParams(window.location.search).get('session')?.toUpperCase();

    // Usar el mejor dato disponible (sessionStorage > localStorage)
    const bestSessionId = ssSessionId || lsSessionId;
    const bestPlayerId = ssPlayerId || lsPlayerId;

    // --- Case 1: URL tiene session Y coincide con storage → RECONEXIÓN ---
    if (sessionFromUrl && bestSessionId === sessionFromUrl && bestPlayerId) {
        console.log('✅ SessionId en URL coincide con storage — Esperando auto-reconexión...');
        // Asegurar que AMBOS storages están sincronizados
        sessionStorage.setItem('xiro_presenter_sessionId', sessionFromUrl);
        localStorage.setItem('xiro_presenter_sessionId', sessionFromUrl);
        if (bestPlayerId) localStorage.setItem('xiro_presenter_playerId', bestPlayerId);
        const gt = sessionStorage.getItem('xiro_presenter_gameType') || localStorage.getItem('xiro_presenter_gameType');
        if (gt) setGameType(gt);
        return;
    }

    // --- Case 2: NO hay session en URL pero sí en storage → restaurar URL ---
    if (!sessionFromUrl && bestSessionId && bestPlayerId && lsPin) {
        console.log('🔄 SessionId guardado detectado — Actualizando URL y preparando reconexión...');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('session', bestSessionId);
        window.history.replaceState({}, '', newUrl);
        setSessionId(bestSessionId);
        const gt2 = sessionStorage.getItem('xiro_presenter_gameType') || localStorage.getItem('xiro_presenter_gameType');
        if (gt2) setGameType(gt2);
        // Sincronizar
        sessionStorage.setItem('xiro_presenter_sessionId', bestSessionId);
        console.log('✅ URL actualizada, reconexión se disparará en socket.on("connect")');
        return;
    }

    // --- Case 3: URL tiene session pero NO está en ningún storage → URL compartida ---
    if (sessionFromUrl && !bestSessionId) {
        console.log('⚠️ SessionId en URL pero NO en ningún storage — URL compartida detectada');
        // Limpiar datos de sesión pero NO el playerId (se reutilizará si crean lobby nuevo)
        localStorage.removeItem('xiro_presenter_sessionId');
        localStorage.removeItem('xiro_presenter_pin');
        sessionStorage.removeItem('xiro_presenter_sessionId');
        sessionStorage.removeItem('xiro_presenter_pin');
        return;
    }

    // --- Case 4: URL tiene session pero storage apunta a otra sesión ---
    // Evita reconexiones inválidas con playerId de una sesión antigua.
    if (sessionFromUrl && bestSessionId && bestSessionId !== sessionFromUrl) {
        console.warn('⚠️ SessionId en URL y storage desalineados — limpiando sesión local para evitar reconnect inválido', {
            urlSession: sessionFromUrl,
            storedSession: bestSessionId
        });

        localStorage.removeItem('xiro_presenter_sessionId');
        localStorage.removeItem('xiro_presenter_pin');
        sessionStorage.removeItem('xiro_presenter_sessionId');
        sessionStorage.removeItem('xiro_presenter_pin');
    }
}

export { presenterPlayerId };

// Getter para el socket
export function getSocket() {
    return socket;
}

// Getter para el presenterPlayerId
export function getPresenterPlayerId() {
    return presenterPlayerId;
}